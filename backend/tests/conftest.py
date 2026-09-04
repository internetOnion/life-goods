from __future__ import annotations

import os

import pytest


def pytest_addoption(parser: pytest.Parser) -> None:
    parser.addoption(
        "--run-integration",
        action="store_true",
        default=False,
        help="run integration tests against real services",
    )


def pytest_collection_modifyitems(
    config: pytest.Config, items: list[pytest.Item]
) -> None:
    if config.getoption("--run-integration") or os.getenv(
        "LIFEGOODS_TEST_INTEGRATION"
    ):
        return
    skip_integration = pytest.mark.skip(
        reason=(
            "Real service integration test skipped; pass --run-integration "
            "or set LIFEGOODS_TEST_INTEGRATION=1"
        )
    )
    for item in items:
        if "integration" in item.keywords:
            item.add_marker(skip_integration)
