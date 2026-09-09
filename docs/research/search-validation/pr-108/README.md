# PR #108 review-fix validation

This directory retains new evidence for the fixes on `feat/product-search`.
The issue #107 corpus, labels, targets and historical artifacts remain unchanged.
See [FINDINGS.md](FINDINGS.md) for results and acceptance status.

## Reproduce HTTP measurements

Use the existing production-compatible schema-1 index and local MongoDB/Redis.
No rebuild, Dataset Snapshot activation, provider calls or Source Record writes
are required. Run the server and measurement command in separate terminals:

```text
uv run --project backend python backend/scripts/search_acceptance.py serve
uv run --project backend python backend/scripts/search_acceptance.py run --output /path/to/new-http-measurements.json
uv run --project backend python backend/scripts/search_acceptance.py plans --output /path/to/new-plans.json
uv run --project backend python backend/scripts/search_acceptance.py smoke --pagination-query "Lutti Lutti Bubblizz" --output /path/to/new-smoke.json
```

Choose new output paths to retain historical runs. The benchmark uses loopback
port 8107, Redis database 14, and an increased benchmark-only request limit.
The normal runtime configuration is unchanged. The first pass is not a claim of
cold disk-cache performance. Plans now capture every actual tier/probe command,
including hints and remaining execution budgets. Exhaustive pagination comparison
uses the original global-ranking aggregate as an independent ordering oracle.

## Disposable integration tests

Provide both `LIFEGOODS_TEST_OFF_MONGODB_READER_URI` and
`LIFEGOODS_TEST_OFF_MONGODB_WRITER_URI` through the environment, using the native
syntax of your shell or environment manager. Both URI paths must name
`lifegoods_off_test`. Provision dedicated MongoDB users with `read` and `readWrite`
roles, respectively, on that test database only. It must not be the configured
application database. Do not reuse the application's Source Record identities.

```text
uv run --project backend pytest backend/tests/test_product_search_integration.py --run-integration
```

Tests skip if either explicit URI is absent and reject unsafe database targets
before opening clients. Fixtures use unique collection/version names, never replace
an existing active pointer, and clean their own state through `finally`. Run this
suite serially against an otherwise unused disposable database. An interrupted
process may leave test data there; it cannot alter the application Dataset Snapshot.
The safety and cleanup tests use in-memory storage and run in the normal suite.

For this run, temporary least-privilege identities were provisioned in the empty
test database. Their credentials are not stored in the repository or evidence.
