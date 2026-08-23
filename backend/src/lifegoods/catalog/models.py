from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Table,
    text,
)
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


external_identifier_evidence = Table(
    "external_identifier_evidence",
    Base.metadata,
    Column(
        "external_identifier_id",
        ForeignKey("external_identifiers.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "evidence_id",
        ForeignKey("evidence.id", ondelete="RESTRICT"),
        primary_key=True,
    ),
)


class EvidenceRecord(Base):
    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source_uri: Mapped[str] = mapped_column(String(2048))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    external_identifiers: Mapped[list["ExternalIdentifierRecord"]] = relationship(
        secondary=external_identifier_evidence,
        back_populates="evidence",
    )


class ExternalIdentifierRecord(Base):
    __tablename__ = "external_identifiers"
    __table_args__ = (
        CheckConstraint(
            "scheme IN ('GTIN_8', 'UPC_A', 'EAN_13', 'GTIN_14')",
            name="ck_external_identifier_scheme",
        ),
        CheckConstraint(
            "validation_state IN ('VALID', 'INVALID', 'UNVERIFIED')",
            name="ck_external_identifier_validation_state",
        ),
        CheckConstraint(
            "association_state IN ('ACCEPTED', 'DISPUTED')",
            name="ck_external_identifier_association_state",
        ),
        CheckConstraint(
            "effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from",
            name="ck_external_identifier_effective_period",
        ),
        Index(
            "uq_active_external_identifier_value",
            "scheme",
            "normalized_value",
            unique=True,
            postgresql_where=text("association_state <> 'DISPUTED'"),
            sqlite_where=text("association_state <> 'DISPUTED'"),
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    package_variant_id: Mapped[str] = mapped_column(
        ForeignKey("package_variants.id", ondelete="RESTRICT"), index=True
    )
    scheme: Mapped[str] = mapped_column(String(16))
    normalized_value: Mapped[str] = mapped_column(String(14), index=True)
    validation_state: Mapped[str] = mapped_column(String(16))
    association_state: Mapped[str] = mapped_column(String(16), default="ACCEPTED")
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    package_variant: Mapped[PackageVariantRecord] = relationship(
        back_populates="external_identifiers"
    )
    evidence: Mapped[list[EvidenceRecord]] = relationship(
        secondary=external_identifier_evidence,
        back_populates="external_identifiers",
    )
