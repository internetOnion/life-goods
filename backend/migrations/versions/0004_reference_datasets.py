"""Create reference dataset versions, concepts, mappings, and rules tables."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reference_sources",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("source_url", sa.String(length=2048), nullable=False),
        sa.Column("jurisdiction", sa.String(length=64), nullable=False),
        sa.Column("publisher", sa.String(length=255), nullable=False),
        sa.Column("edition", sa.String(length=255), nullable=True),
        sa.Column("licensing_decision", sa.String(length=255), nullable=False),
        sa.Column("terms_version", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "reference_dataset_versions",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("dataset_kind", sa.String(length=32), nullable=False),
        sa.Column("edition", sa.String(length=255), nullable=True),
        sa.Column("jurisdiction", sa.String(length=64), nullable=False),
        sa.Column("source_url", sa.String(length=2048), nullable=False),
        sa.Column("licensing_decision", sa.String(length=255), nullable=False),
        sa.Column("sha256", sa.String(length=64), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("review_kind", sa.String(length=64), nullable=False),
        sa.Column("project_approver", sa.String(length=255), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "immutable",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "validation_errors",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
        sa.Column(
            "validation_history",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            server_default=sa.text("'[]'"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "dataset_kind IN ('FOOD_ALLERGEN', 'COELIAC_GLUTEN', "
            "'SULPHITE_SENSITIVITY', 'INTOLERANCE')",
            name="ck_ref_dataset_version_kind",
        ),
        sa.CheckConstraint(
            "status IN ('IMPORTING', 'READY', 'FAILED', 'ACTIVE', 'SUPERSEDED')",
            name="ck_ref_dataset_version_status",
        ),
        sa.CheckConstraint(
            "review_kind IN ('FOOD_DOMAIN_REVIEW', 'PROJECT_MAINTAINER_APPROVAL')",
            name="ck_ref_dataset_version_review_kind",
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "reference_concepts",
        sa.Column("dataset_version_id", sa.String(length=64), nullable=False),
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("condition_family", sa.String(length=32), nullable=False),
        sa.Column("parent_id", sa.String(length=64), nullable=True),
        sa.Column(
            "is_leaf",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
        sa.Column("description", sa.String(length=2048), nullable=True),
        sa.CheckConstraint(
            "condition_family IN ('FOOD_ALLERGEN', 'COELIAC_GLUTEN', "
            "'SULPHITE_SENSITIVITY', 'INTOLERANCE')",
            name="ck_ref_concept_condition_family",
        ),
        sa.ForeignKeyConstraint(
            ["dataset_version_id"],
            ["reference_dataset_versions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["dataset_version_id", "parent_id"],
            ["reference_concepts.dataset_version_id", "reference_concepts.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("dataset_version_id", "id"),
    )

    op.create_table(
        "lexical_mappings",
        sa.Column("dataset_version_id", sa.String(length=64), nullable=False),
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("concept_id", sa.String(length=64), nullable=False),
        sa.Column("language", sa.String(length=35), nullable=False),
        sa.Column("mapped_text", sa.String(length=255), nullable=False),
        sa.Column("relationship_type", sa.String(length=32), nullable=False),
        sa.Column("notes", sa.String(length=2048), nullable=True),
        sa.CheckConstraint(
            "relationship_type IN ('EXACT_NAME', 'SPELLING_VARIANT', 'DERIVED_FROM', "
            "'CONTAINS_SOURCE', 'PRECAUTIONARY_PHRASE')",
            name="ck_lexical_mapping_relationship_type",
        ),
        sa.ForeignKeyConstraint(
            ["dataset_version_id"],
            ["reference_dataset_versions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["dataset_version_id", "concept_id"],
            ["reference_concepts.dataset_version_id", "reference_concepts.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("dataset_version_id", "id"),
        sa.UniqueConstraint(
            "dataset_version_id", "language", "mapped_text", name="uq_lexical_mapping_text"
        ),
    )

    op.create_table(
        "allergen_rules",
        sa.Column("dataset_version_id", sa.String(length=64), nullable=False),
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("concept_id", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.Column("rule_kind", sa.String(length=32), nullable=False),
        sa.Column("condition_family", sa.String(length=32), nullable=False),
        sa.Column("description", sa.String(length=2048), nullable=True),
        sa.CheckConstraint(
            "rule_kind IN ('MANDATORY_DECLARATION', 'EXEMPTION', 'DERIVATIVE_MATCH', "
            "'PRECAUTIONARY')",
            name="ck_allergen_rule_kind",
        ),
        sa.CheckConstraint(
            "condition_family IN ('FOOD_ALLERGEN', 'COELIAC_GLUTEN', "
            "'SULPHITE_SENSITIVITY', 'INTOLERANCE')",
            name="ck_allergen_rule_condition_family",
        ),
        sa.ForeignKeyConstraint(
            ["dataset_version_id"],
            ["reference_dataset_versions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["dataset_version_id", "concept_id"],
            ["reference_concepts.dataset_version_id", "reference_concepts.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["source_id"],
            ["reference_sources.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("dataset_version_id", "id"),
    )


def downgrade() -> None:
    op.drop_table("allergen_rules")
    op.drop_table("lexical_mappings")
    op.drop_table("reference_concepts")
    op.drop_table("reference_dataset_versions")
    op.drop_table("reference_sources")
