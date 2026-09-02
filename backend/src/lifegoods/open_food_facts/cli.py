import argparse
import hashlib
import json
import sys
import time
import uuid
import zlib
from collections.abc import Callable, Generator, Iterable
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from threading import Event, Thread
from typing import Any

import httpx2 as httpx
from pymongo import ASCENDING, MongoClient
from pymongo.database import Database
from pymongo.errors import BulkWriteError, DuplicateKeyError, PyMongoError

from lifegoods.open_food_facts.dataset import (
    ACTIVE_POINTER_ID,
    CONTROL_COLLECTION,
    PRODUCT_COLLECTION_PREFIX,
    VERSIONS_COLLECTION,
    ensure_package_search_indexes,
)
from lifegoods.package_matches.search import build_search_index, search_collection_name

DEFAULT_EXPORT_URL = (
    "https://static.openfoodfacts.org/data/openfoodfacts-products.jsonl.gz"
)
DEFAULT_PROBE_CODES = ("4006381333931",)
DEFAULT_BATCH_SIZE = 1_000
DEFAULT_PROGRESS_INTERVAL_SECONDS = 5.0
LIFECYCLE_LOCK_ID = "dataset-lifecycle-lock"
LIFECYCLE_LOCK_TTL_SECONDS = 120


class DatasetImportError(Exception):
    pass


@contextmanager
def lifecycle_lock(
    database: Database[dict[str, Any]],
    *,
    ttl_seconds: int = LIFECYCLE_LOCK_TTL_SECONDS,
) -> Generator[None]:
    owner = uuid.uuid4().hex
    now = datetime.now(UTC)
    lock_collection = database[CONTROL_COLLECTION]
    acquired = False
    try:
        lock_collection.insert_one(
            {
                "_id": LIFECYCLE_LOCK_ID,
                "owner_id": owner,
                "expires_at": now + timedelta(seconds=ttl_seconds),
            }
        )
        acquired = True
    except DuplicateKeyError:
        existing = lock_collection.find_one({"_id": LIFECYCLE_LOCK_ID})
        expires_at = existing.get("expires_at") if isinstance(existing, dict) else None
        if isinstance(expires_at, datetime) and _as_utc(expires_at) <= now:
            replaced = lock_collection.find_one_and_update(
                {"_id": LIFECYCLE_LOCK_ID, "expires_at": expires_at},
                {
                    "$set": {
                        "owner_id": owner,
                        "expires_at": now + timedelta(seconds=ttl_seconds),
                    }
                },
            )
            acquired = replaced is not None
    if not acquired:
        raise DatasetImportError("Another dataset lifecycle operation is in progress")
    stop_renewal = Event()

    def renew() -> None:
        interval_seconds = max(1.0, ttl_seconds / 3)
        while not stop_renewal.wait(interval_seconds):
            result = lock_collection.update_one(
                {"_id": LIFECYCLE_LOCK_ID, "owner_id": owner},
                {
                    "$set": {
                        "expires_at": datetime.now(UTC)
                        + timedelta(seconds=ttl_seconds),
                    }
                },
            )
            if result.modified_count != 1:
                return

    renewal_thread = Thread(
        target=renew,
        name="lifegoods-dataset-lock-renewal",
        daemon=True,
    )
    renewal_thread.start()
    try:
        yield
    finally:
        stop_renewal.set()
        renewal_thread.join()
        lock_collection.delete_one({"_id": LIFECYCLE_LOCK_ID, "owner_id": owner})


