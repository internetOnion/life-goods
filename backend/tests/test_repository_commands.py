import json
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def test_dataset_wrapper_commands_do_not_use_inline_environment_assignments() -> None:
    package = json.loads((REPOSITORY_ROOT / "package.json").read_text())

    for script_name in ("off:dataset", "reference:dataset"):
        command = package["scripts"][script_name]

        assert command.startswith("uv run --project backend python -m lifegoods.")
        assert "PYTHONPATH=" not in command
