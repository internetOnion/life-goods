"""Create the Product identifier lookup foundation."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "package_variants",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("product_id", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "external_identifiers",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("package_variant_id", sa.String(length=64), nullable=False),
        sa.Column("scheme", sa.String(length=16), nullable=False),
        sa.Column("normalized_value", sa.String(length=14), nullable=False),
        sa.ForeignKeyConstraint(
            ["package_variant_id"], ["package_variants.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scheme", "normalized_value", name="uq_external_identifier_value"),
    )
    op.create_index(
        op.f("ix_external_identifiers_normalized_value"),
        "external_identifiers",
        ["normalized_value"],
        unique=False,
    )
    op.create_index(
        op.f("ix_external_identifiers_package_variant_id"),
        "external_identifiers",
        ["package_variant_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_external_identifiers_package_variant_id"),
        table_name="external_identifiers",
    )
    op.drop_index(
        op.f("ix_external_identifiers_normalized_value"), table_name="external_identifiers"
    )
    op.drop_table("external_identifiers")
    op.drop_table("package_variants")
    op.drop_table("products")