def import_url(
    database: Database[dict[str, Any]],
    source_url: str,
    *,
    probe_codes: tuple[str, ...] = DEFAULT_PROBE_CODES,
    batch_size: int = DEFAULT_BATCH_SIZE,
    client: httpx.Client | None = None,
    now: Callable[[], datetime] | None = None,
    progress: Callable[[dict[str, int | float]], None] | None = None,
    progress_interval_seconds: float = DEFAULT_PROGRESS_INTERVAL_SECONDS,
) -> dict[str, Any]:
    if batch_size <= 0:
        raise ValueError("Batch size must be greater than zero")
    if progress_interval_seconds <= 0:
        raise ValueError("Progress interval must be greater than zero")
    utc_now = now or (lambda: datetime.now(UTC))
    version_id = uuid.uuid4().hex
    collection_name = f"{PRODUCT_COLLECTION_PREFIX}{version_id}"
    started_at = utc_now()
    manifest: dict[str, Any] = {
        "_id": version_id,
        "collection_name": collection_name,
        "source_url": source_url,
        "retrieval_started_at": started_at,
        "status": "IMPORTING",
        "byte_count": 0,
        "document_count": 0,
        "inserted_count": 0,
        "malformed_count": 0,
        "duplicate_count": 0,
        "schema_versions": [],
        "schema_missing_count": 0,
        "probe_codes": list(probe_codes),
        "validation_errors": [],
    }
    versions = database[VERSIONS_COLLECTION]
    owned_client = client is None
    http_client = client or httpx.Client(timeout=None, follow_redirects=True)
    try:
        with lifecycle_lock(database):
            versions.insert_one(manifest)
            try:
                report = _stream_import(
                    database,
                    collection_name,
                    source_url,
                    http_client,
                    batch_size,
                    progress=progress,
                    progress_interval_seconds=progress_interval_seconds,
                )
                completed_at = utc_now()
                validation_errors = _validate_import(
                    database,
                    collection_name,
                    report,
                    probe_codes,
                )
                status = "READY" if not validation_errors else "FAILED"
                update = {
                    **report,
                    "retrieval_completed_at": completed_at,
                    "status": status,
                    "immutable": status == "READY",
                    "probe_codes": list(probe_codes),
                    "validation_errors": validation_errors,
                }
                versions.update_one({"_id": version_id}, {"$set": update})
                if not validation_errors:
                    build_search_index(database, version_id)
                result = versions.find_one({"_id": version_id})
                if result is None:
                    raise DatasetImportError("Imported manifest disappeared")
                if validation_errors:
                    raise DatasetImportError("; ".join(validation_errors))
                return result
            except BaseException as error:
                versions.update_one(
                    {"_id": version_id},
                    {
                        "$set": {
                            "status": "FAILED",
                            "retrieval_completed_at": utc_now(),
                            "failure": _failure_message(error),
                        }
                    },
                )
                raise
    finally:
        if owned_client:
            http_client.close()


def activate_version(
    database: Database[dict[str, Any]],
    version_id: str,
    *,
    now: Callable[[], datetime] | None = None,
) -> dict[str, Any]:
    utc_now = now or (lambda: datetime.now(UTC))
    versions = database[VERSIONS_COLLECTION]
    with lifecycle_lock(database):
        manifest = versions.find_one({"_id": version_id})
        if (
            manifest is None
            or manifest.get("status") not in {"READY", "ACTIVE"}
            or manifest.get("validation_errors")
        ):
            raise ValueError("Only a validated READY dataset version can be activated")
        collection_name = manifest.get("collection_name")
        if (
            not isinstance(collection_name, str)
            or collection_name not in database.list_collection_names()
        ):
            raise ValueError("Dataset product collection is unavailable")
        search_index = manifest.get("search_index")
        if (
            not isinstance(search_index, dict)
            or search_index.get("status") != "READY"
            or search_index.get("collection_name") not in database.list_collection_names()
        ):
            raise ValueError("Dataset search collection is unavailable")
        database[collection_name].create_index(
            [("code", ASCENDING)], unique=True, name="uq_off_code"
        )
        ensure_package_search_indexes(database[collection_name])

        pointer = database[CONTROL_COLLECTION].find_one({"_id": ACTIVE_POINTER_ID}) or {}
        previous_id = pointer.get("active_version_id")
        activated_at = utc_now()
        database[CONTROL_COLLECTION].update_one(
            {"_id": ACTIVE_POINTER_ID},
            {
                "$set": {
                    "previous_version_id": previous_id,
                    "active_version_id": version_id,
                    "activated_at": activated_at,
                }
            },
            upsert=True,
        )
        versions.update_one(
            {"_id": version_id},
            {"$set": {"status": "ACTIVE", "activated_at": activated_at}},
        )
        if isinstance(previous_id, str) and previous_id != version_id:
            versions.update_one({"_id": previous_id}, {"$set": {"status": "READY"}})
        return _required_manifest(versions.find_one({"_id": version_id}))


