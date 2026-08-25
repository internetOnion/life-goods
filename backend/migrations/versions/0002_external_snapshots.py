"""Persist external source snapshots and field-level evidence."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "external_sources",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("source_type", sa.String(length=64), nullable=False),
        sa.Column("base_url", sa.String(length=2048), nullable=False),
        sa.Column("attribution", sa.String(length=2048), nullable=False),
        sa.Column("database_license", sa.String(length=255), nullable=False),
        sa.Column("contents_license", sa.String(length=255), nullable=False),
        sa.Column("image_license", sa.String(length=255), nullable=False),
        sa.Column("terms_version", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", "base_url", name="uq_external_source_name_base_url"),
    )
    op.create_table(
        "external_snapshots",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("external_source_id", sa.String(length=64), nullable=False),
        sa.Column("source_record_id", sa.String(length=255), nullable=False),
        sa.Column("lookup_identifier", sa.String(length=14), nullable=False),
        sa.Column("request_url", sa.String(length=4096), nullable=False),
        sa.Column("source_url", sa.String(length=4096), nullable=True),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fresh_until", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_revision", sa.String(length=255), nullable=True),
        sa.Column("outcome", sa.String(length=16), nullable=False),
        sa.Column(
            "raw_response",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            nullable=False,
        ),
        sa.Column("raw_response_hash", sa.String(length=64), nullable=False),
        sa.CheckConstraint(
            "outcome IN ('FOUND', 'NOT_FOUND')",
            name="ck_external_snapshot_outcome",
        ),
        sa.ForeignKeyConstraint(
            ["external_source_id"], ["external_sources.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "external_source_id",
            "source_record_id",
            "retrieved_at",
            name="uq_external_snapshot_version",
        ),
    )
    op.create_index(
        "ix_external_snapshot_latest_lookup",
        "external_snapshots",
        ["external_source_id", "lookup_identifier", "retrieved_at"],
        unique=False,
    )
    op.create_table(
        "external_field_evidence",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("snapshot_id", sa.String(length=64), nullable=False),
        sa.Column("category", sa.String(length=16), nullable=False),
        sa.Column("mapped_field", sa.String(length=64), nullable=False),
        sa.Column("source_field", sa.String(length=255), nullable=False),
        sa.Column(
            "value_json",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            nullable=False,
        ),
        sa.Column("language", sa.String(length=35), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("retrieved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source_uri", sa.String(length=4096), nullable=False),
        sa.Column("attribution", sa.Text(), nullable=False),
        sa.Column("license_name", sa.String(length=255), nullable=False),
        sa.CheckConstraint(
            "category IN ('IDENTITY', 'LABEL', 'IMAGE')",
            name="ck_external_field_evidence_category",
        ),
        sa.ForeignKeyConstraint(
            ["snapshot_id"], ["external_snapshots.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_external_field_evidence_snapshot_id"),
        "external_field_evidence",
        ["snapshot_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_external_field_evidence_snapshot_id"),
        table_name="external_field_evidence",
    )
    op.drop_table("external_field_evidence")
    op.drop_index("ix_external_snapshot_latest_lookup", table_name="external_snapshots")
    op.drop_table("external_snapshots")
    op.drop_table("external_sources")
