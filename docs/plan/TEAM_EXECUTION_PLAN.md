# LifeGoods Pilot-Ready MVP Execution Plan

This is the authoritative execution and branching plan for the LifeGoods production-pilot MVP. It coordinates four engineers (two frontend and two backend), qualified reviewers, operations, research, and the [`MVP Pilot v0.1`](https://github.com/internetOnion/life-goods/milestone/1) milestone.

The behavior in [`SPEC.md`](../SPEC.md), language in [`CONTEXT.md`](../../CONTEXT.md), invariants in [`DATA_MODEL.md`](../DATA_MODEL.md), and accepted [`adr/`](../adr/) decisions remain authoritative. Correct this plan if it conflicts with them.

## 1. Pilot-ready Definition of Done

The MVP is complete only when:

- Every included capability and recovery behavior in `SPEC.md` works in the responsive Web Client and Telegram Mini App.
- Approximately 100–200 locally observed Products are reviewed and loadable without private Package Capture evidence.
- Approximately 20–30 source-cited Knowledge Entries are approved by qualified Khmer and food-domain reviewers.
- The pilot allergen concepts, highest-frequency 100–150 additives, approximately 40–80 critical phrases, and needed multilingual synonyms are approved and versioned.
- A representative 50–100-image evaluation set has measured two or three hosted extraction providers and informed provider selection.
- Package Capture isolation, authorization, partial failure, retry, timeout, expiry, cleanup, and overdue-media alerting are verified.
- Staging and production-pilot environments use isolated data services, secrets, and allowed origins and have monitoring and rollback procedures.
- Khmer usability, physical-device, WCAG 2.2 AA, privacy, retention, and performance gates pass.
- No critical test participant interprets the interface as guaranteeing safety, health, allergen absence, Halal certification, legality, authenticity, or a purchase recommendation.

Automated tests alone do not establish pilot readiness. Content approval, operational readiness, and measured pilot evidence are release requirements.

## 2. Team model and review authority

The team works as two rotating journey pods, each with one frontend and one backend engineer. Pod missions change at wave boundaries so ownership follows the user journey rather than creating permanent cross-pod handoffs.

| Role | Responsibility |
| --- | --- |
| FE1 / FE2 | Web Client behavior, accessibility, localization, platform adapters, generated-client integration, and browser tests |
| BE1 / BE2 | Application behavior, domain invariants, persistence, jobs, external adapters, migrations, and backend tests |
| Engineer coordinator | Prepares evidence and review artifacts, schedules reviews, applies corrections, and records reviewer metadata |
| Qualified Khmer reviewer | Approves consequential Khmer wording and comprehension instruments |
| Qualified food-domain reviewer | Approves vocabulary, mappings, rules, Knowledge Entries, and reviewed catalog Claims within their competence |
| Privacy / operations reviewer | Approves provider data handling, isolation, retention, observability, incident, and rollback readiness |

Engineers coordinate review but do not self-approve Khmer or food-domain content without the required qualification. Moderator acceptance remains separate from authoritative-source confirmation.

## 3. Architecture and contract guardrails

- Preserve `GET /api/v1/package-matches?identifier={value}` as the existing Package Match interface.
- Define each new HTTP contract only inside the vertical slice that implements and tests its observable behavior.
- Commit generated OpenAPI clients with the backend contract in the same pull request; do not merge placeholder routes far ahead of implementation.
- Keep FastAPI handlers thin and place behavior behind focused application and domain module interfaces.
- Use `@zxing/browser` for camera and image barcode scanning, with native capability only as a tested progressive enhancement.
- Keep Package Capture intake, automated interpretation, catalog ingestion, and evaluation as separate modules and data flows.
- Use a provider-neutral extraction interface. Do not select a provider before [ADR 0006](../adr/0006-benchmark-ai-models-and-version-results.md) passes.
- Enforce [ADR 0007](../adr/0007-isolate-private-package-capture.md): private media and output never enter catalog, training, analytics, evaluation datasets, or manual review.
- Preserve original Label Transcription, evidence regions, language, Ingredient Occurrence structure, percentages, coverage, and ambiguity through every transformation.
- Use exact outcomes such as `NO_DECLARATION_DETECTED_IN_READABLE_LABEL`, `LABEL_INCOMPLETE_OR_UNREADABLE`, and `NOT_ASSESSED`. Use Evidence Uncertainty for missing, stale, conflicting, incomplete, unreadable, or unreviewed evidence.
- Present contextual Learn More in accessible sheets or drawers rather than hover-only tooltips.

## 4. Relative execution waves

Waves express dependencies, not calendar promises. Work may run in parallel only after declared blockers are complete and the shared contract is stable.

### Wave 0 — Foundation reconciliation

- [#1 Product identity and design system](https://github.com/internetOnion/life-goods/issues/1)
- [#2 Data model](https://github.com/internetOnion/life-goods/issues/2)
- [#3 User stories](https://github.com/internetOnion/life-goods/issues/3)
- [#4 Manual identifier walking skeleton](https://github.com/internetOnion/life-goods/issues/4)

Gate: domain, product direction, data model, repository foundation, and the manual identifier journey are present on `mvp/foundation`.

### Wave 1 — Package Match foundation

| Pod 1: external acquisition | Pod 2: durable evidence |
| --- | --- |
| [#5 OFF Package Match with provenance](https://github.com/internetOnion/life-goods/issues/5) | [#6 Reviewed local Package Match precedence](https://github.com/internetOnion/life-goods/issues/6) |
| [#16 OFF licensing and attribution approval](https://github.com/internetOnion/life-goods/issues/16) | [#11 Deterministic pilot scenario set](https://github.com/internetOnion/life-goods/issues/11) |

Gate: known identifiers return attributable candidates; reviewed and external evidence remain distinct; variants, revisions, conflicts, and missing-field semantics are preserved; no empty upstream field becomes a negative Claim.

### Wave 2 — Identification completeness

| Pod 1: scan and host | Pod 2: search and recovery |
| --- | --- |
| [#7 Camera barcode scanning and recovery](https://github.com/internetOnion/life-goods/issues/7) | [#17 Multilingual catalog search](https://github.com/internetOnion/life-goods/issues/17) |
| [#18 Telegram Mini App adapter](https://github.com/internetOnion/life-goods/issues/18) | [#8 External uncertainty and recovery](https://github.com/internetOnion/life-goods/issues/8) |

Gate: manual entry, camera scanning, and search converge on the same Package Match, source, uncertainty, and recovery behavior in browsers and Telegram.

### Wave 3 — Private capture and evaluation

| Pod 1: private intake | Pod 2: evaluation foundation |
| --- | --- |
| [#9 Package Capture intake and expiry](https://github.com/internetOnion/life-goods/issues/9) | [#19 Provider-neutral extraction and provenance](https://github.com/internetOnion/life-goods/issues/19) |
| Session authorization, isolation, cleanup, and overdue-media observability | [#21 Provider benchmark and model selection](https://github.com/internetOnion/life-goods/issues/21) |

Gate: private intake is isolated and expiring; the benchmark uses project-owned or consented data; provider terms are approved; selection follows measured results.

### Wave 4 — Evidence interpretation foundations

| Pod 1: processing and transcription | Pod 2: reviewed publishing workflows |
| --- | --- |
| [#22 Private Package Capture processing](https://github.com/internetOnion/life-goods/issues/22) | [#24 Reviewed Safety Vocabulary workflow](https://github.com/internetOnion/life-goods/issues/24) |
| [#23 Label Transcription, ingredient structure, and Khmer names](https://github.com/internetOnion/life-goods/issues/23) | Begin [#25 Knowledge Entry publishing and Learn More](https://github.com/internetOnion/life-goods/issues/25) |

Gate: original evidence survives extraction and translation; private results remain private; approved and unreviewed content are distinguishable; published vocabulary is immutable.

### Wave 5 — Assessments and Shopper Guidance

| Pod 1: consequential matching | Pod 2: interpretation and presentation |
| --- | --- |
| [#28 Allergen Assessment](https://github.com/internetOnion/life-goods/issues/28) | [#30 Additive Assessment](https://github.com/internetOnion/life-goods/issues/30) |
| [#29 Halal Ingredient Assessment and Seal Observation](https://github.com/internetOnion/life-goods/issues/29) | [#31 Date Interpretation](https://github.com/internetOnion/life-goods/issues/31) |
| Integrate approved vocabulary and exact evidence spans | [#10 Khmer evidence-backed result](https://github.com/internetOnion/life-goods/issues/10) and complete [#25](https://github.com/internetOnion/life-goods/issues/25) |

Gate: every consequential outcome traces to readable evidence, approved vocabulary, a versioned rule, and an Assessment Run. Ingredient screening, Seal Observation, and certificate verification remain separate.

### Wave 6 — Pilot content and anonymous experience

| Pod 1: reviewed catalog and content | Pod 2: anonymous shopper experience |
| --- | --- |
| [#20 Reviewed catalog ingestion and audit](https://github.com/internetOnion/life-goods/issues/20) | [#33 Local preferences and session-only history](https://github.com/internetOnion/life-goods/issues/33) |
| [#32 Populate the 100–200 Product catalog](https://github.com/internetOnion/life-goods/issues/32) | [#12 Anonymous telemetry and privacy controls](https://github.com/internetOnion/life-goods/issues/12) |
| [#26 Approve pilot safety vocabulary](https://github.com/internetOnion/life-goods/issues/26) and [#27 approve Knowledge Entries](https://github.com/internetOnion/life-goods/issues/27) | Complete browser journeys without accounts or persistent identity |

Gate: required catalog and content are published; preferences never hide critical concerns; history is session-only; journeys are measurable without private data entering analytics or catalog storage.

### Wave 7 — Deployment and pilot validation

| Pod 1: operations | Pod 2: validation and remediation |
| --- | --- |
| [#34 Isolated pilot infrastructure and safeguards](https://github.com/internetOnion/life-goods/issues/34) | [#35 Khmer, device, privacy, accessibility, and performance validation](https://github.com/internetOnion/life-goods/issues/35) |
| Migrations, monitoring, cleanup alerts, smoke checks, and rollback | Coordinate research, record failures, land corrections, and rerun blocked gates |

Final release issue: [#13 Deploy and verify the pilot-ready MVP](https://github.com/internetOnion/life-goods/issues/13).

Gate: all specification thresholds, content counts, privacy checks, operational drills, device checks, WCAG journey checks, and Khmer comprehension gates pass. Critical interpretation failures require correction and retest.

## 5. Issue and pull-request standard

Every implementation issue contains:

1. user outcome;
2. behavioral acceptance criteria;
3. explicit exclusions;
4. interfaces affected;
5. `Blocked by` relationships;
6. human-review responsibility;
7. automated and manual verification;
8. the release gate it satisfies.

Use `ready-for-agent` only after those decisions are complete. Apply `frontend`, `backend`, `evaluation`, `content-review`, `privacy`, `operations`, `research`, and `accessibility` labels according to actual work.

Pull requests explain the user-visible result, link the issue, describe verification, identify contract or migration changes, call out privacy and reviewer implications, and include screenshots for shopper-facing changes.

## 6. Branching and integration workflow

Until the pilot-ready foundation is accepted into `main`:

```text
main
└── mvp/foundation
    ├── feat/<issue-id>-<slug>
    ├── fix/<issue-id>-<slug>
    ├── test/<issue-id>-<slug>
    └── docs/<issue-id>-<slug>
```

- Create each branch from the latest `mvp/foundation` and target its pull request at `mvp/foundation`.
- Keep a branch to one observable behavior and normally 1–3 days. Split larger work.
- Do not chain unrelated feature branches. A dependent stacked branch targets its immediate parent and is rebased after the parent merges.
- Keep `mvp/foundation` deployable and synchronize long-running branches before contract integration.
- Squash-merge reviewed pull requests and delete remote branches.
- Do not use permanent frontend, backend, staging, production, or generic develop branches.
- After every Wave 7 gate passes, open one reviewed pull request from `mvp/foundation` to `main`, then delete the temporary integration branch after merge.
- Deploy environments from commits, not environment branches.

## 7. Verification gates

### Pull-request gate

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm api:check
```

Run applicable migration tests and focused Playwright journeys. Generated-client drift, formatting, type, test, or build failure blocks merge.

### Integration gate

- Run `pnpm test:e2e`.
- Apply migrations to an empty database and from the previous integration state.
- Verify deterministic external fixtures, worker idempotency, retry and timeout behavior, privacy isolation, retention, and inaccessible expired media.
- Verify Web Client and backend use the committed OpenAPI contract.

### Release gate

- Run staging smoke tests with production-shaped services and isolated configuration.
- Verify monitoring, scrubbing, cleanup alerts, overdue-media alerts, migration release steps, rollback, and incident contacts.
- Complete physical-device, Telegram WebView, accessibility, Khmer rendering, and performance checks.
- Confirm OFF attribution and every human-review approval record.

### Pilot gate

- At least 80% of valid known barcodes return usable identity information.
- At least 90% of known results complete within three seconds under documented conditions.
- At least 80% of completed Package Captures return an interpretation within 15 seconds.
- At least 80% of participants distinguish a declared concern, no declaration detected in readable evidence, and Evidence Uncertainty.
- Any safety, Halal, allergen-free, legal, authenticity, or purchase guarantee interpretation is a critical failure.
- Catalog, Knowledge Entry, vocabulary, privacy, and evaluation readiness counts are documented and approved.

## 8. Explicitly deferred

The plan does not add offline operation, public contribution and reputation, SME authenticity advisories, nutrition scores or visualizations, certificate verification beyond Seal Observation, legal Compliance Assessments, Telegram share cards, Official Report Referrals, or a broad Food Literacy Hub.
