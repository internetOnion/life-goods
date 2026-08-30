from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, exc, inspect, text


def test_matching_hardening_migration_enforces_exclusions_and_derivative_links(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database_path = tmp_path / "matching-hardening.db"
    database_url = f"sqlite+pysqlite:///{database_path}"
    monkeypatch.setenv("LIFEGOODS_DATABASE_URL", database_url)
    config = Config("backend/alembic.ini")
    command.upgrade(config, "head")

    engine = create_engine(database_url)
    assert "lexical_exclusions" in inspect(engine).get_table_names()
    assert "mapping_id" in {
        column["name"] for column in inspect(engine).get_columns("allergen_rules")
    }

    with engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(
            text(
                "INSERT INTO reference_sources "
                "(id, name, source_type, source_url, jurisdiction, publisher, "
                "licensing_decision) VALUES "
                "('source-review', 'Reviewed mappings', 'PROJECT_REVIEWED_VOCABULARY', "
                "'https://github.com/internetOnion/life-goods/issues/63', 'PROJECT_SCOPE', "
                "'LifeGoods', 'PROJECT_AUTHORED')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO reference_dataset_versions "
                "(id, dataset_kind, jurisdiction, source_url, licensing_decision, sha256, "
                "retrieved_at, status, review_kind, immutable, validation_errors, "
                "validation_history) VALUES "
                "('ver-1', 'FOOD_ALLERGEN', 'PROJECT_SCOPE', 'https://example.test', "
                "'PROJECT_AUTHORED', 'hash', '2026-08-29', 'READY', "
                "'FOOD_DOMAIN_REVIEW', 1, '[]', '[]')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO reference_concepts "
                "(dataset_version_id, id, name, condition_family, is_leaf) VALUES "
                "('ver-1', 'concept-milk', 'Milk', 'FOOD_ALLERGEN', 1)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO lexical_mappings "
                "(dataset_version_id, id, concept_id, language, mapped_text, "
                "relationship_type) VALUES "
                "('ver-1', 'map-whey', 'concept-milk', 'en', 'whey', 'DERIVED_FROM')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO lexical_exclusions "
                "(dataset_version_id, id, concept_id, language, excluded_text) VALUES "
                "('ver-1', 'exclude-coconut-milk', 'concept-milk', 'en', 'coconut milk')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO allergen_rules "
                "(dataset_version_id, id, concept_id, source_id, rule_kind, "
                "condition_family, mapping_id) VALUES "
                "('ver-1', 'rule-whey', 'concept-milk', 'source-review', "
                "'DERIVATIVE_MATCH', 'FOOD_ALLERGEN', 'map-whey')"
            )
        )
        assert connection.execute(
            text(
                "SELECT excluded_text FROM lexical_exclusions "
                "WHERE dataset_version_id = 'ver-1' AND id = 'exclude-coconut-milk'"
            )
        ).scalar_one() == "coconut milk"

        connection.execute(
            text(
                "INSERT INTO reference_dataset_versions "
                "(id, dataset_kind, jurisdiction, source_url, licensing_decision, sha256, "
                "retrieved_at, status, review_kind, immutable, validation_errors, "
                "validation_history) VALUES "
                "('halal-ver-1', 'HALAL_INGREDIENT', 'PROJECT_SCOPE', "
                "'https://example.test/halal', 'PROJECT_AUTHORED', 'halal-hash', "
                "'2026-08-30', 'READY', 'HALAL_DOMAIN_REVIEW', 1, '[]', '[]')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO reference_concepts "
                "(dataset_version_id, id, name, condition_family, is_leaf) VALUES "
                "('halal-ver-1', 'concept-pork', 'Pork', 'HALAL_INGREDIENT', 1)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO lexical_exclusions "
                "(dataset_version_id, id, concept_id, language, excluded_text) VALUES "
                "('halal-ver-1', 'exclude-pork-free', 'concept-pork', 'en', 'pork-free')"
            )
        )
        assert connection.execute(
            text(
                "SELECT excluded_text FROM lexical_exclusions "
                "WHERE dataset_version_id = 'halal-ver-1' AND id = 'exclude-pork-free'"
            )
        ).scalar_one() == "pork-free"

    with engine.begin() as connection, pytest.raises(exc.IntegrityError):
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(
            text(
                "INSERT INTO allergen_rules "
                "(dataset_version_id, id, concept_id, source_id, rule_kind, "
                "condition_family, mapping_id) VALUES "
                "('ver-1', 'rule-invalid', 'concept-milk', 'source-review', "
                "'MANDATORY_DECLARATION', 'FOOD_ALLERGEN', 'map-whey')"
            )
        )

    with engine.begin() as connection, pytest.raises(exc.IntegrityError):
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(
            text(
                "INSERT INTO allergen_rules "
                "(dataset_version_id, id, concept_id, source_id, rule_kind, "
                "condition_family, mapping_id) VALUES "
                "('ver-1', 'rule-null-mapping', 'concept-milk', 'source-review', "
                "'DERIVATIVE_MATCH', 'FOOD_ALLERGEN', NULL)"
            )
        )

    with engine.begin() as connection, pytest.raises(exc.IntegrityError):
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(
            text(
                "INSERT INTO allergen_rules "
                "(dataset_version_id, id, concept_id, source_id, rule_kind, "
                "condition_family, mapping_id) VALUES "
                "('ver-1', 'rule-missing-mapping', 'concept-milk', 'source-review', "
                "'DERIVATIVE_MATCH', 'FOOD_ALLERGEN', 'map-missing')"
            )
        )

    with engine.begin() as connection, pytest.raises(exc.IntegrityError):
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(
            text(
                "INSERT INTO lexical_exclusions "
                "(dataset_version_id, id, concept_id, language, excluded_text) VALUES "
                "('ver-1', 'exclude-missing-concept', 'missing-concept', 'en', 'milk tea')"
            )
        )

    command.downgrade(config, "0006")
    assert "lexical_exclusions" not in inspect(engine).get_table_names()
    assert "mapping_id" not in {
        column["name"] for column in inspect(engine).get_columns("allergen_rules")
    }


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


def test_halal_ingredient_migration_enforces_mappings_and_constraints(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database_path = tmp_path / "halal-migration.db"
    database_url = f"sqlite+pysqlite:///{database_path}"
    monkeypatch.setenv("LIFEGOODS_DATABASE_URL", database_url)
    config = Config("backend/alembic.ini")
    command.upgrade(config, "head")

    engine = create_engine(database_url)
    assert "halal_ingredient_mappings" in inspect(engine).get_table_names()

    with engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(
            text(
                "INSERT INTO reference_sources "
                "(id, name, source_type, source_url, jurisdiction, publisher, "
                "licensing_decision) VALUES "
                "('source-synthetic-halal', 'Synthetic Halal Standard', 'NATIONAL_STANDARD', "
                "'https://example.test/halal', 'CAMBODIA', 'Authority', 'PROJECT_AUTHORED')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO reference_dataset_versions "
                "(id, dataset_kind, jurisdiction, source_url, licensing_decision, sha256, "
                "retrieved_at, status, review_kind, immutable, validation_errors, "
                "validation_history) VALUES "
                "('ver-halal-1', 'HALAL_INGREDIENT', 'CAMBODIA', 'https://example.test/halal', "
                "'PROJECT_AUTHORED', 'hash123', '2026-08-30', 'READY', "
                "'HALAL_DOMAIN_REVIEW', 1, '[]', '[]')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO reference_concepts "
                "(dataset_version_id, id, name, condition_family, is_leaf) VALUES "
                "('ver-halal-1', 'concept-pork', 'Porcine ingredients', 'HALAL_INGREDIENT', 1)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO lexical_mappings "
                "(dataset_version_id, id, concept_id, language, mapped_text, "
                "relationship_type) VALUES "
                "('ver-halal-1', 'map-pork-en', 'concept-pork', 'en', 'pork', 'EXACT_NAME')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO halal_ingredient_mappings "
                "(dataset_version_id, id, concept_id, classification, citations, notes) VALUES "
                "('ver-halal-1', 'hm-pork-1', 'concept-pork', 'EXPLICIT_PROHIBITED', "
                "'[{\"source_id\": \"source-synthetic-halal\", \"jurisdiction\": \"CAMBODIA\", "
                "\"edition\": \"2026\", \"locator\": \"Art 4\"}]', "
                "'Prohibited pork mapping')"
            )
        )
        connection.execute(
            text(
                "INSERT INTO reference_dataset_pointers "
                "(dataset_kind, active_version_id, previous_version_id, activated_at, "
                "activated_by, review_kind) "
                "VALUES ('HALAL_INGREDIENT', 'ver-halal-1', NULL, '2026-08-30 12:00:00', "
                "'halal-reviewer@lifegoods.org', 'HALAL_DOMAIN_REVIEW')"
            )
        )

        assert connection.execute(
            text(
                "SELECT classification FROM halal_ingredient_mappings "
                "WHERE dataset_version_id = 'ver-halal-1' AND id = 'hm-pork-1'"
            )
        ).scalar_one() == "EXPLICIT_PROHIBITED"

    # Reject invalid classification
    with engine.begin() as connection, pytest.raises(exc.IntegrityError):
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(
            text(
                "INSERT INTO halal_ingredient_mappings "
                "(dataset_version_id, id, concept_id, classification, citations) VALUES "
                "('ver-halal-1', 'hm-pork-bad', 'concept-pork', 'INVALID_CLASS', '[]')"
            )
        )

    # Reject duplicate mapping for same concept in same version
    with engine.begin() as connection, pytest.raises(exc.IntegrityError):
        connection.execute(text("PRAGMA foreign_keys=ON"))
        connection.execute(
            text(
                "INSERT INTO halal_ingredient_mappings "
                "(dataset_version_id, id, concept_id, classification, citations) VALUES "
                "('ver-halal-1', 'hm-pork-dup', 'concept-pork', 'SOURCE_AMBIGUOUS', '[]')"
            )
        )

    command.downgrade(config, "0007")
    assert "halal_ingredient_mappings" not in inspect(engine).get_table_names()
