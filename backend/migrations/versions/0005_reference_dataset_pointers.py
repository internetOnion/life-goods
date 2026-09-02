"""Create reference dataset pointers table for atomic activation and rollback."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reference_dataset_pointers",
        sa.Column("dataset_kind", sa.String(length=32), nullable=False),
        sa.Column("active_version_id", sa.String(length=64), nullable=False),
        sa.Column("previous_version_id", sa.String(length=64), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("activated_by", sa.String(length=255), nullable=False),
        sa.Column("review_kind", sa.String(length=64), nullable=False),
        sa.CheckConstraint(
            "dataset_kind IN ('FOOD_ALLERGEN', 'COELIAC_GLUTEN', "
            "'SULPHITE_SENSITIVITY', 'INTOLERANCE')",
            name="ck_ref_dataset_pointer_kind",
        ),
        sa.CheckConstraint(
            "review_kind IN ('FOOD_DOMAIN_REVIEW', 'PROJECT_MAINTAINER_APPROVAL')",
            name="ck_ref_dataset_pointer_review_kind",
        ),
        sa.ForeignKeyConstraint(
            ["active_version_id"],
            ["reference_dataset_versions.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["previous_version_id"],
            ["reference_dataset_versions.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("dataset_kind"),
    )


def downgrade() -> None:
    op.drop_table("reference_dataset_pointers")
