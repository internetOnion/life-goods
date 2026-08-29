from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from lifegoods.reference_datasets.bundle import ConditionFamily, ReferenceReviewKind
from lifegoods.reference_datasets.importer import (
    ReferenceDatasetError,
    ReferenceDatasetValidationError,
)
from lifegoods.reference_datasets.models import (
    ReferenceDatasetPointerRecord,
    ReferenceDatasetVersionRecord,
    ReferenceSourceRecord,
)


class ReferenceDatasetNotFoundError(ReferenceDatasetError):
    pass


class ReferenceDatasetApprovalError(ReferenceDatasetError):
    pass


class ReferenceDatasetRollbackError(ReferenceDatasetError):
    pass


class ReferenceDatasetInactiveError(ReferenceDatasetError):
    pass


def get_active_reference_dataset_pointer(
    session: Session,
    dataset_kind: str | ConditionFamily = ConditionFamily.FOOD_ALLERGEN,
) -> ReferenceDatasetPointerRecord | None:
    resolved_kind = (
        dataset_kind.value if isinstance(dataset_kind, ConditionFamily) else str(dataset_kind)
    )
    return (
        session.query(ReferenceDatasetPointerRecord)
        .filter_by(dataset_kind=resolved_kind)
        .first()
    )


def _get_locked_pointer(
    session: Session, dataset_kind: str
) -> ReferenceDatasetPointerRecord | None:
    pointer_query = session.query(ReferenceDatasetPointerRecord).filter_by(
        dataset_kind=dataset_kind
    )
    try:
        return pointer_query.with_for_update().first()
    except Exception:
        return pointer_query.first()


def activate_reference_dataset_version(
    session: Session,
    version_id: str,
    *,
    approver: str | None = None,
    review_kind: str | ReferenceReviewKind | None = None,
    now: Callable[[], datetime] | None = None,
) -> ReferenceDatasetVersionRecord:
    version = (
        session.query(ReferenceDatasetVersionRecord)
        .filter_by(id=version_id)
        .first()
    )
    if version is None:
        raise ReferenceDatasetNotFoundError(
            f"Reference dataset version '{version_id}' does not exist"
        )

    if not version.immutable:
        raise ReferenceDatasetValidationError(
            f"Reference dataset version '{version_id}' is not immutable"
        )

    if version.status in {"FAILED", "IMPORTING"}:
        raise ReferenceDatasetValidationError(
            f"Reference dataset version '{version_id}' has status '{version.status}' "
            f"and cannot be activated"
        )

    if version.validation_errors:
        raise ReferenceDatasetValidationError(
            f"Reference dataset version '{version_id}' has validation errors: "
            f"{'; '.join(version.validation_errors)}"
        )

    if not version.source_url or not version.licensing_decision or not version.jurisdiction:
        raise ReferenceDatasetValidationError(
            f"Reference dataset version '{version_id}' is missing required metadata"
        )

    for rule in version.rules:
        source = (
            rule.source
            or session.query(ReferenceSourceRecord).filter_by(id=rule.source_id).first()
        )
        if (
            source is None
            or not source.source_url
            or not source.licensing_decision
            or not source.jurisdiction
            or not source.name
            or not source.publisher
        ):
            raise ReferenceDatasetValidationError(
                f"Reference dataset version '{version_id}' references missing or "
                f"incomplete source '{rule.source_id}'"
            )

    final_approver = approver or version.project_approver
    if not final_approver or not str(final_approver).strip():
        raise ReferenceDatasetApprovalError(
            "Activation requires recorded project-maintainer approval"
        )

    resolved_review_kind = (
        review_kind.value if isinstance(review_kind, ReferenceReviewKind) else review_kind
    )
    final_review_kind = resolved_review_kind or version.review_kind
    valid_review_kinds = {
        ReferenceReviewKind.FOOD_DOMAIN_REVIEW.value,
        ReferenceReviewKind.PROJECT_MAINTAINER_APPROVAL.value,
        "FOOD_DOMAIN_REVIEW",
        "PROJECT_MAINTAINER_APPROVAL",
    }
    if final_review_kind not in valid_review_kinds:
        raise ReferenceDatasetApprovalError(
            f"Invalid review kind '{final_review_kind}'"
        )

    utc_now = (now or (lambda: datetime.now(UTC)))()

    def _apply_activation(target_version: ReferenceDatasetVersionRecord) -> None:
        pointer = _get_locked_pointer(session, target_version.dataset_kind)

        if pointer is not None:
            current_active_id = pointer.active_version_id
            if current_active_id != version_id:
                current_version = (
                    session.query(ReferenceDatasetVersionRecord)
                    .filter_by(id=current_active_id)
                    .first()
                )
                if current_version is not None:
                    current_version.status = "SUPERSEDED"
                pointer.previous_version_id = current_active_id
                pointer.active_version_id = version_id
            pointer.activated_at = utc_now
            pointer.activated_by = final_approver
            pointer.review_kind = final_review_kind
        else:
            pointer = ReferenceDatasetPointerRecord(
                dataset_kind=target_version.dataset_kind,
                active_version_id=version_id,
                previous_version_id=None,
                activated_at=utc_now,
                activated_by=final_approver,
                review_kind=final_review_kind,
            )
            session.add(pointer)

        target_version.status = "ACTIVE"
        target_version.activated_at = utc_now
        target_version.project_approver = final_approver
        target_version.review_kind = final_review_kind
        if target_version.reviewed_at is None:
            target_version.reviewed_at = utc_now

        session.commit()

    try:
        _apply_activation(version)
    except IntegrityError:
        session.rollback()
        reloaded_version = (
            session.query(ReferenceDatasetVersionRecord)
            .filter_by(id=version_id)
            .first()
        )
        if reloaded_version is None:
            raise ReferenceDatasetNotFoundError(
                f"Reference dataset version '{version_id}' does not exist"
            ) from None
        _apply_activation(reloaded_version)
        version = reloaded_version

    session.refresh(version)
    return version


