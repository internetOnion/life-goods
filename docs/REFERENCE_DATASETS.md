# Reference Dataset Operations

LifeGoods stores immutable, reviewed Reference Dataset Versions in PostgreSQL. Importing a
release validates and persists it; activation is a separate, atomic operator decision. Neither
database migrations nor application startup import or activate reference data.

## Current FOOD_ALLERGEN release

The complete release is `codex-food-allergen-2026-reviewed-english-v1`, sourced from Codex CXS
1-1985 as amended in 2026 and the project-reviewed Issue 63 mapping source. It contains:

- 26 active leaf concepts with reviewed English `EXACT_NAME` mappings;
- two project-reviewed `DERIVED_FROM` mappings: `whey` to milk and `tahini` to sesame;
- one concept-scoped lexical exclusion that suppresses milk inside `coconut milk`;
- 26 applicable declaration rules, including typed regional-or-national rules;
- two mapping-linked derivative rules;
- one root exemption rule;
- three non-emitting parent groups: `FOOD_ALLERGEN`, Fish, and Specific tree nuts.

Package Match preserves each accepted, non-overlapping finding in source order, including
repeated findings for one concept. `parent_ids` records ancestry from the direct parent to the
root, and `rule_ids` identifies rules applicable to the leaf. Parent groups never emit
assessment outcomes. Direct-name findings expose their declaration rule; derivative findings
expose their mapping-specific derivative rule. Exclusions are matcher inputs and are not
returned by the shopper-facing API.

The release deliberately excludes every derivative except whey and tahini, synonym mappings,
non-English mappings, Open Food Facts taxonomy mappings, wheat, rye, barley, oats, sulphite,
lactose, and other condition families. The immutable `codex-food-allergen-2026-minimal`
milk/whey release remains available for tracer and rollback testing; it is not complete
allergen coverage.

## Local setup

Start the databases and apply all migrations, including the mapping-linked rule and lexical
exclusion schema in revision `0007`:

```bash
docker compose -f infra/compose.yaml up -d postgres mongodb
pnpm db:migrate
```

Validate, import, and activate the complete release:

```bash
pnpm reference:dataset -- validate backend/src/lifegoods/reference_datasets/bundles/codex_2026_food_allergen_reviewed_english_v1.json
pnpm reference:dataset -- import backend/src/lifegoods/reference_datasets/bundles/codex_2026_food_allergen_reviewed_english_v1.json
pnpm reference:dataset -- activate codex-food-allergen-2026-reviewed-english-v1
pnpm reference:dataset -- status --dataset-kind FOOD_ALLERGEN
```

Import is idempotent for the same version ID and integrity hash. A conflicting payload under an
existing version ID is rejected.

The reviewed English and minimal bundles have new immutable hashes. Development databases that
already contain either former pre-release payload must be rebuilt before import; the importer
intentionally does not overwrite an existing version ID with a different hash.

Enable stateless evaluation in `backend/.env` only after activation:

```dotenv
LIFEGOODS_ALLERGEN_ASSESSMENTS_ENABLED=true
```

Then start the backend normally with `pnpm backend:dev`.

## Inspect and roll back

Inspect the active pointer or immutable version contents:

```bash
pnpm reference:dataset -- status --dataset-kind FOOD_ALLERGEN
pnpm reference:dataset -- inspect codex-food-allergen-2026-reviewed-english-v1
pnpm reference:dataset -- list
```

Activation retains the immediately previous valid version. If an operational rollback is
required, record the responsible operator:

```bash
pnpm reference:dataset -- rollback --dataset-kind FOOD_ALLERGEN --approver <operator>
```

Rollback changes the active pointer; it does not mutate or delete either immutable release.

Each deployed environment has its own PostgreSQL state, so migration, import, activation, and
feature-flag configuration must be performed independently in local, staging, and production
environments.
