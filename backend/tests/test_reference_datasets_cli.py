from __future__ import annotations

import json
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config

from lifegoods.reference_datasets.bundle import (
    AllergenRuleDefinition,
    ConditionFamily,
    LexicalMappingDefinition,
    ReferenceBundle,
    ReferenceConceptDefinition,
    ReferenceDatasetManifest,
    ReferenceReviewKind,
    ReferenceSourceDefinition,
    compute_bundle_sha256,
)
from lifegoods.reference_datasets.cli import main


@pytest.fixture
def test_db_url(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> str:
    db_path = tmp_path / "test_cli.db"
    db_url = f"sqlite+pysqlite:///{db_path}"
    monkeypatch.setenv("LIFEGOODS_DATABASE_URL", db_url)
    config = Config("backend/alembic.ini")
    command.upgrade(config, "head")
    return db_url


@pytest.fixture
def valid_bundle_file(tmp_path: Path) -> Path:
    manifest = ReferenceDatasetManifest(
        id="codex-food-allergen-2026-minimal",
        dataset_kind=ConditionFamily.FOOD_ALLERGEN,
        edition="CXS 1-1985 (Amended 2026)",
        jurisdiction="INTERNATIONAL",
        source_url="https://www.fao.org/fao-who-codexalimentarius/standards/cxs1-1985",
        licensing_decision="PUBLIC_GOVERNMENT_STANDARD",
        project_approver="food-reviewer@lifegoods.org",
        review_kind=ReferenceReviewKind.FOOD_DOMAIN_REVIEW,
        sha256="",
    )
    sources = [
        ReferenceSourceDefinition(
            id="source-codex-cxs-1-1985-2026",
            name="Codex General Standard for the Labelling of Prepackaged Foods",
            source_type="INTERNATIONAL_STANDARD",
            source_url="https://www.fao.org/fao-who-codexalimentarius/standards/cxs1-1985",
            jurisdiction="INTERNATIONAL",
            publisher="Codex Alimentarius Commission",
            edition="CXS 1-1985 (Amended 2026)",
            licensing_decision="PUBLIC_GOVERNMENT_STANDARD",
            terms_version="2026",
        )
    ]
    concepts = [
        ReferenceConceptDefinition(
            id="concept-food-allergen-milk",
            name="Milk and milk products",
            condition_family=ConditionFamily.FOOD_ALLERGEN,
            parent_id=None,
            is_leaf=True,
            description="Milk and ingredients derived from milk",
        )
    ]
    mappings = [
        LexicalMappingDefinition(
            id="map-en-milk-exact",
            concept_id="concept-food-allergen-milk",
            language="en",
            mapped_text="milk",
            relationship_type="EXACT_NAME",
            notes="Direct milk declaration",
        ),
        LexicalMappingDefinition(
            id="map-en-whey-derived",
            concept_id="concept-food-allergen-milk",
            language="en",
            mapped_text="whey",
            relationship_type="DERIVED_FROM",
            notes="Reviewed dairy derivative",
        ),
    ]
    rules = [
        AllergenRuleDefinition(
            id="rule-codex-2026-milk",
            concept_id="concept-food-allergen-milk",
            source_id="source-codex-cxs-1-1985-2026",
            rule_kind="MANDATORY_DECLARATION",
            condition_family=ConditionFamily.FOOD_ALLERGEN,
            description="Codex CXS 1-1985 mandatory allergen declaration for milk",
        )
    ]
    sha256 = compute_bundle_sha256(
        manifest=manifest,
        sources=sources,
        concepts=concepts,
        mappings=mappings,
        rules=rules,
    )
    manifest_with_hash = ReferenceDatasetManifest(
        id=manifest.id,
        dataset_kind=manifest.dataset_kind,
        edition=manifest.edition,
        jurisdiction=manifest.jurisdiction,
        source_url=manifest.source_url,
        licensing_decision=manifest.licensing_decision,
        project_approver=manifest.project_approver,
        review_kind=manifest.review_kind,
        sha256=sha256,
    )
    bundle = ReferenceBundle(
        manifest=manifest_with_hash,
        sources=sources,
        concepts=concepts,
        mappings=mappings,
        rules=rules,
    )
    file_path = tmp_path / "valid_bundle.json"
    bundle.to_json_file(file_path)
    return file_path


def test_cli_validate_valid_bundle(
    valid_bundle_file: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    exit_code = main(["validate", str(valid_bundle_file)])
    assert exit_code == 0
    captured = capsys.readouterr()
    result = json.loads(captured.out)
    assert result["status"] == "VALID"
    assert result["id"] == "codex-food-allergen-2026-minimal"
    assert result["concept_count"] == 1
    assert result["mapping_count"] == 2
    assert result["rule_count"] == 1


def test_cli_validate_invalid_bundle(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    invalid_file = tmp_path / "invalid_bundle.json"
    invalid_file.write_text(
        json.dumps(
            {
                "manifest": {
                    "id": "bad-version",
                    "dataset_kind": "UNKNOWN_KIND",
                    "jurisdiction": "INTERNATIONAL",
                    "source_url": "https://fao.org",
                    "licensing_decision": "PUBLIC",
                    "review_kind": "FOOD_DOMAIN_REVIEW",
                },
                "sources": [],
                "concepts": [],
                "mappings": [],
                "rules": [],
            }
        )
    )

    exit_code = main(["validate", str(invalid_file)])
    assert exit_code == 1
    captured = capsys.readouterr()
    result = json.loads(captured.err)
    assert "error" in result or "errors" in result


def test_cli_import_valid_bundle(
    valid_bundle_file: Path, test_db_url: str, capsys: pytest.CaptureFixture[str]
) -> None:
    exit_code = main(["--database-url", test_db_url, "import", str(valid_bundle_file)])
    assert exit_code == 0
    captured = capsys.readouterr()
    result = json.loads(captured.out)
    assert result["status"] == "READY"
    assert result["id"] == "codex-food-allergen-2026-minimal"
    assert result["immutable"] is True


def test_cli_import_idempotent(
    valid_bundle_file: Path, test_db_url: str, capsys: pytest.CaptureFixture[str]
) -> None:
    exit_code1 = main(["--database-url", test_db_url, "import", str(valid_bundle_file)])
    assert exit_code1 == 0
    exit_code2 = main(["--database-url", test_db_url, "import", str(valid_bundle_file)])
    assert exit_code2 == 0


def test_cli_list_versions(
    valid_bundle_file: Path, test_db_url: str, capsys: pytest.CaptureFixture[str]
) -> None:
    main(["--database-url", test_db_url, "import", str(valid_bundle_file)])
    capsys.readouterr()  # clear output

    exit_code = main(["--database-url", test_db_url, "list"])
    assert exit_code == 0
    captured = capsys.readouterr()
    versions = json.loads(captured.out)
    assert len(versions) == 1
    assert versions[0]["id"] == "codex-food-allergen-2026-minimal"


def test_cli_activate_version(
    valid_bundle_file: Path, test_db_url: str, capsys: pytest.CaptureFixture[str]
) -> None:
    main(["--database-url", test_db_url, "import", str(valid_bundle_file)])
    capsys.readouterr()

    exit_code = main(
        ["--database-url", test_db_url, "activate", "codex-food-allergen-2026-minimal"]
    )
    assert exit_code == 0
    captured = capsys.readouterr()
    result = json.loads(captured.out)
    assert result["status"] == "ACTIVE"
    assert result["id"] == "codex-food-allergen-2026-minimal"
    assert result["project_approver"] == "food-reviewer@lifegoods.org"
    assert result["review_kind"] == "FOOD_DOMAIN_REVIEW"
    assert result["activated_at"] is not None


def test_cli_activate_with_custom_approver(
    valid_bundle_file: Path, test_db_url: str, capsys: pytest.CaptureFixture[str]
) -> None:
    main(["--database-url", test_db_url, "import", str(valid_bundle_file)])
    capsys.readouterr()

    exit_code = main(
        [
            "--database-url",
            test_db_url,
            "activate",
            "codex-food-allergen-2026-minimal",
            "--approver",
            "operator@lifegoods.org",
            "--review-kind",
            "PROJECT_MAINTAINER_APPROVAL",
        ]
    )
    assert exit_code == 0
    captured = capsys.readouterr()
    result = json.loads(captured.out)
    assert result["status"] == "ACTIVE"
    assert result["project_approver"] == "operator@lifegoods.org"
    assert result["review_kind"] == "PROJECT_MAINTAINER_APPROVAL"


def test_cli_activate_unknown_version_fails(
    test_db_url: str, capsys: pytest.CaptureFixture[str]
) -> None:
    exit_code = main(
        ["--database-url", test_db_url, "activate", "non-existent-version"]
    )
    assert exit_code == 1
    captured = capsys.readouterr()
    result = json.loads(captured.err)
    assert "error" in result


def test_cli_rollback_version(
    tmp_path: Path, test_db_url: str, capsys: pytest.CaptureFixture[str]
) -> None:
    # Bundle 1
    b1 = ReferenceBundle(
        manifest=ReferenceDatasetManifest(
            id="ver-1",
            dataset_kind=ConditionFamily.FOOD_ALLERGEN,
            edition="2026",
            jurisdiction="INTERNATIONAL",
            source_url="https://fao.org/1",
            licensing_decision="PUBLIC",
            project_approver="maintainer@lifegoods.org",
            review_kind=ReferenceReviewKind.FOOD_DOMAIN_REVIEW,
            sha256="",
        ),
        sources=[
            ReferenceSourceDefinition(
                id="src-1",
                name="Standard 1",
                source_type="STANDARD",
                source_url="https://fao.org/1",
                jurisdiction="INTERNATIONAL",
                publisher="FAO",
                edition="2026",
                licensing_decision="PUBLIC",
            )
        ],
        concepts=[
            ReferenceConceptDefinition(
                id="c-1",
                name="Milk",
                condition_family=ConditionFamily.FOOD_ALLERGEN,
                parent_id=None,
                is_leaf=True,
            )
        ],
        mappings=[
            LexicalMappingDefinition(
                id="m-1",
                concept_id="c-1",
                language="en",
                mapped_text="milk",
                relationship_type="EXACT_NAME",
            )
        ],
        rules=[
            AllergenRuleDefinition(
                id="r-1",
                concept_id="c-1",
                source_id="src-1",
                rule_kind="MANDATORY_DECLARATION",
                condition_family=ConditionFamily.FOOD_ALLERGEN,
            )
        ],
    )
    sha1 = compute_bundle_sha256(
        manifest=b1.manifest,
        sources=b1.sources,
        concepts=b1.concepts,
        mappings=b1.mappings,
        rules=b1.rules,
    )
    b1_dict = b1.to_dict()
    b1_dict["manifest"]["sha256"] = sha1
    f1 = tmp_path / "b1.json"
    ReferenceBundle.from_dict(b1_dict).to_json_file(f1)

    # Bundle 2
    b2_dict = b1.to_dict()
    b2_dict["manifest"]["id"] = "ver-2"
    b2_dict["manifest"]["source_url"] = "https://fao.org/2"
    b2 = ReferenceBundle.from_dict(b2_dict)
    sha2 = compute_bundle_sha256(
        manifest=b2.manifest,
        sources=b2.sources,
        concepts=b2.concepts,
        mappings=b2.mappings,
        rules=b2.rules,
    )
    b2_dict["manifest"]["sha256"] = sha2
    f2 = tmp_path / "b2.json"
    ReferenceBundle.from_dict(b2_dict).to_json_file(f2)

    main(["--database-url", test_db_url, "import", str(f1)])
    main(["--database-url", test_db_url, "activate", "ver-1"])
    main(["--database-url", test_db_url, "import", str(f2)])
    main(["--database-url", test_db_url, "activate", "ver-2"])
    capsys.readouterr()

    exit_code = main(
        ["--database-url", test_db_url, "rollback", "--dataset-kind", "FOOD_ALLERGEN"]
    )
    assert exit_code == 0
    captured = capsys.readouterr()
    result = json.loads(captured.out)
    assert result["status"] == "ACTIVE"
    assert result["id"] == "ver-1"
    assert result["previous_version_id"] == "ver-2"


def test_cli_rollback_without_previous_fails(
    valid_bundle_file: Path, test_db_url: str, capsys: pytest.CaptureFixture[str]
) -> None:
    main(["--database-url", test_db_url, "import", str(valid_bundle_file)])
    main(["--database-url", test_db_url, "activate", "codex-food-allergen-2026-minimal"])
    capsys.readouterr()

    exit_code = main(
        ["--database-url", test_db_url, "rollback", "--dataset-kind", "FOOD_ALLERGEN"]
    )
    assert exit_code == 1
    captured = capsys.readouterr()
    result = json.loads(captured.err)
    assert "error" in result


def test_cli_inspect_version(
    valid_bundle_file: Path, test_db_url: str, capsys: pytest.CaptureFixture[str]
) -> None:
    main(["--database-url", test_db_url, "import", str(valid_bundle_file)])
    capsys.readouterr()

    exit_code = main(
        ["--database-url", test_db_url, "inspect", "codex-food-allergen-2026-minimal"]
    )
    assert exit_code == 0
    captured = capsys.readouterr()
    result = json.loads(captured.out)
    assert result["id"] == "codex-food-allergen-2026-minimal"
    assert result["status"] == "READY"
    assert len(result["concepts"]) == 1
    assert len(result["mappings"]) == 2
    assert len(result["rules"]) == 1