def rollback_reference_dataset_version(
    session: Session,
    *,
    dataset_kind: str | ConditionFamily = ConditionFamily.FOOD_ALLERGEN,
    approver: str | None = None,
    now: Callable[[], datetime] | None = None,
) -> ReferenceDatasetVersionRecord:
    resolved_kind = (
        dataset_kind.value if isinstance(dataset_kind, ConditionFamily) else str(dataset_kind)
    )
    utc_now = (now or (lambda: datetime.now(UTC)))()

    pointer = _get_locked_pointer(session, resolved_kind)

    if pointer is None or pointer.previous_version_id is None:
        raise ReferenceDatasetRollbackError(
            "No previous reference dataset version is available for rollback"
        )

    previous_id = pointer.previous_version_id
    current_id = pointer.active_version_id

    previous_version = (
        session.query(ReferenceDatasetVersionRecord)
        .filter_by(id=previous_id)
        .first()
    )
    if previous_version is None:
        raise ReferenceDatasetRollbackError(
            f"Previous reference dataset version '{previous_id}' does not exist"
        )

    if not previous_version.immutable:
        raise ReferenceDatasetRollbackError(
            f"Previous reference dataset version '{previous_id}' is not immutable"
        )

    if previous_version.status in {"FAILED", "IMPORTING"} or previous_version.validation_errors:
        raise ReferenceDatasetRollbackError(
            f"Previous reference dataset version '{previous_id}' is invalid or failed"
        )

    current_version = (
        session.query(ReferenceDatasetVersionRecord)
        .filter_by(id=current_id)
        .first()
    )
    if current_version is not None:
        current_version.status = "SUPERSEDED"

    previous_version.status = "ACTIVE"
    previous_version.activated_at = utc_now

    pointer.active_version_id = previous_id
    pointer.previous_version_id = None
    pointer.activated_at = utc_now
    pointer.review_kind = previous_version.review_kind
    pointer.activated_by = approver or previous_version.project_approver or pointer.activated_by

    session.commit()
    session.refresh(previous_version)
    return previous_version
