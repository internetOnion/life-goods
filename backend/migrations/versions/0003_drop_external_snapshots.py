"""Remove relational Open Food Facts delivery snapshots.

This migration is intentionally destructive. Export any external snapshot history that
must be retained before upgrading; the pinned MongoDB dataset becomes the evidence record.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_index(
        op.f("ix_external_field_evidence_snapshot_id"),
        table_name="external_field_evidence",
    )
    op.drop_table("external_field_evidence")
    op.drop_index("ix_external_snapshot_latest_lookup", table_name="external_snapshots")
    op.drop_table("external_snapshots")
    op.drop_table("external_sources")


def downgrade() -> None:
    raise RuntimeError(
        "Migration 0003 is irreversible; restore relational OFF snapshots from backup"
    )
