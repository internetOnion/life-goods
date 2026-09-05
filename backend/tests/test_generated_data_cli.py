from __future__ import annotations

import json
from unittest.mock import patch

import mongomock
import pytest

from lifegoods.generated_data import (
    TRANSLATION_LEASES_COLLECTION,
)
from lifegoods.generated_data.cli import main


@pytest.fixture
def mock_mongo():
    mock_client = mongomock.MongoClient()
    with patch("lifegoods.generated_data.cli.MongoClient", return_value=mock_client):
        yield mock_client


def test_cli_init_creates_schema_and_outputs_json(mock_mongo, capsys) -> None:
    exit_code = main(["init", "--database", "test_generated_db"])

    assert exit_code == 0
    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert payload["status"] == "INITIALIZED"
    assert len(payload["collections"]) == 4


def test_cli_init_is_idempotent(mock_mongo, capsys) -> None:
    exit_code_1 = main(["init", "--database", "test_generated_db"])
    assert exit_code_1 == 0
    capsys.readouterr()

    exit_code_2 = main(["init", "--database", "test_generated_db"])
    assert exit_code_2 == 0
    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert payload["status"] == "INITIALIZED"


def test_cli_verify_succeeds_after_init(mock_mongo, capsys) -> None:
    main(["init", "--database", "test_generated_db"])
    capsys.readouterr()

    exit_code = main(["verify", "--database", "test_generated_db"])
    assert exit_code == 0
    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert payload["status"] == "VERIFIED"


def test_cli_verify_fails_on_uninitialized_database(mock_mongo, capsys) -> None:
    exit_code = main(["verify", "--database", "empty_db"])
    assert exit_code == 1
    captured = capsys.readouterr()
    error_payload = json.loads(captured.err)
    assert "error" in error_payload
    assert "Missing required collection" in error_payload["error"]


def test_cli_init_fails_on_incompatible_index(mock_mongo, capsys) -> None:
    database = mock_mongo["test_incompatible_db"]
    database[TRANSLATION_LEASES_COLLECTION].create_index(
        [("expires_at", 1)],
        expireAfterSeconds=999,
        name="ttl_translation_leases_expires_at",
    )

    exit_code = main(["init", "--database", "test_incompatible_db"])
    assert exit_code == 1
    captured = capsys.readouterr()
    error_payload = json.loads(captured.err)
    assert "error" in error_payload
    assert "incompatible TTL" in error_payload["error"]


def test_cli_status_outputs_aggregate_stats_without_product_text(mock_mongo, capsys) -> None:
    main(["init", "--database", "test_status_db"])
    capsys.readouterr()

    exit_code = main(["status", "--database", "test_status_db"])
    assert exit_code == 0
    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert payload["status"] == "HEALTHY"
    assert "aggregate_stats" in payload
    assert payload["aggregate_stats"]["artifacts_count"] == 0
    assert payload["aggregate_stats"]["quarantines_count"] == 0
    # Privacy check: output contains no product text or shopper data
    assert "product_name" not in captured.out
    assert "barcode" not in captured.out


def test_cli_quarantine(mock_mongo, capsys) -> None:
    main(["init", "--database", "test_quarantine_db"])
    capsys.readouterr()

    # Quarantine by artifact-id
    exit_code = main(
        [
            "quarantine",
            "--database",
            "test_quarantine_db",
            "--artifact-id",
            "hash123:cfg456",
            "--reason",
            "Manual audit withdrawal",
        ]
    )
    assert exit_code == 0
    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert payload["status"] == "QUARANTINED"
    assert payload["artifact_id"] == "hash123:cfg456"
    assert payload["content_hash"] == "hash123"
    assert payload["translation_config_fingerprint"] == "cfg456"

    # Status reflects quarantine
    main(["status", "--database", "test_quarantine_db"])
    captured = capsys.readouterr()
    assert json.loads(captured.out)["aggregate_stats"]["quarantines_count"] == 1