def rollback_version(
    database: Database[dict[str, Any]],
    *,
    now: Callable[[], datetime] | None = None,
) -> dict[str, Any]:
    with lifecycle_lock(database):
        pointer = database[CONTROL_COLLECTION].find_one({"_id": ACTIVE_POINTER_ID})
        if pointer is None or not isinstance(pointer.get("previous_version_id"), str):
            raise ValueError("No previous dataset version is available for rollback")
        previous_id = pointer["previous_version_id"]
        current_id = pointer.get("active_version_id")
        manifest = database[VERSIONS_COLLECTION].find_one({"_id": previous_id})
        if manifest is None or manifest.get("status") not in {"READY", "ACTIVE"}:
            raise ValueError("The previous dataset version is not ready")
        search_index = manifest.get("search_index")
        if (
            not isinstance(search_index, dict)
            or search_index.get("status") != "READY"
            or search_index.get("collection_name") not in database.list_collection_names()
        ):
            raise ValueError("Dataset search collection is unavailable")
        activated_at = (now or (lambda: datetime.now(UTC)))()
        result = database[CONTROL_COLLECTION].update_one(
            {"_id": ACTIVE_POINTER_ID, "active_version_id": current_id},
            {
                "$set": {
                    "active_version_id": previous_id,
                    "previous_version_id": current_id,
                    "activated_at": activated_at,
                }
            },
        )
        if result.modified_count != 1:
            raise DatasetImportError("Dataset pointer changed during rollback")
        if isinstance(current_id, str):
            database[VERSIONS_COLLECTION].update_one(
                {"_id": current_id}, {"$set": {"status": "READY"}}
            )
        database[VERSIONS_COLLECTION].update_one(
            {"_id": previous_id},
            {"$set": {"status": "ACTIVE", "activated_at": activated_at}},
        )
        return _required_manifest(
            database[VERSIONS_COLLECTION].find_one({"_id": previous_id})
        )


def prune_versions(database: Database[dict[str, Any]]) -> list[str]:
    with lifecycle_lock(database):
        pointer = database[CONTROL_COLLECTION].find_one({"_id": ACTIVE_POINTER_ID}) or {}
        retained = {
            value
            for value in (pointer.get("active_version_id"), pointer.get("previous_version_id"))
            if isinstance(value, str)
        }
        removed: list[str] = []
        for manifest in database[VERSIONS_COLLECTION].find({}):
            version_id = manifest.get("_id")
            if (
                not isinstance(version_id, str)
                or version_id in retained
                or manifest.get("status") == "IMPORTING"
                or manifest.get("status") not in {"READY", "FAILED"}
            ):
                continue
            collection_name = manifest.get("collection_name")
            if isinstance(collection_name, str):
                database.drop_collection(collection_name)
            database.drop_collection(search_collection_name(version_id))
            database[VERSIONS_COLLECTION].delete_one({"_id": version_id})
            removed.append(version_id)
        return removed


def delete_version(
    database: Database[dict[str, Any]],
    version_id: str,
) -> dict[str, Any]:
    with lifecycle_lock(database):
        pointer = database[CONTROL_COLLECTION].find_one({"_id": ACTIVE_POINTER_ID}) or {}
        if version_id in {
            pointer.get("active_version_id"),
            pointer.get("previous_version_id"),
        } or database[VERSIONS_COLLECTION].find_one(
            {"_id": version_id, "status": "ACTIVE"}
        ):
            raise ValueError("Cannot delete an active or previous dataset version")
        manifest = database[VERSIONS_COLLECTION].find_one({"_id": version_id})
        if manifest is None:
            raise ValueError(f"Dataset version {version_id} does not exist")
        if manifest.get("status") == "IMPORTING":
            raise ValueError("Cannot delete a dataset import in progress")
        collection_name = manifest.get("collection_name")
        if isinstance(collection_name, str):
            database.drop_collection(collection_name)
        database.drop_collection(search_collection_name(version_id))
        database[VERSIONS_COLLECTION].delete_one({"_id": version_id})
        return {"deleted_version_id": version_id}


