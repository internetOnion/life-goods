from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from lifegoods.adapters.catalog_models import ExternalIdentifierRecord, PackageVariantRecord
from lifegoods.matching.identifier import NormalizedIdentifier
from lifegoods.matching.repository import PackageMatchCandidate


class SqlAlchemyPackageMatchRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def find_candidates(self, identifier: NormalizedIdentifier) -> list[PackageMatchCandidate]:
        statement = (
            select(PackageVariantRecord.id, PackageVariantRecord.product_id)
            .join(ExternalIdentifierRecord)
            .where(
                ExternalIdentifierRecord.normalized_value == identifier.value,
                ExternalIdentifierRecord.scheme == identifier.scheme,
                ExternalIdentifierRecord.validation_state == "VALID",
                ExternalIdentifierRecord.review_state.in_(("ACCEPTED", "DISPUTED")),
                or_(
                    ExternalIdentifierRecord.effective_from.is_(None),
                    ExternalIdentifierRecord.effective_from <= func.current_date(),
                ),
                or_(
                    ExternalIdentifierRecord.effective_to.is_(None),
                    ExternalIdentifierRecord.effective_to >= func.current_date(),
                ),
            )
            .order_by(PackageVariantRecord.id)
        )
        return [
            PackageMatchCandidate(package_variant_id=variant_id, product_id=product_id)
            for variant_id, product_id in self._session.execute(statement)
        ]
