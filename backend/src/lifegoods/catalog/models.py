from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lifegoods.adapters.database import Base


class ProductRecord(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    package_variants: Mapped[list["PackageVariantRecord"]] = relationship(
        back_populates="product", cascade="all, delete-orphan"
    )


class PackageVariantRecord(Base):
    __tablename__ = "package_variants"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"))
    product: Mapped[ProductRecord] = relationship(back_populates="package_variants")
    external_identifiers: Mapped[list["ExternalIdentifierRecord"]] = relationship(
        back_populates="package_variant", cascade="all, delete-orphan"
    )


class ExternalIdentifierRecord(Base):
    __tablename__ = "external_identifiers"
    __table_args__ = (
        UniqueConstraint("scheme", "normalized_value", name="uq_external_identifier_value"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    package_variant_id: Mapped[str] = mapped_column(
        ForeignKey("package_variants.id", ondelete="RESTRICT"), index=True
    )
    scheme: Mapped[str] = mapped_column(String(16))
    normalized_value: Mapped[str] = mapped_column(String(14), index=True)
    package_variant: Mapped[PackageVariantRecord] = relationship(
        back_populates="external_identifiers"
    )
