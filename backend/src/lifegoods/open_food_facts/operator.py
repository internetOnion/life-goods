"""Run dataset lifecycle commands without putting a privileged URI in argv."""

import os
import sys

from lifegoods.open_food_facts.cli import main


def run() -> int:
    uri = os.getenv("LIFEGOODS_DATASET_OPERATOR_URI")
    if not uri:
        print(
            "Set LIFEGOODS_DATASET_OPERATOR_URI privately before operator commands.",
            file=sys.stderr,
        )
        return 2
    database = os.getenv("LIFEGOODS_OFF_MONGODB_DATABASE", "lifegoods_off")
    return main(["--mongo-uri", uri, "--database", database, *sys.argv[1:]])


if __name__ == "__main__":
    sys.exit(run())
