"""Add lexical exclusions and mapping-linked derivative rules."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "lexical_exclusions",
        sa.Column("dataset_version_id", sa.String(length=64), nullable=False),
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("concept_id", sa.String(length=64), nullable=False),
        sa.Column("language", sa.String(length=35), nullable=False),
        sa.Column("excluded_text", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.String(length=2048), nullable=True),
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
            "dataset_version_id",
            "language",
            "concept_id",
            "excluded_text",
            name="uq_lexical_exclusion_text",
        ),
    )

    with op.batch_alter_table("allergen_rules") as batch_op:
        batch_op.add_column(sa.Column("mapping_id", sa.String(length=64), nullable=True))
        batch_op.create_foreign_key(
            "fk_allergen_rule_mapping",
            "lexical_mappings",
            ["dataset_version_id", "mapping_id"],
            ["dataset_version_id", "id"],
            ondelete="RESTRICT",
        )
        batch_op.create_check_constraint(
            "ck_allergen_rule_mapping_kind",
            "(rule_kind = 'DERIVATIVE_MATCH' AND mapping_id IS NOT NULL) OR "
            "(rule_kind != 'DERIVATIVE_MATCH' AND mapping_id IS NULL)",
        )


def downgrade() -> None:
    with op.batch_alter_table("allergen_rules") as batch_op:
        batch_op.drop_constraint("ck_allergen_rule_mapping_kind", type_="check")
        batch_op.drop_constraint("fk_allergen_rule_mapping", type_="foreignkey")
        batch_op.drop_column("mapping_id")

    op.drop_table("lexical_exclusions")
