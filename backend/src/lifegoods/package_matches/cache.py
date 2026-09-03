from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any, Protocol

from lifegoods.package_matches.assessments import (
    AllergenAssessmentEvaluation,
    AllergenAssessmentOutcome,
    AllergenAssessmentReason,
    AllergenAssessmentStatus,
    AllergenConceptOutcome,
    AllergenFinding,
    EvidenceCoverageState,
    HalalIngredientAssessmentEvaluation,
    HalalIngredientAssessmentOutcome,
    HalalIngredientAssessmentReason,
    HalalIngredientAssessmentStatus,
    HalalIngredientFinding,
)
from lifegoods.package_matches.models import PackageMatchEvidence
from lifegoods.reference_datasets import (
    AllergenAssessmentReferenceVersion,
    HalalAssessmentReferenceVersion,
    HalalSourceCitation,
)

if TYPE_CHECKING:
    from lifegoods.open_food_facts.models import ExternalPackageRecord

DEFAULT_ASSESSMENT_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days = 604,800 seconds
ASSESSMENT_CACHE_SCHEMA_VERSION = 2

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


def compute_reference_dataset_context_digest(
    version: AllergenAssessmentReferenceVersion | HalalAssessmentReferenceVersion,
) -> str:
    context = {
        "activated_at": version.activated_at.isoformat(),
        "dataset_kind": version.dataset_kind,
        "id": version.id,
        "review_kind": version.review_kind,
        "sha256": version.sha256,
    }
    canonical_json = json.dumps(context, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def build_assessment_cache_key(
    *,
    off_dataset_version_id: str,
    record_id: str,
    source_revision_or_digest: str,
    reference_dataset_context_digest: str,
    engine_version: str,
) -> str:
    return (
        f"assessment:eval:v{ASSESSMENT_CACHE_SCHEMA_VERSION}:"
        f"{off_dataset_version_id}:{record_id}:{source_revision_or_digest}:"
        f"{reference_dataset_context_digest}:{engine_version}"
    )


def assessment_cache_key_for_record(
    record: ExternalPackageRecord,
    *,
    reference_dataset_version: AllergenAssessmentReferenceVersion,
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
        reference_dataset_context_digest=(
            compute_reference_dataset_context_digest(reference_dataset_version)
        ),
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
        "schema_version": ASSESSMENT_CACHE_SCHEMA_VERSION,
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
        _require_fields(
            raw,
            {
                "schema_version",
                "status",
                "reason",
                "evidence_coverage",
                "engine_version",
                "reference_dataset_version",
                "concepts",
                "findings",
                "source_signals",
            },
            "evaluation",
        )
        if raw["schema_version"] != ASSESSMENT_CACHE_SCHEMA_VERSION:
            raise ValueError("Unsupported Assessment Evaluation cache schema")

        status = AllergenAssessmentStatus(raw["status"])
        reason = (
            AllergenAssessmentReason(raw["reason"])
            if raw["reason"] is not None
            else None
        )
        evidence_coverage = EvidenceCoverageState(raw["evidence_coverage"])
        engine_version = raw["engine_version"]

        ref_dict = raw["reference_dataset_version"]
        ref_version = None
        if ref_dict is not None:
            if not isinstance(ref_dict, dict):
                raise ValueError("Reference Dataset Version is not an object")
            _require_fields(
                ref_dict,
                {
                    "id",
                    "source_url",
                    "retrieved_at",
                    "activated_at",
                    "sha256",
                    "review_kind",
                    "dataset_kind",
                },
                "reference_dataset_version",
            )
            ref_version = AllergenAssessmentReferenceVersion(
                id=ref_dict["id"],
                source_url=ref_dict["source_url"],
                retrieved_at=datetime.fromisoformat(ref_dict["retrieved_at"]),
                activated_at=datetime.fromisoformat(ref_dict["activated_at"]),
                sha256=ref_dict["sha256"],
                review_kind=ref_dict["review_kind"],
                dataset_kind=ref_dict["dataset_kind"],
            )
        concepts = tuple(_deserialize_concept(c) for c in _require_list(raw, "concepts"))
        findings = tuple(_deserialize_finding(f) for f in _require_list(raw, "findings"))
        source_signals = tuple(
            _deserialize_source_signal(s) for s in _require_list(raw, "source_signals")
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


def _require_fields(raw: dict[str, Any], fields: set[str], section: str) -> None:
    missing = fields.difference(raw)
    if missing:
        raise ValueError(f"Missing required {section} fields")


def _require_list(raw: dict[str, Any], field: str) -> list[Any]:
    value = raw[field]
    if not isinstance(value, list):
        raise ValueError(f"{field} is not a list")
    return value


def _require_object(value: Any, section: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError(f"{section} is not an object")
    return value


def _deserialize_concept(value: Any) -> AllergenConceptOutcome:
    raw = _require_object(value, "concept")
    _require_fields(
        raw,
        {
            "concept_id",
            "name",
            "outcome",
            "reason",
            "finding_ids",
            "parent_ids",
            "rule_ids",
        },
        "concept",
    )
    return AllergenConceptOutcome(
        concept_id=raw["concept_id"],
        name=raw["name"],
        outcome=AllergenAssessmentOutcome(raw["outcome"]),
        reason=(
            AllergenAssessmentReason(raw["reason"])
            if raw["reason"] is not None
            else None
        ),
        finding_ids=tuple(raw["finding_ids"]),
        parent_ids=tuple(raw["parent_ids"]),
        rule_ids=tuple(raw["rule_ids"]),
    )


def _deserialize_finding(value: Any) -> AllergenFinding:
    raw = _require_object(value, "finding")
    _require_fields(
        raw,
        {
            "id",
            "concept_id",
            "relationship_type",
            "matched_text",
            "start_index",
            "end_index",
            "mapping_id",
            "rule_id",
            "source_text",
            "language",
            "source_field",
            "source_url",
            "source_revision",
            "off_dataset_version_id",
            "reference_dataset_version_id",
            "engine_version",
        },
        "finding",
    )
    return AllergenFinding(
        id=raw["id"],
        concept_id=raw["concept_id"],
        relationship_type=raw["relationship_type"],
        matched_text=raw["matched_text"],
        start_index=raw["start_index"],
        end_index=raw["end_index"],
        mapping_id=raw["mapping_id"],
        rule_id=raw["rule_id"],
        source_text=raw["source_text"],
        language=raw["language"],
        source_field=raw["source_field"],
        source_url=raw["source_url"],
        source_revision=raw["source_revision"],
        off_dataset_version_id=raw["off_dataset_version_id"],
        reference_dataset_version_id=raw["reference_dataset_version_id"],
        engine_version=raw["engine_version"],
    )


def _deserialize_source_signal(value: Any) -> PackageMatchEvidence:
    raw = _require_object(value, "source_signal")
    _require_fields(
        raw,
        {
            "field",
            "value",
            "source_field",
            "source_name",
            "source_url",
            "language",
            "observed_at",
            "retrieved_at",
            "source_revision",
            "dataset_version_id",
        },
        "source_signal",
    )
    return PackageMatchEvidence(
        field=raw["field"],
        value=raw["value"],
        source_field=raw["source_field"],
        source_name=raw["source_name"],
        source_url=raw["source_url"],
        language=raw["language"],
        observed_at=(
            datetime.fromisoformat(raw["observed_at"])
            if raw["observed_at"] is not None
            else None
        ),
        retrieved_at=datetime.fromisoformat(raw["retrieved_at"]),
        source_revision=raw["source_revision"],
        dataset_version_id=raw["dataset_version_id"],
    )


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
        except ValueError:
            logger.warning(
                "Assessment Evaluation cache entry rejected",
                extra={
                    "event": "assessment_cache_invalid",
                    "dependency": "redis",
                    "operation": "deserialize_assessment_evaluation",
                    "failure_category": "schema_or_payload",
                },
            )
            return None
        except Exception as exc:
            logger.warning(
                "Assessment Evaluation cache read failed",
                extra={
                    "event": "assessment_cache_read_failed",
                    "dependency": "redis",
                    "operation": "get_assessment_evaluation",
                    "failure_category": "cache_error",
                    "error_category": type(exc).__name__,
                },
            )
            return None

    def set(self, key: str, value: AllergenAssessmentEvaluation) -> None:
        try:
            serialized = serialize_assessment_evaluation(value)
            self._client.set(key, serialized, ex=self._ttl_seconds)
        except Exception as exc:
            logger.warning(
                "Assessment Evaluation cache write failed",
                extra={
                    "event": "assessment_cache_write_failed",
                    "dependency": "redis",
                    "operation": "set_assessment_evaluation",
                    "failure_category": "cache_error",
                    "error_category": type(exc).__name__,
                },
            )


def halal_assessment_cache_key_for_record(
    record: ExternalPackageRecord,
    *,
    reference_dataset_version: HalalAssessmentReferenceVersion,
    engine_version: str,
) -> str:
    off_dataset_version_id = (
        record.dataset_version.id if record.dataset_version is not None else "unknown"
    )
    record_id = record.source_record_id or record.identifier
    source_revision = record.source_revision or "none"
    digest = compute_evidence_digest(record)
    source_revision_or_digest = f"{source_revision}:{digest}"
    return (
        f"assessment:halal:eval:v1:"
        f"{off_dataset_version_id}:{record_id}:{source_revision_or_digest}:"
        f"{compute_reference_dataset_context_digest(reference_dataset_version)}:{engine_version}"
    )


def serialize_halal_assessment_evaluation(
    evaluation: HalalIngredientAssessmentEvaluation,
) -> str:
    """Serialize a Halal Ingredient Assessment Evaluation to a JSON string without private data."""
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

    findings_list = [
        {
            "id": f.id,
            "concept_id": f.concept_id,
            "classification": str(f.classification),
            "relationship_type": str(f.relationship_type),
            "matched_text": f.matched_text,
            "start_index": f.start_index,
            "end_index": f.end_index,
            "mapping_id": f.mapping_id,
            "halal_mapping_id": f.halal_mapping_id,
            "source_text": f.source_text,
            "language": f.language,
            "citations": [
                {
                    "source_id": c.source_id,
                    "jurisdiction": c.jurisdiction,
                    "edition": c.edition,
                    "locator": c.locator,
                    "notes": c.notes,
                }
                for c in f.citations
            ],
            "source_field": f.source_field,
            "source_url": f.source_url,
            "source_revision": f.source_revision,
            "off_dataset_version_id": f.off_dataset_version_id,
            "reference_dataset_version_id": f.reference_dataset_version_id,
            "engine_version": f.engine_version,
        }
        for f in evaluation.findings
    ]

    checked_evidence_list = [
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
        for s in evaluation.checked_evidence
    ]

    payload = {
        "schema_version": 1,
        "status": str(evaluation.status),
        "reason": str(evaluation.reason) if evaluation.reason is not None else None,
        "outcome": str(evaluation.outcome),
        "evidence_coverage": str(evaluation.evidence_coverage),
        "engine_version": evaluation.engine_version,
        "reference_dataset_version": ref_dict,
        "checked_evidence": checked_evidence_list,
        "findings": findings_list,
    }
    return json.dumps(payload, separators=(",", ":"))


def _deserialize_halal_source_citation(value: Any) -> HalalSourceCitation:
    raw = _require_object(value, "citation")
    _require_fields(
        raw,
        {
            "source_id",
            "jurisdiction",
            "edition",
            "locator",
            "notes",
        },
        "citation",
    )
    return HalalSourceCitation(
        source_id=raw["source_id"],
        jurisdiction=raw["jurisdiction"],
        edition=raw["edition"],
        locator=raw["locator"],
        notes=raw["notes"],
    )


def _deserialize_halal_finding(value: Any) -> HalalIngredientFinding:
    raw = _require_object(value, "finding")
    _require_fields(
        raw,
        {
            "id",
            "concept_id",
            "classification",
            "relationship_type",
            "matched_text",
            "start_index",
            "end_index",
            "mapping_id",
            "halal_mapping_id",
            "source_text",
            "language",
            "citations",
            "source_field",
            "source_url",
            "source_revision",
            "off_dataset_version_id",
            "reference_dataset_version_id",
            "engine_version",
        },
        "finding",
    )
    citations = tuple(
        _deserialize_halal_source_citation(c)
        for c in _require_list(raw, "citations")
    )
    return HalalIngredientFinding(
        id=raw["id"],
        concept_id=raw["concept_id"],
        classification=raw["classification"],
        relationship_type=raw["relationship_type"],
        matched_text=raw["matched_text"],
        start_index=raw["start_index"],
        end_index=raw["end_index"],
        mapping_id=raw["mapping_id"],
        halal_mapping_id=raw["halal_mapping_id"],
        source_text=raw["source_text"],
        language=raw["language"],
        citations=citations,
        source_field=raw["source_field"],
        source_url=raw["source_url"],
        source_revision=raw["source_revision"],
        off_dataset_version_id=raw["off_dataset_version_id"],
        reference_dataset_version_id=raw["reference_dataset_version_id"],
        engine_version=raw["engine_version"],
    )


def deserialize_halal_assessment_evaluation(
    data: str,
) -> HalalIngredientAssessmentEvaluation:
    try:
        raw = json.loads(data)
        if not isinstance(raw, dict):
            raise ValueError("Evaluation data is not a JSON object")
        _require_fields(
            raw,
            {
                "schema_version",
                "status",
                "reason",
                "outcome",
                "evidence_coverage",
                "engine_version",
                "reference_dataset_version",
                "checked_evidence",
                "findings",
            },
            "evaluation",
        )
        if raw["schema_version"] != 1:
            raise ValueError("Unsupported Halal Assessment Evaluation cache schema")

        status = HalalIngredientAssessmentStatus(raw["status"])
        reason = (
            HalalIngredientAssessmentReason(raw["reason"])
            if raw["reason"] is not None
            else None
        )
        outcome = HalalIngredientAssessmentOutcome(raw["outcome"])
        evidence_coverage = EvidenceCoverageState(raw["evidence_coverage"])
        engine_version = raw["engine_version"]

        ref_dict = raw["reference_dataset_version"]
        ref_version = None
        if ref_dict is not None:
            if not isinstance(ref_dict, dict):
                raise ValueError("Reference Dataset Version is not an object")
            _require_fields(
                ref_dict,
                {
                    "id",
                    "source_url",
                    "retrieved_at",
                    "activated_at",
                    "sha256",
                    "review_kind",
                    "dataset_kind",
                },
                "reference_dataset_version",
            )
            ref_version = HalalAssessmentReferenceVersion(
                id=ref_dict["id"],
                source_url=ref_dict["source_url"],
                retrieved_at=datetime.fromisoformat(ref_dict["retrieved_at"]),
                activated_at=datetime.fromisoformat(ref_dict["activated_at"]),
                sha256=ref_dict["sha256"],
                review_kind=ref_dict["review_kind"],
                dataset_kind=ref_dict["dataset_kind"],
            )

        checked_evidence = tuple(
            _deserialize_source_signal(s)
            for s in _require_list(raw, "checked_evidence")
        )
        findings = tuple(
            _deserialize_halal_finding(f)
            for f in _require_list(raw, "findings")
        )

        return HalalIngredientAssessmentEvaluation(
            status=status,
            reason=reason,
            outcome=outcome,
            evidence_coverage=evidence_coverage,
            engine_version=engine_version,
            reference_dataset_version=ref_version,
            checked_evidence=checked_evidence,
            findings=findings,
        )
    except Exception as exc:
        raise ValueError(
            f"Failed to deserialize HalalIngredientAssessmentEvaluation: {exc}"
        ) from exc


class RedisHalalIngredientAssessmentCache:
    """Non-durable cache-aside adapter for HalalIngredientAssessmentEvaluation in Redis."""

    def __init__(
        self,
        client: RedisClientProtocol,
        *,
        ttl_seconds: int = DEFAULT_ASSESSMENT_CACHE_TTL_SECONDS,
    ) -> None:
        self._client = client
        self._ttl_seconds = ttl_seconds

    def get(self, key: str) -> HalalIngredientAssessmentEvaluation | None:
        try:
            raw = self._client.get(key)
            if raw is None:
                return None
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            return deserialize_halal_assessment_evaluation(raw)
        except ValueError:
            logger.warning(
                "Halal Assessment Evaluation cache entry rejected",
                extra={
                    "event": "halal_assessment_cache_invalid",
                    "dependency": "redis",
                    "operation": "deserialize_halal_assessment_evaluation",
                    "failure_category": "schema_or_payload",
                },
            )
            return None
        except Exception as exc:
            logger.warning(
                "Halal Assessment Evaluation cache read failed",
                extra={
                    "event": "halal_assessment_cache_read_failed",
                    "dependency": "redis",
                    "operation": "get_halal_assessment_evaluation",
                    "failure_category": "cache_error",
                    "error_category": type(exc).__name__,
                },
            )
            return None

    def set(self, key: str, value: HalalIngredientAssessmentEvaluation) -> None:
        try:
            serialized = serialize_halal_assessment_evaluation(value)
            self._client.set(key, serialized, ex=self._ttl_seconds)
        except Exception as exc:
            logger.warning(
                "Halal Assessment Evaluation cache write failed",
                extra={
                    "event": "halal_assessment_cache_write_failed",
                    "dependency": "redis",
                    "operation": "set_halal_assessment_evaluation",
                    "failure_category": "cache_error",
                    "error_category": type(exc).__name__,
                },
            )
