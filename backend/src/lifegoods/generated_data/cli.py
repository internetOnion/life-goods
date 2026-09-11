from __future__ import annotations

import argparse
import json
import sys
from typing import Any

from pymongo import MongoClient
from pymongo.errors import PyMongoError

from lifegoods.core.settings import Settings
from lifegoods.generated_data.schema import (
    IncompatibleIndexError,
    ensure_generated_data_schema,
    verify_generated_data_schema,
)


def _parse_artifact_identity(
    artifact_id: str | None,
    content_hash: str | None,
    config_fingerprint: str | None,
) -> tuple[str, str, str]:
    if artifact_id:
        parts = artifact_id.split(":", 1)
        if len(parts) == 2 and parts[0] and parts[1]:
            return artifact_id, parts[0], parts[1]
        raise ValueError(
            "Invalid --artifact-id: expected format <content_hash>:<config_fingerprint>"
        )
    if content_hash and config_fingerprint:
        return f"{content_hash}:{config_fingerprint}", content_hash, config_fingerprint
    raise ValueError(
        "Must provide either --artifact-id or both --content-hash and --config-fingerprint"
    )


def main(argv: list[str] | None = None) -> int:
    settings = Settings()
    common_parser = argparse.ArgumentParser(add_help=False)
    common_parser.add_argument(
        "--mongo-uri",
        default=settings.generated_mongodb_uri,
        help="MongoDB connection URI for generated data",
    )
    common_parser.add_argument(
        "--database",
        default=settings.generated_mongodb_database,
        help="Database name for generated data",
    )
    common_parser.add_argument(
        "--timeout-ms",
        type=int,
        default=settings.generated_mongodb_timeout_ms,
        help="MongoDB connection timeout in milliseconds",
    )

    parser = argparse.ArgumentParser(
        description="Manage generated translation data collections and indexes",
        parents=[common_parser],
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser(
        "init",
        parents=[common_parser],
        help="Idempotently create and verify required collections and indexes",
    )
    subparsers.add_parser(
        "verify",
        parents=[common_parser],
        help="Verify that required collections and indexes exist and are compatible",
    )
    subparsers.add_parser(
        "status",
        parents=[common_parser],
        help="Inspect aggregate storage stats and health without printing Product text",
    )

    quarantine_parser = subparsers.add_parser(
        "quarantine",
        parents=[common_parser],
        help="Quarantine a translation artifact by artifact identity",
    )
    quarantine_parser.add_argument(
        "--artifact-id",
        help="Artifact ID (in format content_hash:config_fingerprint)",
    )
    quarantine_parser.add_argument(
        "--content-hash",
        help="Content hash of the artifact",
    )
    quarantine_parser.add_argument(
        "--config-fingerprint",
        help="Translation configuration fingerprint",
    )
    quarantine_parser.add_argument(
        "--reason",
        default="Administrative withdrawal",
        help="Reason for quarantine",
    )

    args = parser.parse_args(argv)

    client: MongoClient[dict[str, Any]] = MongoClient(
        args.mongo_uri,
        serverSelectionTimeoutMS=args.timeout_ms,
    )
    database = client[args.database]

    try:
        if args.command == "init":
            output = ensure_generated_data_schema(database)
        elif args.command == "verify":
            output = verify_generated_data_schema(database)
        elif args.command == "status":
            from lifegoods.generated_data.repository import MongoGeneratedDataRepository

            repo = MongoGeneratedDataRepository(database)
            stats = repo.get_aggregate_stats()
            output = {
                "status": "HEALTHY",
                "database": args.database,
                "aggregate_stats": {
                    "artifacts_count": stats.artifacts_count,
                    "active_leases_count": stats.active_leases_count,
                    "active_cooldowns_count": stats.active_cooldowns_count,
                    "quarantines_count": stats.quarantines_count,
                },
            }
        elif args.command == "quarantine":
            from contextlib import suppress

            import redis

            from lifegoods.generated_data.cache import translation_cache_key
            from lifegoods.generated_data.repository import MongoGeneratedDataRepository

            artifact_id, content_hash, config_fingerprint = _parse_artifact_identity(
                args.artifact_id, args.content_hash, args.config_fingerprint
            )
            repo = MongoGeneratedDataRepository(database)
            repo.quarantine_artifact(content_hash, config_fingerprint, reason=args.reason)

            # Evict from hot cache if Redis is accessible
            with suppress(Exception):
                redis_client = redis.Redis.from_url(settings.redis_url)
                redis_client.delete(translation_cache_key(content_hash, config_fingerprint))
                redis_client.close()

            output = {
                "status": "QUARANTINED",
                "artifact_id": artifact_id,
                "content_hash": content_hash,
                "translation_config_fingerprint": config_fingerprint,
                "reason": args.reason,
            }
        else:
            raise ValueError(f"Unknown command: {args.command}")

        print(json.dumps(output, indent=2))
        return 0
    except (IncompatibleIndexError, PyMongoError, ValueError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(main())
