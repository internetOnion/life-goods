from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from lifegoods.matching.external_requests import ExternalLookupLocks, SlidingWindowRequestBudget
from lifegoods.matching.external_snapshots import (
    ExternalEvidenceCategory,
    ExternalFieldEvidence,
    ExternalSnapshotOutcome,
    ExternalSnapshotRepository,
    PersistedExternalSnapshot,
)
from lifegoods.matching.external_source import (
    ExternalPackageFound,
    ExternalPackageNotFound,
    ExternalPackageSource,
    ExternalPackageUnavailable,
)
from lifegoods.matching.identifier import NormalizedIdentifier, normalize_identifier
from lifegoods.matching.repository import (
    PackageMatchCandidate,
    PackageMatchEvidence,
    PackageMatchReferenceImage,
    PackageMatchRepository,
    PackageMatchSourceKind,
    PackageMatchSourceMetadata,
)

SUCCESS_SNAPSHOT_TTL = timedelta(hours=24)
NOT_FOUND_SNAPSHOT_TTL = timedelta(minutes=15)


class PackageMatchSourceUnavailableError(Exception):
    pass


@dataclass(frozen=True, slots=True)
class PackageMatchResult:
    identifier: NormalizedIdentifier
    candidates: list[PackageMatchCandidate]


class FindPackageMatches:
    def __init__(
        self,
        repository: PackageMatchRepository,
        external_snapshots: ExternalSnapshotRepository,
        external_source: ExternalPackageSource,
        request_budget: SlidingWindowRequestBudget,
        lookup_locks: ExternalLookupLocks,
        *,
        utc_now: Callable[[], datetime] | None = None,
    ) -> None:
        self._repository = repository
        self._external_snapshots = external_snapshots
        self._external_source = external_source
        self._request_budget = request_budget
        self._lookup_locks = lookup_locks
        self._utc_now = utc_now or (lambda: datetime.now(UTC))

    def execute(self, entered_identifier: str) -> PackageMatchResult:
        identifier = normalize_identifier(entered_identifier)
        candidates = self._repository.find_candidates(identifier)
        external_candidate = self._find_external_candidate(identifier)
        if external_candidate is not None:
            candidates.append(external_candidate)
        return PackageMatchResult(identifier=identifier, candidates=candidates)

    def _find_external_candidate(
        self, identifier: NormalizedIdentifier
    ) -> PackageMatchCandidate | None:
        source = self._external_source.metadata
        snapshot = self._external_snapshots.find_latest(source, identifier.value)
        now = self._utc_now()
        if snapshot is not None and snapshot.is_fresh(now):
            return _candidate_from_snapshot(snapshot)

        lock_key = f"{source.name}\0{source.base_url}\0{identifier.value}"
        with self._lookup_locks.hold(lock_key):
            snapshot = self._external_snapshots.find_latest(source, identifier.value)
            now = self._utc_now()
            if snapshot is not None and snapshot.is_fresh(now):
                return _candidate_from_snapshot(snapshot)
            if not self._request_budget.try_acquire():
                raise PackageMatchSourceUnavailableError("Open Food Facts request budget exhausted")

            result = self._external_source.fetch(identifier)
            if isinstance(result, ExternalPackageUnavailable):
                raise PackageMatchSourceUnavailableError(result.reason)
            if isinstance(result, ExternalPackageNotFound):
                self._external_snapshots.save_not_found(
                    result,
                    fresh_until=result.retrieved_at + NOT_FOUND_SNAPSHOT_TTL,
                )
                return None
            if isinstance(result, ExternalPackageFound):
                saved = self._external_snapshots.save_found(
                    result,
                    fresh_until=result.record.retrieved_at + SUCCESS_SNAPSHOT_TTL,
                )
                return _candidate_from_snapshot(saved)
            raise AssertionError(f"Unexpected external lookup result: {type(result).__name__}")


def _candidate_from_snapshot(
    snapshot: PersistedExternalSnapshot,
) -> PackageMatchCandidate | None:
    if snapshot.outcome is ExternalSnapshotOutcome.NOT_FOUND:
        return None
    record_url = snapshot.source_url or snapshot.request_url
    source = PackageMatchSourceMetadata(
        name=snapshot.source.name,
        source_type=snapshot.source.source_type,
        base_url=snapshot.source.base_url,
        record_url=record_url,
        attribution=snapshot.source.attribution,
        database_license=snapshot.source.database_license,
        contents_license=snapshot.source.contents_license,
        image_license=snapshot.source.image_license,
        terms_version=snapshot.source.terms_version,
    )
    identity = tuple(
        _candidate_evidence(snapshot, evidence)
        for evidence in snapshot.field_evidence
        if evidence.category is ExternalEvidenceCategory.IDENTITY
    )
    label = tuple(
        _candidate_evidence(snapshot, evidence)
        for evidence in snapshot.field_evidence
        if evidence.category is ExternalEvidenceCategory.LABEL
    )
    images: list[PackageMatchReferenceImage] = []
    for evidence in snapshot.field_evidence:
        if evidence.category is not ExternalEvidenceCategory.IMAGE:
            continue
        value = evidence.value
        if not isinstance(value, dict):
            continue
        role = value.get("role")
        url = value.get("url")
        if not isinstance(role, str) or not isinstance(url, str):
            continue
        images.append(
            PackageMatchReferenceImage(
                role=role,
                url=url,
                source_field=evidence.source_field,
                source_name=snapshot.source.name,
                source_url=evidence.source_uri,
                attribution=evidence.attribution,
                license_name=evidence.license_name,
                language=evidence.language,
            )
        )
    return PackageMatchCandidate(
        source_kind=PackageMatchSourceKind.OPEN_FOOD_FACTS,
        external_record_id=snapshot.source_record_id,
        source=source,
        identity_evidence=identity,
        label_evidence=label,
        reference_images=tuple(images),
        retrieved_at=snapshot.retrieved_at,
        is_current=True,
        source_revision=snapshot.source_revision,
    )


def _candidate_evidence(
    snapshot: PersistedExternalSnapshot,
    evidence: ExternalFieldEvidence,
) -> PackageMatchEvidence:
    return PackageMatchEvidence(
        field=evidence.mapped_field,
        value=evidence.value,
        source_field=evidence.source_field,
        source_name=snapshot.source.name,
        source_url=evidence.source_uri,
        language=evidence.language,
        observed_at=evidence.observed_at,
        retrieved_at=evidence.retrieved_at,
    )