def revalidate_version(
    database: Database[dict[str, Any]],
    version_id: str,
    *,
    probe_codes: tuple[str, ...] = DEFAULT_PROBE_CODES,
    now: Callable[[], datetime] | None = None,
) -> dict[str, Any]:
    utc_now = now or (lambda: datetime.now(UTC))
    versions = database[VERSIONS_COLLECTION]
    with lifecycle_lock(database):
        manifest = versions.find_one({"_id": version_id})
        if manifest is None:
            raise ValueError(f"Dataset version {version_id} does not exist")
        collection_name = manifest.get("collection_name")
        if (
            not isinstance(collection_name, str)
            or collection_name not in database.list_collection_names()
        ):
            raise ValueError("Dataset product collection is unavailable")

        stored_probes = tuple(
            code for code in manifest.get("probe_codes", []) if isinstance(code, str)
        )
        effective_probes = tuple(dict.fromkeys((*stored_probes, *probe_codes)))
        validation_errors = _validate_import(
            database,
            collection_name,
            manifest,
            effective_probes,
        )
        validation_record = {
            "validated_at": utc_now(),
            "probe_codes": list(effective_probes),
            "validation_errors": validation_errors,
        }
        status = manifest.get("status") if manifest.get("status") == "ACTIVE" else "READY"
        update: dict[str, Any] = {
            "$push": {"validation_history": validation_record},
            "$set": {
                "status": status if not validation_errors else manifest.get("status"),
                "probe_codes": list(effective_probes),
                "validation_errors": validation_errors,
                "immutable": (
                    True
                    if not validation_errors
                    else manifest.get("immutable", True)
                ),
            },
        }
        if not validation_errors:
            update["$unset"] = {"failure": ""}
        versions.update_one(
            {"_id": version_id},
            update,
        )
        result = _required_manifest(versions.find_one({"_id": version_id}))
        if validation_errors:
            raise DatasetImportError("; ".join(validation_errors))
        return result


def list_versions(database: Database[dict[str, Any]]) -> list[dict[str, Any]]:
    return list(database[VERSIONS_COLLECTION].find({}).sort("retrieval_started_at", -1))


def reindex_search(database: Database[dict[str, Any]], version_id: str) -> dict[str, Any]:
    """Build the local search collection for an imported dataset version."""
    with lifecycle_lock(database):
        return build_search_index(database, version_id)


