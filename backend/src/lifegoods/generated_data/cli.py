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
