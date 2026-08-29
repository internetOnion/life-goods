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

Start the databases and non-durable cache, then apply all migrations, including the
mapping-linked rule and lexical exclusion schema in revision `0007`:

```bash
docker compose -f infra/compose.yaml up -d postgres mongodb redis
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
LIFEGOODS_ASSESSMENT_ENGINE_VERSION=0.1.0
LIFEGOODS_ASSESSMENT_CACHE_ENABLED=true
LIFEGOODS_REDIS_URL=redis://localhost:6380/0
LIFEGOODS_REDIS_TIMEOUT_SECONDS=0.5
LIFEGOODS_ASSESSMENT_CACHE_TTL_SECONDS=604800
```

Then start the backend normally with `pnpm backend:dev`.

## Availability and failure states

Every Package Match candidate contains `allergen_assessment`. Evaluation availability is
separate from the candidate's per-concept outcomes:

| Status         | Reason                  | Operator meaning                                                                                                                                   |
| -------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `COMPLETED`    | `null`                  | Evaluation ran against readable English Evidence and the Active Reference Dataset Version. Concept outcomes may still be incomplete or unreadable. |
| `NOT_ASSESSED` | `FEATURE_DISABLED`      | `LIFEGOODS_ALLERGEN_ASSESSMENTS_ENABLED` is false.                                                                                                 |
| `NOT_ASSESSED` | `REFERENCE_UNAVAILABLE` | No valid `FOOD_ALLERGEN` release is active. Validate, import, and activate a release before enabling the feature.                                  |
| `NOT_ASSESSED` | `EVIDENCE_UNAVAILABLE`  | The OFF candidate has no available readable English ingredient Evidence. This is unknown, not a negative Claim.                                    |
| `NOT_ASSESSED` | `ASSESSMENT_FAILED`     | Evaluation failed unexpectedly. Inspect backend logs; Package Match remains available without a verdict.                                           |

Disabled or unavailable assessment states remain HTTP 200 whenever the Active OFF Dataset
Version served the Package Match candidate. An unavailable Active OFF Dataset Version remains
a separate HTTP 503 Package Match source failure.

## Non-durable Redis cache

Redis is optional and never stores shopper identity, preferences, session data, Package
Capture data, or durable Assessment Runs. Cache keys include the OFF Dataset Version, OFF
record and source revision/Evidence digest, Reference Dataset Version, and engine version.
Entries expire after seven days by default.

A cache miss, expired entry, malformed payload, or payload from the former status contract is
recomputed and safely replaced. Redis connection and request failures are bypassed within the
configured timeout; they do not introduce an API state or change Assessment Evaluation
results. Operators may disable caching with `LIFEGOODS_ASSESSMENT_CACHE_ENABLED=false` or flush
only this non-durable Redis database during troubleshooting.

This release is backend-only. It adds no allergy profile or preference parameters, separate
allergen endpoint, shopper personalization, Package Capture storage, or translation behavior.

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
