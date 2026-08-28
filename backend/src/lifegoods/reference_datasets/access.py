from __future__ import annotations

from datetime import UTC

from sqlalchemy.orm import Session, sessionmaker

from lifegoods.package_matches.assessments import AllergenAssessmentReferenceVersion
from lifegoods.reference_datasets.models import (
    ReferenceDatasetPointerRecord,
    ReferenceDatasetVersionRecord,
)


class DatabaseAllergenReferenceDataAccess:
    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def get_active_version(self) -> AllergenAssessmentReferenceVersion | None:
        try:
            with self._session_factory() as session:
                pointer = (
                    session.query(ReferenceDatasetPointerRecord)
                    .filter_by(dataset_kind="FOOD_ALLERGEN")
                    .first()
                )
                if pointer is None:
                    return None

                version = (
                    session.query(ReferenceDatasetVersionRecord)
                    .filter_by(id=pointer.active_version_id)
                    .first()
                )
                if (
                    version is None
                    or version.status not in {"READY", "ACTIVE", "SUPERSEDED"}
                    or version.validation_errors
                ):
                    return None

                retrieved_at = (
                    version.retrieved_at.replace(tzinfo=UTC)
                    if version.retrieved_at.tzinfo is None
                    else version.retrieved_at
                )
                activated_at = (
                    pointer.activated_at.replace(tzinfo=UTC)
                    if pointer.activated_at.tzinfo is None
                    else pointer.activated_at
                )

                return AllergenAssessmentReferenceVersion(
                    id=version.id,
                    source_url=version.source_url,
                    retrieved_at=retrieved_at,
                    activated_at=activated_at,
                    sha256=version.sha256,
                    review_kind=pointer.review_kind,
                    dataset_kind=pointer.dataset_kind,
                )
        except Exception:
            return None
