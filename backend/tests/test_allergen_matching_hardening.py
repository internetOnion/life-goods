from lifegoods.reference_datasets.bundle import ReferenceBundle


def test_reference_bundle_without_exclusions_parses_as_an_empty_set() -> None:
    payload = {
        "manifest": {
            "id": "legacy-v1",
            "dataset_kind": "FOOD_ALLERGEN",
            "jurisdiction": "INTERNATIONAL",
            "source_url": "https://example.test/reference",
            "licensing_decision": "TEST_FIXTURE",
            "review_kind": "FOOD_DOMAIN_REVIEW",
        },
        "sources": [],
        "concepts": [],
        "mappings": [],
        "rules": [],
    }

    bundle = ReferenceBundle.from_dict(payload)

    assert bundle.exclusions == []
    assert bundle.to_dict()["exclusions"] == []


def test_reference_bundle_round_trip_preserves_exclusions_and_rule_links() -> None:
    payload = {
        "manifest": {
            "id": "reviewed-en-v1",
            "dataset_kind": "FOOD_ALLERGEN",
            "edition": "2026",
            "jurisdiction": "PROJECT_SCOPE",
            "source_url": "https://github.com/internetOnion/life-goods/issues/63",
            "licensing_decision": "PROJECT_AUTHORED",
            "project_approver": "food-reviewer@lifegoods.org",
            "review_kind": "FOOD_DOMAIN_REVIEW",
        },
        "sources": [],
        "concepts": [],
        "mappings": [],
        "exclusions": [
            {
                "id": "exclude-en-coconut-milk-for-milk",
                "concept_id": "concept-food-allergen-milk",
                "language": "en",
                "excluded_text": "coconut milk",
                "notes": "Coconut milk is not mammalian milk.",
            }
        ],
        "rules": [
            {
                "id": "rule-lifegoods-whey-milk-derivative",
                "concept_id": "concept-food-allergen-milk",
                "source_id": "source-lifegoods-reviewed-allergen-mappings-issue-63",
                "rule_kind": "DERIVATIVE_MATCH",
                "condition_family": "FOOD_ALLERGEN",
                "mapping_id": "map-en-whey-derived",
                "description": None,
            }
        ],
    }

    bundle = ReferenceBundle.from_dict(payload)

    assert bundle.exclusions[0].id == "exclude-en-coconut-milk-for-milk"
    assert bundle.exclusions[0].excluded_text == "coconut milk"
    assert bundle.rules[0].mapping_id == "map-en-whey-derived"
    assert bundle.to_dict()["exclusions"] == payload["exclusions"]
    assert bundle.to_dict()["rules"] == payload["rules"]
