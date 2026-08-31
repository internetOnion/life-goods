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

## Current HALAL_INGREDIENT release

The production-ready release is `halal-ingredient-2026-reviewed-english-v1`, grounded in
Cambodian Joint Prakas No. 090 (2020), licensed OIC/SMIIC 1:2019, licensed OIC/SMIIC 24:2020,
and project-reviewed Issue 67 mapping sources approved by a qualified Halal domain reviewer.
The immutable release records `cambodia-halal-reviewer@lifegoods.org` as the reviewer,
`HALAL_DOMAIN_REVIEW` as the review kind, and canonical SHA-256
`fa2b3088080e4d1e6938610d518880231ea4a4cc0b5ffee3bfbf1ce5ae795a78`. Its source envelope
retains all four source records, including the project-authored Issue 67 vocabulary source,
even when a source is not cited directly by a classification row.
It contains:

- 13 active leaf concepts for `EXPLICIT_PROHIBITED` ingredients: pork, bacon, ham, lard, porcine
  gelatin, alcohol, wine, beer, rum, liqueur, mirin, blood, and carrion;
- 11 active leaf concepts for `SOURCE_AMBIGUOUS` ingredients: gelatin, collagen, mono- and diglycerides
  of fatty acids (E471), L-cysteine (E920), rennet, pepsin, glycerol (E422), carmine (E120),
  stearic acid (E570), tallow, and shellac (E904);
- 68 English lexical mappings including exact names, spelling variants, and derived ingredient terms;
- Source citations with jurisdiction, edition, and locator distinguishing Cambodian national regulation
  from licensed international SMIIC standards.

The release contains no positive Halal whitelist, blanket additive verdicts, certificate claims, or
Product-level conclusions. The synthetic `synthetic-halal-ingredient-2026-v1` bundle remains available
for engineering and rollback testing.

## Local setup

Start the databases and non-durable cache, then apply all migrations, including the
Reference Dataset Version/source association and inactive-pointer rollout controls through
revision `0009`:

```bash
docker compose -f infra/compose.yaml up -d postgres mongodb redis
pnpm db:migrate
```

Validate, import, and activate the complete releases:

```bash
# Food Allergens
pnpm reference:dataset -- validate backend/src/lifegoods/reference_datasets/bundles/codex_2026_food_allergen_reviewed_english_v1.json
pnpm reference:dataset -- import backend/src/lifegoods/reference_datasets/bundles/codex_2026_food_allergen_reviewed_english_v1.json
pnpm reference:dataset -- activate codex-food-allergen-2026-reviewed-english-v1 --approver lifegoods --review-kind PROJECT_MAINTAINER_APPROVAL
pnpm reference:dataset -- status --dataset-kind FOOD_ALLERGEN

# Halal Ingredients
pnpm reference:dataset -- validate backend/src/lifegoods/reference_datasets/bundles/halal_ingredient_2026_reviewed_english_v1.json
pnpm reference:dataset -- import backend/src/lifegoods/reference_datasets/bundles/halal_ingredient_2026_reviewed_english_v1.json
pnpm reference:dataset -- activate halal-ingredient-2026-reviewed-english-v1 --approver lifegoods --review-kind PROJECT_MAINTAINER_APPROVAL
pnpm reference:dataset -- status --dataset-kind HALAL_INGREDIENT
```

Import is idempotent for the same version ID and integrity hash. A conflicting payload under an
existing version ID is rejected.
Re-running an identical import after migration `0009` also repairs any missing version/source
associations without changing the immutable release hash or content.

The reviewed English and minimal bundles have new immutable hashes. Development databases that
already contain either former pre-release payload must be rebuilt before import; the importer
intentionally does not overwrite an existing version ID with a different hash.

Enable stateless evaluation in `backend/.env` only after activation:

```dotenv
LIFEGOODS_ALLERGEN_ASSESSMENTS_ENABLED=true
LIFEGOODS_ASSESSMENT_ENGINE_VERSION=0.1.0
LIFEGOODS_HALAL_INGREDIENT_ASSESSMENTS_ENABLED=true
LIFEGOODS_HALAL_INGREDIENT_ASSESSMENT_ENGINE_VERSION=0.1.0
LIFEGOODS_ASSESSMENT_CACHE_ENABLED=true
LIFEGOODS_REDIS_URL=redis://localhost:6380/0
LIFEGOODS_REDIS_TIMEOUT_SECONDS=0.5
LIFEGOODS_ASSESSMENT_CACHE_TTL_SECONDS=604800
```

Then start the backend normally with `pnpm backend:dev`.
The legacy `LIFEGOODS_HALAL_ASSESSMENTS_ENABLED` and
`LIFEGOODS_HALAL_ASSESSMENT_ENGINE_VERSION` names remain accepted for compatibility. If both a
legacy and canonical variable are present, the canonical `HALAL_INGREDIENT` value wins.

## Availability and failure states

Every Package Match candidate contains `allergen_assessment` and
`halal_ingredient_assessment`. Evaluation availability is separate from the candidate's
Evidence-derived outcomes:

| Status         | Reason                  | Operator meaning                                                                                                                                   |
| -------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `COMPLETED`    | `null`                  | Evaluation ran against readable English Evidence and the Active Reference Dataset Version. Concept outcomes may still be incomplete or unreadable. |
| `NOT_ASSESSED` | `FEATURE_DISABLED`      | The applicable Allergen or Halal Ingredient feature flag is false.                                                                                 |
| `NOT_ASSESSED` | `REFERENCE_UNAVAILABLE` | No valid release of the applicable dataset kind is active. Validate, import, inspect, and activate it before enabling the feature.                 |
| `NOT_ASSESSED` | `EVIDENCE_UNAVAILABLE`  | The OFF candidate has no available readable English ingredient Evidence. This is unknown, not a negative Claim.                                    |
| `NOT_ASSESSED` | `ASSESSMENT_FAILED`     | Evaluation failed unexpectedly. Inspect backend logs; Package Match remains available without a verdict.                                           |

