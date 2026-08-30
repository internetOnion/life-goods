"""Add halal ingredient reference dataset tables and constraints."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_OLD_KINDS = "'FOOD_ALLERGEN', 'COELIAC_GLUTEN', 'SULPHITE_SENSITIVITY', 'INTOLERANCE'"
_NEW_KINDS = (
    "'FOOD_ALLERGEN', 'COELIAC_GLUTEN', 'SULPHITE_SENSITIVITY', 'INTOLERANCE', 'HALAL_INGREDIENT'"
)

_OLD_REVIEW_KINDS = "'FOOD_DOMAIN_REVIEW', 'PROJECT_MAINTAINER_APPROVAL'"
_NEW_REVIEW_KINDS = (
    "'FOOD_DOMAIN_REVIEW', 'PROJECT_MAINTAINER_APPROVAL', 'HALAL_DOMAIN_REVIEW'"
)


def upgrade() -> None:
    op.create_table(
        "halal_ingredient_mappings",
        sa.Column("dataset_version_id", sa.String(length=64), nullable=False),
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("concept_id", sa.String(length=64), nullable=False),
        sa.Column("classification", sa.String(length=32), nullable=False),
        sa.Column(
            "citations",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            nullable=False,
        ),
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
        sa.UniqueConstraint("dataset_version_id", "concept_id", name="uq_halal_mapping_concept"),
        sa.CheckConstraint(
            "classification IN ('EXPLICIT_PROHIBITED', 'SOURCE_AMBIGUOUS')",
            name="ck_halal_mapping_classification",
        ),
    )

    with op.batch_alter_table("reference_dataset_versions") as batch_op:
        batch_op.drop_constraint("ck_ref_dataset_version_kind", type_="check")
        batch_op.create_check_constraint(
            "ck_ref_dataset_version_kind",
            f"dataset_kind IN ({_NEW_KINDS})",
        )
        batch_op.drop_constraint("ck_ref_dataset_version_review_kind", type_="check")
        batch_op.create_check_constraint(
            "ck_ref_dataset_version_review_kind",
            f"review_kind IN ({_NEW_REVIEW_KINDS})",
        )

    with op.batch_alter_table("reference_concepts") as batch_op:
        batch_op.drop_constraint("ck_ref_concept_condition_family", type_="check")
        batch_op.create_check_constraint(
            "ck_ref_concept_condition_family",
            f"condition_family IN ({_NEW_KINDS})",
        )

    with op.batch_alter_table("reference_dataset_pointers") as batch_op:
        batch_op.drop_constraint("ck_ref_dataset_pointer_kind", type_="check")
        batch_op.create_check_constraint(
            "ck_ref_dataset_pointer_kind",
            f"dataset_kind IN ({_NEW_KINDS})",
        )
        batch_op.drop_constraint("ck_ref_dataset_pointer_review_kind", type_="check")
        batch_op.create_check_constraint(
            "ck_ref_dataset_pointer_review_kind",
            f"review_kind IN ({_NEW_REVIEW_KINDS})",
        )


def downgrade() -> None:
    op.drop_table("halal_ingredient_mappings")

    op.execute(
        "DELETE FROM reference_dataset_pointers WHERE dataset_kind = 'HALAL_INGREDIENT' "
        "OR review_kind = 'HALAL_DOMAIN_REVIEW'"
    )
    with op.batch_alter_table("reference_dataset_pointers") as batch_op:
        batch_op.drop_constraint("ck_ref_dataset_pointer_review_kind", type_="check")
        batch_op.create_check_constraint(
            "ck_ref_dataset_pointer_review_kind",
            f"review_kind IN ({_OLD_REVIEW_KINDS})",
        )
        batch_op.drop_constraint("ck_ref_dataset_pointer_kind", type_="check")
        batch_op.create_check_constraint(
            "ck_ref_dataset_pointer_kind",
            f"dataset_kind IN ({_OLD_KINDS})",
        )

    op.execute(
        "DELETE FROM lexical_mappings WHERE dataset_version_id IN "
        "(SELECT id FROM reference_dataset_versions WHERE dataset_kind = 'HALAL_INGREDIENT')"
    )
    op.execute(
        "DELETE FROM reference_concepts WHERE condition_family = 'HALAL_INGREDIENT' "
        "OR dataset_version_id IN ("
        "SELECT id FROM reference_dataset_versions WHERE dataset_kind = 'HALAL_INGREDIENT')"
    )
    with op.batch_alter_table("reference_concepts") as batch_op:
        batch_op.drop_constraint("ck_ref_concept_condition_family", type_="check")
        batch_op.create_check_constraint(
            "ck_ref_concept_condition_family",
            f"condition_family IN ({_OLD_KINDS})",
        )

    op.execute(
        "DELETE FROM reference_dataset_versions WHERE dataset_kind = 'HALAL_INGREDIENT' "
        "OR review_kind = 'HALAL_DOMAIN_REVIEW'"
    )
    with op.batch_alter_table("reference_dataset_versions") as batch_op:
        batch_op.drop_constraint("ck_ref_dataset_version_review_kind", type_="check")
        batch_op.create_check_constraint(
            "ck_ref_dataset_version_review_kind",
            f"review_kind IN ({_OLD_REVIEW_KINDS})",
        )
        batch_op.drop_constraint("ck_ref_dataset_version_kind", type_="check")
        batch_op.create_check_constraint(
            "ck_ref_dataset_version_kind",
            f"dataset_kind IN ({_OLD_KINDS})",
        )
