from sqlalchemy import select
from sqlalchemy.orm import Session

from lifegoods.adapters.catalog_models import ExternalIdentifierRecord, PackageVariantRecord
from lifegoods.matching.repository import PackageMatchCandidate


class SqlAlchemyPackageMatchRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def find_candidates(self, normalized_identifier: str) -> list[PackageMatchCandidate]:
        statement = (
            select(PackageVariantRecord.id, PackageVariantRecord.product_id)
            .join(ExternalIdentifierRecord)
            .where(ExternalIdentifierRecord.normalized_value == normalized_identifier)
            .order_by(PackageVariantRecord.id)
        )
        return [
            PackageMatchCandidate(package_variant_id=variant_id, product_id=product_id)
            for variant_id, product_id in self._session.execute(statement)
        ]