Disabled or unavailable assessment states remain HTTP 200 whenever the Active OFF Dataset
Version served the Package Match candidate. An unavailable Active OFF Dataset Version remains
a separate HTTP 503 Package Match source failure.

## Shared limiting and non-durable Redis cache

Redis provides the default cross-process sliding-window limit for Package Match requests and
the optional Assessment Evaluation cache. Rate-limit keys contain only a SHA-256 digest of the
ASGI client address and expire after the 60-second window. Redis never stores raw client
addresses, shopper identity, preferences, session data, Package Capture data, or durable
Assessment Runs. Assessment cache keys include the OFF Dataset Version, OFF record and source
revision/Evidence digest, Reference Dataset Version, and engine version. Assessment entries
expire after seven days by default.

If shared limiting is unavailable, each API process uses a bounded local limiter for five
seconds before probing Redis again. Once the configured local client-key cap is reached, new
clients share one overflow bucket; active client buckets are not evicted. This preserves API
availability but cannot guarantee one global budget during the outage. Degradation and
recovery are logged once per transition.

A cache miss, expired entry, malformed payload, or payload from the former status contract is
recomputed and safely replaced. Redis connection and request failures are bypassed within the
configured timeout; they do not introduce an API state or change Assessment Evaluation
results. Operators may disable caching with `LIFEGOODS_ASSESSMENT_CACHE_ENABLED=false` or flush
only this non-durable Redis database during troubleshooting.

The API derives rate-limit identity only from `request.client.host`; it does not trust an
incoming `X-Forwarded-For` header directly. When deploying behind a reverse proxy, configure
the ASGI server's proxy-header support with an explicit allowlist of proxy addresses. Do not
trust arbitrary forwarding sources.

The OFF source reads the active pointer on every lookup and caches validated immutable
manifest metadata by Dataset Version. A known-product steady-state lookup therefore performs
the pointer read and product lookup; a no-match also verifies that the selected collection
still exists. Reference Dataset evaluation likewise confirms the joined active pointer and
version on every evaluation while caching immutable concepts, mappings, exclusions, and rules
by version and activation. A MongoDB failure produces HTTP 503. A Reference Dataset failure
does not serve stale rules: the candidate remains HTTP 200 with `REFERENCE_UNAVAILABLE`.

This release is backend-only. It adds no allergy profile or preference parameters, separate
allergen endpoint, shopper personalization, Package Capture storage, or translation behavior.
The Halal Ingredient Assessment reads English ingredient Evidence only. It does not interpret
community Halal label Claims, populate Seal Observation, verify a Certificate, or conclude that
a Product or Package Match is Halal.

Package Match completion logs expose only the allowlisted Halal fields
`halal_ingredient_assessment_status`, `halal_ingredient_assessment_reason`,
`halal_ingredient_assessment_engine_version`, and
`halal_ingredient_reference_dataset_version_id`. They exclude identifiers, client addresses or
digests, raw label text, findings, shopper identity, and private Package Capture data.

## Inspect and roll back

Inspect the active pointer or immutable version contents:

```bash
# Food Allergens
pnpm reference:dataset -- status --dataset-kind FOOD_ALLERGEN
pnpm reference:dataset -- inspect codex-food-allergen-2026-reviewed-english-v1

# Halal Ingredients
pnpm reference:dataset -- status --dataset-kind HALAL_INGREDIENT
pnpm reference:dataset -- inspect halal-ingredient-2026-reviewed-english-v1

# All versions
pnpm reference:dataset -- list
```

Activation retains the immediately previous valid version. If an operational rollback is
required, record the responsible operator:

```bash
pnpm reference:dataset -- rollback --dataset-kind FOOD_ALLERGEN --approver lifegoods --review-kind PROJECT_MAINTAINER_APPROVAL
pnpm reference:dataset -- rollback --dataset-kind HALAL_INGREDIENT --approver lifegoods --review-kind PROJECT_MAINTAINER_APPROVAL
```

Rollback changes the active pointer; it does not mutate or delete immutable release content. If
there is no predecessor, rollback records an explicit inactive pointer and returns the first
release to `READY`, so evaluation reports `REFERENCE_UNAVAILABLE` until a valid release is
activated again.

## Staging and production enablement

Use the same commit in each environment, with isolated PostgreSQL, MongoDB, Redis, secrets, and
configuration. For the reviewed Halal release:

1. Run migrations, validate the committed bundle, and import it idempotently.
2. Inspect it and verify the version ID, canonical hash, four sources and licensing decisions,
   `cambodia-halal-reviewer@lifegoods.org`, and `HALAL_DOMAIN_REVIEW`.
3. Activate it with the responsible operator and `PROJECT_MAINTAINER_APPROVAL`, then confirm that
   status reports both the immutable release review and the operational approval.
4. Only then set `LIFEGOODS_HALAL_INGREDIENT_ASSESSMENTS_ENABLED=true` and restart or redeploy the
   backend. Configuration is read at process startup.
5. Run the six reviewed-release Package Match integration scenarios before production enablement.

For immediate rollback, set the feature flag to `false` and restart or redeploy first. Then run
the recorded pointer rollback command. It restores the previous valid version when one exists or
records the pre-release inactive state for this first production-ready Halal release.

Each deployed environment has its own PostgreSQL state, so migration, import, activation, and
feature-flag configuration must be performed independently in local, staging, and production
environments.
