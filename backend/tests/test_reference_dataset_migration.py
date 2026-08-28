from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, exc, inspect, text


def test_reference_dataset_migration_upgrades_and_downgrades(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database_path = tmp_path / "migration.db"
    database_url = f"sqlite+pysqlite:///{database_path}"
    monkeypatch.setenv("LIFEGOODS_DATABASE_URL", database_url)
    config = Config("backend/alembic.ini")

    # Upgrade to head (which includes 0005)
    command.upgrade(config, "head")

    engine = create_engine(database_url)
    table_names = set(inspect(engine).get_table_names())
    assert "reference_sources" in table_names
    assert "reference_dataset_versions" in table_names
    assert "reference_concepts" in table_names
    assert "lexical_mappings" in table_names
    assert "allergen_rules" in table_names
    assert "reference_dataset_pointers" in table_names

    # Verify inserting records across all tables
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO reference_sources "
                "(id, name, source_type, source_url, jurisdiction, publisher, edition, "
                "licensing_decision, terms_version) "
                "VALUES ('source-codex-2026', 'Codex CXS 1-1985', 'INTERNATIONAL_STANDARD', "
                "'https://fao.org', 'INTERNATIONAL', 'Codex Alimentarius Commission', '2026', "
                "'PUBLIC', '2026')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO reference_dataset_versions "
                "(id, dataset_kind, edition, jurisdiction, source_url, licensing_decision, "
                "sha256, retrieved_at, status, review_kind, project_approver, reviewed_at, "
                "activated_at, immutable, validation_errors, validation_history) "
                "VALUES ('ver-1', 'FOOD_ALLERGEN', '2026', 'INTERNATIONAL', 'https://fao.org', "
                "'PUBLIC', 'sha-hash-1', '2026-08-28 12:00:00', 'ACTIVE', 'FOOD_DOMAIN_REVIEW', "
                "'approver@test.org', '2026-08-28 12:00:00', '2026-08-28 12:00:00', 1, '[]', '[]')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO reference_concepts "
                "(dataset_version_id, id, name, condition_family, parent_id, is_leaf, "
                "description) "
                "VALUES ('ver-1', 'concept-milk', 'Milk', 'FOOD_ALLERGEN', NULL, 1, "
                "'Milk allergen')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO lexical_mappings "
                "(dataset_version_id, id, concept_id, language, mapped_text, "
                "relationship_type, notes) "
                "VALUES ('ver-1', 'map-milk-1', 'concept-milk', 'en', 'milk', 'EXACT_NAME', "
                "'Exact match')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO allergen_rules "
                "(dataset_version_id, id, concept_id, source_id, rule_kind, condition_family, "
                "description) "
                "VALUES ('ver-1', 'rule-milk-1', 'concept-milk', 'source-codex-2026', "
                "'MANDATORY_DECLARATION', 'FOOD_ALLERGEN', 'Codex rule')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO reference_dataset_pointers "
                "(dataset_kind, active_version_id, previous_version_id, activated_at, "
                "activated_by, review_kind) "
                "VALUES ('FOOD_ALLERGEN', 'ver-1', NULL, '2026-08-28 12:00:00', "
                "'approver@test.org', 'FOOD_DOMAIN_REVIEW')"
            )
        )

        row = connection.execute(
            text(
                "SELECT COUNT(*) FROM reference_dataset_pointers "
                "WHERE dataset_kind = 'FOOD_ALLERGEN'"
            )
        ).scalar()
        assert row == 1

        connection.execute(
            text(
                "INSERT INTO allergen_rules "
                "(dataset_version_id, id, concept_id, source_id, rule_kind, condition_family) "
                "VALUES ('ver-1', 'rule-regional-1', 'concept-milk', 'source-codex-2026', "
                "'REGIONAL_OR_NATIONAL_DECLARATION', 'FOOD_ALLERGEN')"
            )
        )
        connection.execute(text("DELETE FROM allergen_rules WHERE id = 'rule-regional-1'"))

    command.downgrade(config, "0005")
    with engine.begin() as connection, pytest.raises(exc.IntegrityError):
        connection.execute(
            text(
                "INSERT INTO allergen_rules "
                "(dataset_version_id, id, concept_id, source_id, rule_kind, condition_family) "
                "VALUES ('ver-1', 'rule-regional-2', 'concept-milk', 'source-codex-2026', "
                "'REGIONAL_OR_NATIONAL_DECLARATION', 'FOOD_ALLERGEN')"
            )
        )

    # Downgrade back to 0003
    command.downgrade(config, "0003")
    table_names_downgraded = set(inspect(engine).get_table_names())
    assert "reference_sources" not in table_names_downgraded
    assert "reference_dataset_versions" not in table_names_downgraded
    assert "reference_concepts" not in table_names_downgraded
    assert "lexical_mappings" not in table_names_downgraded
    assert "allergen_rules" not in table_names_downgraded
    assert "reference_dataset_pointers" not in table_names_downgraded
