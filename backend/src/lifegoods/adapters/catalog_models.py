from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
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


class EvidenceRecord(Base):
    __tablename__ = "evidence"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    evidence_type: Mapped[str] = mapped_column(String(32))
    source_name: Mapped[str] = mapped_column(String(255))
    source_uri: Mapped[str] = mapped_column(String(2048))
    language: Mapped[str] = mapped_column(String(35))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    license_name: Mapped[str] = mapped_column(String(255))
    integrity_hash: Mapped[str] = mapped_column(String(128))
    storage_reference: Mapped[str] = mapped_column(String(2048))
    external_identifiers: Mapped[list["ExternalIdentifierRecord"]] = relationship(
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
            "review_state IN ('PROPOSED', 'ACCEPTED', 'DISPUTED', 'REJECTED', "
            "'SUPERSEDED', 'WITHDRAWN')",
            name="ck_external_identifier_review_state",
        ),
        CheckConstraint(
            "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
            name="ck_external_identifier_confidence",
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
    evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence.id", ondelete="RESTRICT"))
    scheme: Mapped[str] = mapped_column(String(16))
    normalized_value: Mapped[str] = mapped_column(String(14), index=True)
    validation_state: Mapped[str] = mapped_column(String(16))
    association_state: Mapped[str] = mapped_column(String(16), default="ACCEPTED")
    production_method: Mapped[str] = mapped_column(String(32))
    review_state: Mapped[str] = mapped_column(String(16))
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    superseded_by_id: Mapped[str | None] = mapped_column(
        ForeignKey("external_identifiers.id", ondelete="RESTRICT"), nullable=True
    )
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    package_variant: Mapped[PackageVariantRecord] = relationship(
        back_populates="external_identifiers"
    )
    evidence: Mapped[EvidenceRecord] = relationship(back_populates="external_identifiers")
