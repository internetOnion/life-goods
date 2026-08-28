from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from lifegoods.core.database import Base


class ReferenceSourceRecord(Base):
    __tablename__ = "reference_sources"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False)
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    jurisdiction: Mapped[str] = mapped_column(String(64), nullable=False)
    publisher: Mapped[str] = mapped_column(String(255), nullable=False)
    edition: Mapped[str | None] = mapped_column(String(255), nullable=True)
    licensing_decision: Mapped[str] = mapped_column(String(255), nullable=False)
    terms_version: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=text("CURRENT_TIMESTAMP"),
        nullable=False,
    )


class ReferenceDatasetVersionRecord(Base):
    __tablename__ = "reference_dataset_versions"
    __table_args__ = (
        CheckConstraint(
            "dataset_kind IN ('FOOD_ALLERGEN', 'COELIAC_GLUTEN', "
            "'SULPHITE_SENSITIVITY', 'INTOLERANCE')",
            name="ck_ref_dataset_version_kind",
        ),
        CheckConstraint(
            "status IN ('IMPORTING', 'READY', 'FAILED', 'ACTIVE', 'SUPERSEDED')",
            name="ck_ref_dataset_version_status",
        ),
        CheckConstraint(
            "review_kind IN ('FOOD_DOMAIN_REVIEW', 'PROJECT_MAINTAINER_APPROVAL')",
            name="ck_ref_dataset_version_review_kind",
        ),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    dataset_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    edition: Mapped[str | None] = mapped_column(String(255), nullable=True)
    jurisdiction: Mapped[str] = mapped_column(String(64), nullable=False)
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    licensing_decision: Mapped[str] = mapped_column(String(255), nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    review_kind: Mapped[str] = mapped_column(String(64), nullable=False)
    project_approver: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    immutable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    validation_errors: Mapped[list[str]] = mapped_column(
        JSON().with_variant(postgresql.JSONB(astext_type=Text()), "postgresql"),
        default=list,
        nullable=False,
    )
    validation_history: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON().with_variant(postgresql.JSONB(astext_type=Text()), "postgresql"),
        default=list,
        nullable=False,
    )

    concepts: Mapped[list[ReferenceConceptRecord]] = relationship(
        back_populates="dataset_version", cascade="all, delete-orphan"
    )
    mappings: Mapped[list[LexicalMappingRecord]] = relationship(
        back_populates="dataset_version", cascade="all, delete-orphan", overlaps="concept,mappings"
    )
    rules: Mapped[list[AllergenRuleRecord]] = relationship(
        back_populates="dataset_version", cascade="all, delete-orphan", overlaps="concept,rules"
    )


class ReferenceConceptRecord(Base):
    __tablename__ = "reference_concepts"
    __table_args__ = (
        ForeignKeyConstraint(
            ["dataset_version_id", "parent_id"],
            ["reference_concepts.dataset_version_id", "reference_concepts.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "condition_family IN ('FOOD_ALLERGEN', 'COELIAC_GLUTEN', "
            "'SULPHITE_SENSITIVITY', 'INTOLERANCE')",
            name="ck_ref_concept_condition_family",
        ),
    )

    dataset_version_id: Mapped[str] = mapped_column(
        ForeignKey("reference_dataset_versions.id", ondelete="CASCADE"), primary_key=True
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    condition_family: Mapped[str] = mapped_column(String(32), nullable=False)
    parent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_leaf: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    dataset_version: Mapped[ReferenceDatasetVersionRecord] = relationship(
        back_populates="concepts"
    )
    mappings: Mapped[list[LexicalMappingRecord]] = relationship(
        back_populates="concept",
        cascade="all, delete-orphan",
        foreign_keys="[LexicalMappingRecord.dataset_version_id, LexicalMappingRecord.concept_id]",
        overlaps="dataset_version,mappings",
    )
    rules: Mapped[list[AllergenRuleRecord]] = relationship(
        back_populates="concept",
        cascade="all, delete-orphan",
        foreign_keys="[AllergenRuleRecord.dataset_version_id, AllergenRuleRecord.concept_id]",
        overlaps="dataset_version,rules",
    )


class LexicalMappingRecord(Base):
    __tablename__ = "lexical_mappings"
    __table_args__ = (
        ForeignKeyConstraint(
            ["dataset_version_id", "concept_id"],
            ["reference_concepts.dataset_version_id", "reference_concepts.id"],
            ondelete="RESTRICT",
        ),
        UniqueConstraint(
            "dataset_version_id", "language", "mapped_text", name="uq_lexical_mapping_text"
        ),
        CheckConstraint(
            "relationship_type IN ('EXACT_NAME', 'SPELLING_VARIANT', 'DERIVED_FROM', "
            "'CONTAINS_SOURCE', 'PRECAUTIONARY_PHRASE')",
            name="ck_lexical_mapping_relationship_type",
        ),
    )

    dataset_version_id: Mapped[str] = mapped_column(
        ForeignKey("reference_dataset_versions.id", ondelete="CASCADE"), primary_key=True
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    concept_id: Mapped[str] = mapped_column(String(64), nullable=False)
    language: Mapped[str] = mapped_column(String(35), nullable=False)
    mapped_text: Mapped[str] = mapped_column(String(255), nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    dataset_version: Mapped[ReferenceDatasetVersionRecord] = relationship(
        back_populates="mappings",
        overlaps="concept,mappings",
    )
    concept: Mapped[ReferenceConceptRecord] = relationship(
        back_populates="mappings",
        foreign_keys=[dataset_version_id, concept_id],
        overlaps="dataset_version,mappings",
    )


class AllergenRuleRecord(Base):
    __tablename__ = "allergen_rules"
    __table_args__ = (
        ForeignKeyConstraint(
            ["dataset_version_id", "concept_id"],
            ["reference_concepts.dataset_version_id", "reference_concepts.id"],
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "rule_kind IN ('MANDATORY_DECLARATION', 'EXEMPTION', 'DERIVATIVE_MATCH', "
            "'PRECAUTIONARY', 'REGIONAL_OR_NATIONAL_DECLARATION')",
            name="ck_allergen_rule_kind",
        ),
        CheckConstraint(
            "condition_family IN ('FOOD_ALLERGEN', 'COELIAC_GLUTEN', "
            "'SULPHITE_SENSITIVITY', 'INTOLERANCE')",
            name="ck_allergen_rule_condition_family",
        ),
    )

    dataset_version_id: Mapped[str] = mapped_column(
        ForeignKey("reference_dataset_versions.id", ondelete="CASCADE"), primary_key=True
    )
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    concept_id: Mapped[str] = mapped_column(String(64), nullable=False)
    source_id: Mapped[str] = mapped_column(
        ForeignKey("reference_sources.id", ondelete="RESTRICT"), nullable=False
    )
    rule_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    condition_family: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2048), nullable=True)

    dataset_version: Mapped[ReferenceDatasetVersionRecord] = relationship(
        back_populates="rules",
        overlaps="concept,rules",
    )
    concept: Mapped[ReferenceConceptRecord] = relationship(
        back_populates="rules",
        foreign_keys=[dataset_version_id, concept_id],
        overlaps="dataset_version,rules",
    )
    source: Mapped[ReferenceSourceRecord] = relationship()


class ReferenceDatasetPointerRecord(Base):
    __tablename__ = "reference_dataset_pointers"
    __table_args__ = (
        CheckConstraint(
            "dataset_kind IN ('FOOD_ALLERGEN', 'COELIAC_GLUTEN', "
            "'SULPHITE_SENSITIVITY', 'INTOLERANCE')",
            name="ck_ref_dataset_pointer_kind",
        ),
        CheckConstraint(
            "review_kind IN ('FOOD_DOMAIN_REVIEW', 'PROJECT_MAINTAINER_APPROVAL')",
            name="ck_ref_dataset_pointer_review_kind",
        ),
    )

    dataset_kind: Mapped[str] = mapped_column(String(32), primary_key=True)
    active_version_id: Mapped[str] = mapped_column(
        ForeignKey("reference_dataset_versions.id", ondelete="RESTRICT"),
        nullable=False,
    )
    previous_version_id: Mapped[str | None] = mapped_column(
        ForeignKey("reference_dataset_versions.id", ondelete="RESTRICT"),
        nullable=True,
    )
    activated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    activated_by: Mapped[str] = mapped_column(String(255), nullable=False)
    review_kind: Mapped[str] = mapped_column(String(64), nullable=False)

    active_version: Mapped[ReferenceDatasetVersionRecord] = relationship(
        foreign_keys=[active_version_id]
    )
    previous_version: Mapped[ReferenceDatasetVersionRecord | None] = relationship(
        foreign_keys=[previous_version_id]
    )