def _stream_import(
    database: Database[dict[str, Any]],
    collection_name: str,
    source_url: str,
    client: httpx.Client,
    batch_size: int,
    *,
    progress: Callable[[dict[str, int | float]], None] | None = None,
    progress_interval_seconds: float = DEFAULT_PROGRESS_INTERVAL_SECONDS,
) -> dict[str, Any]:
    digest = hashlib.sha256()
    decompressor = zlib.decompressobj(16 + zlib.MAX_WBITS)
    buffer = b""
    documents: list[dict[str, Any]] = []
    byte_count = 0
    document_count = 0
    inserted_count = 0
    malformed_count = 0
    duplicate_count = 0
    schema_versions: set[int] = set()
    schema_missing_count = 0
    started_monotonic = time.monotonic()
    last_progress = started_monotonic
    collection = database[collection_name]
    collection.create_index([("code", ASCENDING)], unique=True, name="uq_off_code")

    def consume(lines: Iterable[bytes]) -> None:
        nonlocal document_count, inserted_count, malformed_count, duplicate_count
        nonlocal schema_missing_count
        for line in lines:
            if not line.strip():
                continue
            document_count += 1
            try:
                product = json.loads(line)
            except (json.JSONDecodeError, UnicodeDecodeError):
                malformed_count += 1
                continue
            if (
                not isinstance(product, dict)
                or not isinstance(product.get("code"), str)
                or not product["code"].strip()
            ):
                malformed_count += 1
                continue
            schema_version = product.get("schema_version")
            if isinstance(schema_version, int):
                schema_versions.add(schema_version)
            else:
                schema_missing_count += 1
            documents.append(product)
            if len(documents) >= batch_size:
                inserted, duplicates = _insert_batch(collection, documents)
                inserted_count += inserted
                duplicate_count += duplicates
                documents.clear()

    with client.stream("GET", source_url) as response:
        response.raise_for_status()
        for chunk in response.iter_raw():
            digest.update(chunk)
            byte_count += len(chunk)
            buffer += decompressor.decompress(chunk)
            parts = buffer.split(b"\n")
            buffer = parts.pop()
            consume(parts)
            now_monotonic = time.monotonic()
            if (
                progress is not None
                and now_monotonic - last_progress >= progress_interval_seconds
            ):
                progress(
                    {
                        "byte_count": byte_count,
                        "document_count": document_count,
                        "inserted_count": inserted_count,
                        "elapsed_seconds": now_monotonic - started_monotonic,
                    }
                )
                last_progress = now_monotonic
        buffer += decompressor.flush()
    if not decompressor.eof:
        raise DatasetImportError("The gzip stream ended before its trailer")
    consume(buffer.splitlines())
    if documents:
        inserted, duplicates = _insert_batch(collection, documents)
        inserted_count += inserted
        duplicate_count += duplicates
    if progress is not None:
        progress(
            {
                "byte_count": byte_count,
                "document_count": document_count,
                "inserted_count": inserted_count,
                "elapsed_seconds": time.monotonic() - started_monotonic,
            }
        )
    return {
        "sha256": digest.hexdigest(),
        "byte_count": byte_count,
        "document_count": document_count,
        "inserted_count": inserted_count,
        "malformed_count": malformed_count,
        "duplicate_count": duplicate_count,
        "schema_versions": sorted(schema_versions),
        "schema_missing_count": schema_missing_count,
    }


def _insert_batch(collection: Any, documents: list[dict[str, Any]]) -> tuple[int, int]:
    try:
        result = collection.insert_many(documents, ordered=False)
        return len(result.inserted_ids), 0
    except BulkWriteError as error:
        details = error.details
        write_errors = details.get("writeErrors", [])
        duplicates = sum(item.get("code") == 11000 for item in write_errors)
        other_errors = [item for item in write_errors if item.get("code") != 11000]
        if other_errors:
            raise DatasetImportError(
                "MongoDB rejected one or more product documents"
            ) from error
        return int(details.get("nInserted", 0)), duplicates


def _validate_import(
    database: Database[dict[str, Any]],
    collection_name: str,
    report: dict[str, Any],
    probe_codes: tuple[str, ...],
) -> list[str]:
    errors: list[str] = []
    if report.get("byte_count", 0) <= 0 or report.get("document_count", 0) <= 0:
        errors.append("The export contained no product data")
    if report.get("malformed_count", 0):
        errors.append(f"Malformed documents: {report['malformed_count']}")
    if report.get("duplicate_count", 0):
        errors.append(f"Duplicate product codes: {report['duplicate_count']}")
    if not report.get("schema_versions"):
        errors.append("No schema versions were observed")
    if report.get("schema_missing_count", 0):
        errors.append(
            f"Missing schema observations: {report['schema_missing_count']}"
        )
    if (
        report.get("inserted_count", 0)
        + report.get("duplicate_count", 0)
        + report.get("malformed_count", 0)
        != report.get("document_count", 0)
    ):
        errors.append("Parsed and inserted document counts do not match")
    collection = database[collection_name]
    try:
        collection.create_index([("code", ASCENDING)], unique=True, name="uq_off_code")
    except PyMongoError as error:
        errors.append(f"Unique product-code index failed: {error}")
    try:
        ensure_package_search_indexes(collection)
    except PyMongoError as error:
        errors.append(f"Package search indexes failed: {error}")
    if collection.count_documents({}) != report.get("inserted_count", 0):
        errors.append("MongoDB document count does not match the import report")
    missing_probes = [
        code for code in probe_codes if collection.find_one({"code": code}) is None
    ]
    if missing_probes:
        errors.append(f"Known barcode probes missing: {', '.join(missing_probes)}")
    return errors


