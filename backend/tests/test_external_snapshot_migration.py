from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text


def test_snapshot_tables_and_existing_rows_are_removed_at_cutover(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database_path = tmp_path / "migration.db"
    database_url = f"sqlite+pysqlite:///{database_path}"
    monkeypatch.setenv("LIFEGOODS_DATABASE_URL", database_url)
    config = Config("backend/alembic.ini")
    command.upgrade(config, "0002")
    engine = create_engine(database_url)
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO external_sources "
                "(id, name, source_type, base_url, attribution, database_license, "
                "contents_license, image_license, terms_version) "
                "VALUES ('source', 'Open Food Facts', 'COMMUNITY_DATABASE', "
                "'https://world.openfoodfacts.org', 'contributors', 'ODbL', "
                "'Database Contents License', 'CC BY-SA', NULL)"
            )
        )

    command.upgrade(config, "head")

    table_names = set(inspect(engine).get_table_names())
    assert "external_sources" not in table_names
    assert "external_snapshots" not in table_names
    assert "external_field_evidence" not in table_names
