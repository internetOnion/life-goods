from datetime import date, datetime

from sqlalchemy import (
    JSON,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
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
    primary_for_identifiers: Mapped[list["ExternalIdentifierRecord"]] = relationship(
        back_populates="primary_evidence",
        foreign_keys="ExternalIdentifierRecord.primary_evidence_id",
    )
    identifier_links: Mapped[list["IdentifierEvidenceLinkRecord"]] = relationship(
        back_populates="evidence", cascade="all, delete-orphan"
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
            "production_method IN ('HUMAN_ENTRY', 'AI_EXTRACTION', 'EXTERNAL_IMPORT', "
            "'RULE_DERIVATION', 'REGISTRY_LOOKUP')",
            name="ck_external_identifier_production_method",
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
            postgresql_where=text("review_state <> 'DISPUTED'"),
            sqlite_where=text("review_state <> 'DISPUTED'"),
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    package_variant_id: Mapped[str] = mapped_column(
        ForeignKey("package_variants.id", ondelete="RESTRICT"), index=True
    )
    primary_evidence_id: Mapped[str] = mapped_column(ForeignKey("evidence.id", ondelete="RESTRICT"))
    scheme: Mapped[str] = mapped_column(String(16))
    normalized_value: Mapped[str] = mapped_column(String(14), index=True)
    validation_state: Mapped[str] = mapped_column(String(16))
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
    primary_evidence: Mapped[EvidenceRecord] = relationship(
        back_populates="primary_for_identifiers",
        foreign_keys=[primary_evidence_id],
    )
    evidence_links: Mapped[list["IdentifierEvidenceLinkRecord"]] = relationship(
        back_populates="external_identifier", cascade="all, delete-orphan"
    )


class IdentifierEvidenceLinkRecord(Base):
    __tablename__ = "external_identifier_evidence"
    __table_args__ = (
        CheckConstraint(
            "stance IN ('SUPPORTS', 'CONTRADICTS')",
            name="ck_external_identifier_evidence_stance",
        ),
    )

    external_identifier_id: Mapped[str] = mapped_column(
        ForeignKey("external_identifiers.id", ondelete="CASCADE"), primary_key=True
    )
    evidence_id: Mapped[str] = mapped_column(
        ForeignKey("evidence.id", ondelete="RESTRICT"), primary_key=True
    )
    stance: Mapped[str] = mapped_column(String(16))
    region_or_span: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    annotation: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    reviewer_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    external_identifier: Mapped[ExternalIdentifierRecord] = relationship(
        back_populates="evidence_links"
    )
    evidence: Mapped[EvidenceRecord] = relationship(back_populates="identifier_links")


class ExternalSourceRecord(Base):
    __tablename__ = "external_sources"
    __table_args__ = (
        UniqueConstraint("name", "base_url", name="uq_external_source_name_base_url"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[str] = mapped_column(String(64))
    base_url: Mapped[str] = mapped_column(String(2048))
    attribution: Mapped[str] = mapped_column(String(2048))
    database_license: Mapped[str] = mapped_column(String(255))
    contents_license: Mapped[str] = mapped_column(String(255))
    image_license: Mapped[str] = mapped_column(String(255))
    terms_version: Mapped[str | None] = mapped_column(String(255), nullable=True)
    snapshots: Mapped[list["ExternalSnapshotRecord"]] = relationship(
        back_populates="source", cascade="all, delete-orphan"
    )


class ExternalSnapshotRecord(Base):
    __tablename__ = "external_snapshots"
    __table_args__ = (
        CheckConstraint(
            "outcome IN ('FOUND', 'NOT_FOUND')",
            name="ck_external_snapshot_outcome",
        ),
        UniqueConstraint(
            "external_source_id",
            "source_record_id",
            "retrieved_at",
            name="uq_external_snapshot_version",
        ),
        Index(
            "ix_external_snapshot_latest_lookup",
            "external_source_id",
            "lookup_identifier",
            "retrieved_at",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    external_source_id: Mapped[str] = mapped_column(
        ForeignKey("external_sources.id", ondelete="RESTRICT")
    )
    source_record_id: Mapped[str] = mapped_column(String(255))
    lookup_identifier: Mapped[str] = mapped_column(String(14))
    request_url: Mapped[str] = mapped_column(String(4096))
    source_url: Mapped[str | None] = mapped_column(String(4096), nullable=True)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    fresh_until: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source_revision: Mapped[str | None] = mapped_column(String(255), nullable=True)
    outcome: Mapped[str] = mapped_column(String(16))
    raw_response: Mapped[dict[str, object]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql")
    )
    raw_response_hash: Mapped[str] = mapped_column(String(64))
    source: Mapped[ExternalSourceRecord] = relationship(back_populates="snapshots")
    field_evidence: Mapped[list["ExternalFieldEvidenceRecord"]] = relationship(
        back_populates="snapshot", cascade="all, delete-orphan"
    )


class ExternalFieldEvidenceRecord(Base):
    __tablename__ = "external_field_evidence"
    __table_args__ = (
        CheckConstraint(
            "category IN ('IDENTITY', 'LABEL', 'IMAGE')",
            name="ck_external_field_evidence_category",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    snapshot_id: Mapped[str] = mapped_column(
        ForeignKey("external_snapshots.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(16))
    mapped_field: Mapped[str] = mapped_column(String(64))
    source_field: Mapped[str] = mapped_column(String(255))
    value_json: Mapped[object] = mapped_column(JSON().with_variant(JSONB(), "postgresql"))
    language: Mapped[str | None] = mapped_column(String(35), nullable=True)
    observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source_uri: Mapped[str] = mapped_column(String(4096))
    attribution: Mapped[str] = mapped_column(Text)
    license_name: Mapped[str] = mapped_column(String(255))
    snapshot: Mapped[ExternalSnapshotRecord] = relationship(back_populates="field_evidence")