def _required_manifest(manifest: dict[str, Any] | None) -> dict[str, Any]:
    if manifest is None:
        raise ValueError("Dataset version does not exist")
    return manifest


def _failure_message(error: BaseException) -> str:
    message = str(error).strip()
    return message or type(error).__name__


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _json_default(value: object) -> str:
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    raise TypeError(f"Cannot serialize {type(value).__name__}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Manage pinned Open Food Facts datasets"
    )
    parser.add_argument("--mongo-uri", required=True)
    parser.add_argument("--database", default="lifegoods_off")
    subparsers = parser.add_subparsers(dest="command", required=True)
    import_parser = subparsers.add_parser("import-url")
    import_parser.add_argument("--url", default=DEFAULT_EXPORT_URL)
    import_parser.add_argument("--probe", action="append", dest="probes")
    import_parser.add_argument(
        "--progress-seconds",
        type=float,
        default=DEFAULT_PROGRESS_INTERVAL_SECONDS,
        help="Progress logging interval (default: 5 seconds)",
    )
    revalidate_parser = subparsers.add_parser("revalidate")
    revalidate_parser.add_argument("version_id")
    revalidate_parser.add_argument("--probe", action="append", dest="probes")
    reindex_parser = subparsers.add_parser("reindex-search")
    reindex_parser.add_argument("version_id")
    activate_parser = subparsers.add_parser("activate")
    activate_parser.add_argument("version_id")
    delete_parser = subparsers.add_parser("delete")
    delete_parser.add_argument("version_id")
    subparsers.add_parser("list")
    subparsers.add_parser("rollback")
    subparsers.add_parser("prune")
    args = parser.parse_args(argv)

    client: MongoClient[dict[str, Any]] = MongoClient(args.mongo_uri)
    database = client[args.database]
    try:
        if args.command == "import-url":
            print(
                f"Starting OFF dataset import: {args.url}", file=sys.stderr, flush=True
            )

            def report_progress(progress: dict[str, int | float]) -> None:
                megabytes = progress["byte_count"] / 1_000_000
                elapsed = progress["elapsed_seconds"]
                print(
                    "OFF import progress: "
                    f"{megabytes:.1f} MB received, "
                    f"{progress['document_count']:,} documents parsed, "
                    f"{progress['inserted_count']:,} inserted, "
                    f"{elapsed:.0f}s elapsed",
                    file=sys.stderr,
                    flush=True,
                )

            output: object = import_url(
                database,
                args.url,
                probe_codes=tuple(args.probes or DEFAULT_PROBE_CODES),
                progress=report_progress,
                progress_interval_seconds=args.progress_seconds,
            )
        elif args.command == "revalidate":
            output = revalidate_version(
                database,
                args.version_id,
                probe_codes=tuple(args.probes or DEFAULT_PROBE_CODES),
            )
        elif args.command == "reindex-search":
            output = reindex_search(database, args.version_id)
        elif args.command == "activate":
            output = activate_version(database, args.version_id)
        elif args.command == "delete":
            output = delete_version(database, args.version_id)
        elif args.command == "rollback":
            output = rollback_version(database)
        elif args.command == "prune":
            output = {"removed_version_ids": prune_versions(database)}
        else:
            output = list_versions(database)
        print(json.dumps(output, default=_json_default, indent=2))
        return 0
    except (DatasetImportError, PyMongoError, ValueError, httpx.HTTPError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
