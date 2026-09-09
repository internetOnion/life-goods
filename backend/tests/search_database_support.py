"""Explicit, disposable connections and fixtures for Product Search integration tests."""

from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from datetime import UTC, datetime
from typing import Any
from urllib.parse import unquote, urlsplit
from uuid import uuid4

from pymongo.database import Database

from lifegoods.open_food_facts import (
    ACTIVE_POINTER_ID,
    CONTROL_COLLECTION,
    VERSIONS_COLLECTION,
    search_collection_name,
)

TEST_DATABASE = "lifegoods_off_test"


def test_connections(environment: Mapping[str, str]) -> tuple[str, str] | None:
    reader = environment.get("LIFEGOODS_TEST_OFF_MONGODB_READER_URI")
    writer = environment.get("LIFEGOODS_TEST_OFF_MONGODB_WRITER_URI")
    if not reader or not writer:
        return None
    for uri in (reader, writer):
        parsed = urlsplit(uri)
        if parsed.scheme != "mongodb" or unquote(parsed.path) != f"/{TEST_DATABASE}":
            raise ValueError("Product Search tests require explicit lifegoods_off_test URIs")
    if environment.get("LIFEGOODS_OFF_MONGODB_DATABASE") == TEST_DATABASE:
        raise ValueError("The disposable database must not be the application database")
    return reader, writer


@contextmanager
def disposable_dataset(database: Database[dict[str, Any]]) -> Iterator[tuple[str, str, str]]:
    if database.name != TEST_DATABASE:
        raise ValueError("Product Search fixtures require lifegoods_off_test")
    run_id = uuid4().hex
    version = f"test-search-{run_id}"
    source = f"off_products_test_{run_id}"
    search = search_collection_name(version)
    try:
        database[VERSIONS_COLLECTION].insert_one(
            {
                "_id": version,
                "collection_name": source,
                "source_url": "https://example.com/test_export.jsonl.gz",
                "retrieval_completed_at": datetime.now(UTC),
                "activated_at": datetime.now(UTC),
                "sha256": "0" * 64,
                "status": "ACTIVE",
            }
        )
        database[CONTROL_COLLECTION].insert_one(
            {"_id": ACTIVE_POINTER_ID, "active_version_id": version}
        )
        yield version, source, search
    finally:
        database.drop_collection(source)
        database.drop_collection(search)
        database.drop_collection(f"{search}_building")
        database[VERSIONS_COLLECTION].delete_one({"_id": version})
        database[CONTROL_COLLECTION].delete_one(
            {"_id": ACTIVE_POINTER_ID, "active_version_id": version}
        )
