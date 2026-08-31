"""Preserve Reference Dataset source membership and inactive pointer state."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reference_dataset_version_sources",
        sa.Column("dataset_version_id", sa.String(length=64), nullable=False),
        sa.Column("source_id", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(
            ["dataset_version_id"],
            ["reference_dataset_versions.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["source_id"],
            ["reference_sources.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("dataset_version_id", "source_id"),
    )

    with op.batch_alter_table("reference_dataset_pointers") as batch_op:
        batch_op.alter_column(
            "active_version_id",
            existing_type=sa.String(length=64),
            nullable=True,
        )


def downgrade() -> None:
    op.execute(
        "DELETE FROM reference_dataset_pointers WHERE active_version_id IS NULL"
    )
    with op.batch_alter_table("reference_dataset_pointers") as batch_op:
        batch_op.alter_column(
            "active_version_id",
            existing_type=sa.String(length=64),
            nullable=False,
        )

    op.drop_table("reference_dataset_version_sources")
