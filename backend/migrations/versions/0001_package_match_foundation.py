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
        "evidence",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("evidence_type", sa.String(length=32), nullable=False),
        sa.Column("source_name", sa.String(length=255), nullable=False),
        sa.Column("source_uri", sa.String(length=2048), nullable=False),
        sa.Column("language", sa.String(length=35), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("license_name", sa.String(length=255), nullable=False),
        sa.Column("integrity_hash", sa.String(length=128), nullable=False),
        sa.Column("storage_reference", sa.String(length=2048), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "external_identifiers",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("package_variant_id", sa.String(length=64), nullable=False),
        sa.Column("evidence_id", sa.String(length=64), nullable=False),
        sa.Column("scheme", sa.String(length=16), nullable=False),
        sa.Column("normalized_value", sa.String(length=14), nullable=False),
        sa.Column("validation_state", sa.String(length=16), nullable=False),
        sa.Column("association_state", sa.String(length=16), nullable=False),
        sa.Column("production_method", sa.String(length=32), nullable=False),
        sa.Column("review_state", sa.String(length=16), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("superseded_by_id", sa.String(length=64), nullable=True),
        sa.Column("effective_from", sa.Date(), nullable=True),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.CheckConstraint(
            "association_state IN ('ACCEPTED', 'DISPUTED')",
            name="ck_external_identifier_association_state",
        ),
        sa.CheckConstraint(
            "confidence IS NULL OR (confidence >= 0 AND confidence <= 1)",
            name="ck_external_identifier_confidence",
        ),
        sa.CheckConstraint(
            "effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from",
            name="ck_external_identifier_effective_period",
        ),
        sa.CheckConstraint(
            "review_state IN ('PROPOSED', 'ACCEPTED', 'DISPUTED', 'REJECTED', "
            "'SUPERSEDED', 'WITHDRAWN')",
            name="ck_external_identifier_review_state",
        ),
        sa.CheckConstraint(
            "scheme IN ('GTIN_8', 'UPC_A', 'EAN_13', 'GTIN_14')",
            name="ck_external_identifier_scheme",
        ),
        sa.CheckConstraint(
            "validation_state IN ('VALID', 'INVALID', 'UNVERIFIED')",
            name="ck_external_identifier_validation_state",
        ),
        sa.ForeignKeyConstraint(["evidence_id"], ["evidence.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(
            ["package_variant_id"], ["package_variants.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["superseded_by_id"], ["external_identifiers.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_external_identifiers_normalized_value"),
        "external_identifiers",
        ["normalized_value"],
        unique=False,
    )
    op.create_index(
        "uq_active_external_identifier_value",
        "external_identifiers",
        ["scheme", "normalized_value"],
        unique=True,
        postgresql_where=sa.text("association_state <> 'DISPUTED'"),
        sqlite_where=sa.text("association_state <> 'DISPUTED'"),
    )
    op.create_index(
        op.f("ix_external_identifiers_package_variant_id"),
        "external_identifiers",
        ["package_variant_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("uq_active_external_identifier_value", table_name="external_identifiers")
    op.drop_index(
        op.f("ix_external_identifiers_package_variant_id"),
        table_name="external_identifiers",
    )
    op.drop_index(
        op.f("ix_external_identifiers_normalized_value"), table_name="external_identifiers"
    )
    op.drop_table("external_identifiers")
    op.drop_table("evidence")
    op.drop_table("package_variants")
    op.drop_table("products")
