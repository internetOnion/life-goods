from __future__ import annotations

import hashlib
import json
import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, Protocol

from lifegoods.package_matches.assessments import (
    AllergenAssessmentEvaluation,
    AllergenAssessmentOutcome,
    AllergenAssessmentReason,
    AllergenAssessmentStatus,
    AllergenConceptOutcome,
    AllergenFinding,
    EvidenceCoverageState,
)
from lifegoods.package_matches.models import PackageMatchEvidence
from lifegoods.reference_datasets import AllergenAssessmentReferenceVersion

if TYPE_CHECKING:
    from lifegoods.open_food_facts.models import ExternalPackageRecord

DEFAULT_ASSESSMENT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days = 604,800 seconds

logger = logging.getLogger(__name__)


class RedisClientProtocol(Protocol):
    def get(self, name: str) -> Any: ...
    def set(self, name: str, value: Any, ex: int | None = None) -> Any: ...


def compute_evidence_digest(record: ExternalPackageRecord) -> str:
    """Compute a deterministic SHA-256 digest of package record Evidence relevant to assessments."""
    evidence_payload: dict[str, Any] = {
        "ingredient_texts": [
            {
                "field": it.source_field or "",
                "language": it.language or "",
                "value": it.value or "",
            }
            for it in record.ingredient_texts
        ],
        "allergen_declaration": (
            {
                "field": record.allergen_declaration.source_field or "",
                "language": record.allergen_declaration.language or "",
                "value": record.allergen_declaration.value or "",
            }
            if record.allergen_declaration is not None
            else None
        ),
        "allergen_tags": (
            {
                "field": record.allergen_tags.source_field or "",
                "language": record.allergen_tags.language or "",
                "value": list(record.allergen_tags.value or ()),
            }
            if record.allergen_tags is not None
            else None
        ),
        "trace_declaration": (
            {
                "field": record.trace_declaration.source_field or "",
                "language": record.trace_declaration.language or "",
                "value": record.trace_declaration.value or "",
            }
            if record.trace_declaration is not None
            else None
        ),
        "trace_tags": (
            {
                "field": record.trace_tags.source_field or "",
                "language": record.trace_tags.language or "",
                "value": list(record.trace_tags.value or ()),
            }
            if record.trace_tags is not None
            else None
        ),
    }
    canonical_json = json.dumps(evidence_payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def build_assessment_cache_key(
    *,
    off_dataset_version_id: str,
    record_id: str,
    source_revision_or_digest: str,
    reference_dataset_version_id: str,
    engine_version: str,
) -> str:
    return (
        f"assessment:eval:{off_dataset_version_id}:{record_id}:"
        f"{source_revision_or_digest}:{reference_dataset_version_id}:{engine_version}"
    )


def assessment_cache_key_for_record(
    record: ExternalPackageRecord,
    *,
    reference_dataset_version_id: str,
    engine_version: str,
) -> str:
    off_dataset_version_id = (
        record.dataset_version.id if record.dataset_version is not None else "unknown"
    )
    record_id = record.source_record_id or record.identifier
    source_revision = record.source_revision or "none"
    digest = compute_evidence_digest(record)
    source_revision_or_digest = f"{source_revision}:{digest}"
    return build_assessment_cache_key(
        off_dataset_version_id=off_dataset_version_id,
        record_id=record_id,
        source_revision_or_digest=source_revision_or_digest,
        reference_dataset_version_id=reference_dataset_version_id,
        engine_version=engine_version,
    )


def serialize_assessment_evaluation(evaluation: AllergenAssessmentEvaluation) -> str:
    """Serialize an Assessment Evaluation to a JSON string without private/session data."""
    ref_dict = None
    if evaluation.reference_dataset_version is not None:
        ref_dict = {
            "id": evaluation.reference_dataset_version.id,
            "source_url": evaluation.reference_dataset_version.source_url,
            "retrieved_at": evaluation.reference_dataset_version.retrieved_at.isoformat(),
            "activated_at": evaluation.reference_dataset_version.activated_at.isoformat(),
            "sha256": evaluation.reference_dataset_version.sha256,
            "review_kind": evaluation.reference_dataset_version.review_kind,
            "dataset_kind": evaluation.reference_dataset_version.dataset_kind,
        }

    concepts_list = [
        {
            "concept_id": c.concept_id,
            "name": c.name,
            "outcome": str(c.outcome),
            "reason": str(c.reason) if c.reason is not None else None,
            "finding_ids": list(c.finding_ids),
            "parent_ids": list(c.parent_ids),
            "rule_ids": list(c.rule_ids),
        }
        for c in evaluation.concepts
    ]

    findings_list = [
        {
            "id": f.id,
            "concept_id": f.concept_id,
            "relationship_type": str(f.relationship_type),
            "matched_text": f.matched_text,
            "start_index": f.start_index,
            "end_index": f.end_index,
            "mapping_id": f.mapping_id,
            "rule_id": f.rule_id,
            "source_text": f.source_text,
            "language": f.language,
            "source_field": f.source_field,
            "source_url": f.source_url,
            "source_revision": f.source_revision,
            "off_dataset_version_id": f.off_dataset_version_id,
            "reference_dataset_version_id": f.reference_dataset_version_id,
            "engine_version": f.engine_version,
        }
        for f in evaluation.findings
    ]

    signals_list = [
        {
            "field": s.field,
            "value": s.value,
            "source_field": s.source_field,
            "source_name": s.source_name,
            "source_url": s.source_url,
            "language": s.language,
            "observed_at": s.observed_at.isoformat() if s.observed_at is not None else None,
            "retrieved_at": s.retrieved_at.isoformat() if s.retrieved_at is not None else None,
            "source_revision": s.source_revision,
            "dataset_version_id": s.dataset_version_id,
        }
        for s in evaluation.source_signals
    ]

    payload = {
        "status": str(evaluation.status),
        "reason": str(evaluation.reason) if evaluation.reason is not None else None,
        "evidence_coverage": str(evaluation.evidence_coverage),
        "engine_version": evaluation.engine_version,
        "reference_dataset_version": ref_dict,
        "concepts": concepts_list,
        "findings": findings_list,
        "source_signals": signals_list,
    }
    return json.dumps(payload, separators=(",", ":"))


def deserialize_assessment_evaluation(data: str) -> AllergenAssessmentEvaluation:
    """Deserialize a JSON string back to AllergenAssessmentEvaluation."""
    try:
        raw = json.loads(data)
        if not isinstance(raw, dict):
            raise ValueError("Evaluation data is not a JSON object")

        status = AllergenAssessmentStatus(raw["status"])
        reason = (
            AllergenAssessmentReason(raw["reason"])
            if raw.get("reason") is not None
            else None
        )
        evidence_coverage = EvidenceCoverageState(raw["evidence_coverage"])
        engine_version = raw.get("engine_version")

        ref_dict = raw.get("reference_dataset_version")
        ref_version = None
        if ref_dict is not None:
            ref_version = AllergenAssessmentReferenceVersion(
                id=ref_dict["id"],
                source_url=ref_dict["source_url"],
                retrieved_at=datetime.fromisoformat(ref_dict["retrieved_at"]),
                activated_at=datetime.fromisoformat(ref_dict["activated_at"]),
                sha256=ref_dict["sha256"],
                review_kind=ref_dict["review_kind"],
                dataset_kind=ref_dict["dataset_kind"],
            )

        concepts = tuple(
            AllergenConceptOutcome(
                concept_id=c["concept_id"],
                name=c["name"],
                outcome=AllergenAssessmentOutcome(c["outcome"]),
                reason=(
                    AllergenAssessmentReason(c["reason"])
                    if c.get("reason") is not None
                    else None
                ),
                finding_ids=tuple(c.get("finding_ids", ())),
                parent_ids=tuple(c.get("parent_ids", ())),
                rule_ids=tuple(c.get("rule_ids", ())),
            )
            for c in raw.get("concepts", [])
        )

        findings = tuple(
            AllergenFinding(
                id=f["id"],
                concept_id=f["concept_id"],
                relationship_type=f.get("relationship_type", "EXACT_NAME"),
                matched_text=f.get("matched_text", ""),
                start_index=f.get("start_index", 0),
                end_index=f.get("end_index", 0),
                mapping_id=f.get("mapping_id"),
                rule_id=f.get("rule_id"),
                source_text=f.get("source_text"),
                language=f.get("language"),
                source_field=f.get("source_field", ""),
                source_url=f.get("source_url", ""),
                source_revision=f.get("source_revision"),
                off_dataset_version_id=f.get("off_dataset_version_id"),
                reference_dataset_version_id=f.get("reference_dataset_version_id"),
                engine_version=f.get("engine_version"),
            )
            for f in raw.get("findings", [])
        )

        source_signals = tuple(
            PackageMatchEvidence(
                field=s["field"],
                value=s["value"],
                source_field=s.get("source_field") or "",
                source_name=s.get("source_name") or "",
                source_url=s.get("source_url") or "",
                language=s.get("language"),
                observed_at=(
                    datetime.fromisoformat(s["observed_at"])
                    if s.get("observed_at") is not None
                    else None
                ),
                retrieved_at=(
                    datetime.fromisoformat(s["retrieved_at"])
                    if s.get("retrieved_at") is not None
                    else datetime.now(tz=UTC)
                ),
                source_revision=s.get("source_revision"),
                dataset_version_id=s.get("dataset_version_id"),
            )
            for s in raw.get("source_signals", [])
        )

        return AllergenAssessmentEvaluation(
            status=status,
            reason=reason,
            evidence_coverage=evidence_coverage,
            engine_version=engine_version,
            reference_dataset_version=ref_version,
            concepts=concepts,
            findings=findings,
            source_signals=source_signals,
        )
    except Exception as exc:
        raise ValueError(f"Failed to deserialize AllergenAssessmentEvaluation: {exc}") from exc


class RedisAllergenAssessmentCache:
    """Non-durable cache-aside adapter for AllergenAssessmentEvaluation objects in Redis."""

    def __init__(
        self,
        client: RedisClientProtocol,
        *,
        ttl_seconds: int = DEFAULT_ASSESSMENT_CACHE_TTL_SECONDS,
    ) -> None:
        self._client = client
        self._ttl_seconds = ttl_seconds

    def get(self, key: str) -> AllergenAssessmentEvaluation | None:
        try:
            raw = self._client.get(key)
            if raw is None:
                return None
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            return deserialize_assessment_evaluation(raw)
        except Exception as exc:
            logger.warning("Redis assessment cache get failed or payload malformed: %s", exc)
            return None

    def set(self, key: str, value: AllergenAssessmentEvaluation) -> None:
        try:
            serialized = serialize_assessment_evaluation(value)
            self._client.set(key, serialized, ex=self._ttl_seconds)
        except Exception as exc:
            logger.warning("Redis assessment cache set failed: %s", exc)
