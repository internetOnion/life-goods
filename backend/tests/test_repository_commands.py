import json
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def test_dataset_wrapper_commands_do_not_use_inline_environment_assignments() -> None:
    package = json.loads((REPOSITORY_ROOT / "package.json").read_text())

    for script_name in ("off:dataset",):
        command = package["scripts"][script_name]

        assert command.startswith("uv run --project backend python -m lifegoods.")
        assert "PYTHONPATH=" not in command


def test_dev_server_scripts_separate_http_and_https() -> None:
    root_package = json.loads((REPOSITORY_ROOT / "package.json").read_text())
    frontend_package = json.loads(
        (REPOSITORY_ROOT / "frontend" / "package.json").read_text()
    )
    assert root_package["scripts"]["dev"] == "pnpm --dir frontend dev"
    assert root_package["scripts"]["dev:https"] == "pnpm --dir frontend dev:https"

    assert frontend_package["scripts"]["dev"] == "vite"
    assert frontend_package["scripts"]["dev:https"] == "vite --mode https"
    assert "predev" not in frontend_package["scripts"]
    assert frontend_package["scripts"]["predev:https"].startswith(
        "node scripts/generate-dev-cert.mjs"
    )
