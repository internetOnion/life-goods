"""Add the regional or national allergen declaration rule kind."""

from collections.abc import Sequence

from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_OLD_RULE_KINDS = (
    "'MANDATORY_DECLARATION', 'EXEMPTION', 'DERIVATIVE_MATCH', 'PRECAUTIONARY'"
)
_NEW_RULE_KINDS = (
    "'MANDATORY_DECLARATION', 'EXEMPTION', 'DERIVATIVE_MATCH', 'PRECAUTIONARY', "
    "'REGIONAL_OR_NATIONAL_DECLARATION'"
)


def _replace_rule_kind_constraint(allowed_kinds: str) -> None:
    with op.batch_alter_table("allergen_rules") as batch_op:
        batch_op.drop_constraint("ck_allergen_rule_kind", type_="check")
        batch_op.create_check_constraint(
            "ck_allergen_rule_kind", f"rule_kind IN ({allowed_kinds})"
        )


def upgrade() -> None:
    _replace_rule_kind_constraint(_NEW_RULE_KINDS)


def downgrade() -> None:
    _replace_rule_kind_constraint(_OLD_RULE_KINDS)
