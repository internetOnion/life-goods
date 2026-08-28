# LifeGoods Pilot-Ready MVP Execution Plan

This is the authoritative execution and branching plan for the LifeGoods production-pilot MVP. It coordinates four engineers (two frontend and two backend), qualified reviewers, operations, research, and the [`MVP Pilot v0.1`](https://github.com/internetOnion/life-goods/milestone/1) milestone.

The behavior in [`SPEC.md`](../SPEC.md), language in [`CONTEXT.md`](../../CONTEXT.md), invariants in [`DATA_MODEL.md`](../DATA_MODEL.md), and accepted [`adr/`](../adr/) decisions remain authoritative. Correct this plan if it conflicts with them.

## 1. Pilot-ready Definition of Done

The MVP is complete only when:

- Every included capability and recovery behavior in `SPEC.md` works in the responsive Web Client and Telegram Mini App.
- One validated Active OFF Dataset Version serves Product records from project-operated MongoDB without live Product API fallback.
- Immutable PostgreSQL reference versions for allergen, Halal ingredient, additive, ingredient-description, and Learn data are licensed, human-reviewed, activated, and rollback-ready.
- The Learn section has reviewed English entries for every consequential assessment and evidence concept exposed by MVP-1; no fixed entry count is required.
- Ingredient descriptions are concise, project-authored, English-first, source-cited, and linked to stable concepts where available.
- Locally observed Product seed data, reviewed-local precedence, Product Claims, Preferred Claims, conflicts, and catalog moderation remain deferred post-MVP.
- A representative 50–100-image evaluation set has measured two or three hosted extraction providers and informed provider selection.
- Package Capture isolation, authorization, partial failure, retry, timeout, expiry, cleanup, and overdue-media alerting are verified.
- Staging and production-pilot environments use isolated data services, secrets, and allowed origins and have monitoring and rollback procedures.
- Khmer usability, physical-device, WCAG 2.2 AA, privacy, retention, and performance gates pass.
- No critical test participant interprets the interface as guaranteeing safety, health, allergen absence, Halal certification, legality, authenticity, or a purchase recommendation.

Automated tests alone do not establish pilot readiness. Content approval, operational readiness, and measured pilot evidence are release requirements.

## 2. Team model and review authority

The team works as two rotating journey pods, each with one frontend and one backend engineer. Pod missions change at wave boundaries so ownership follows the user journey rather than creating permanent cross-pod handoffs.

| Role                            | Responsibility                                                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| FE1 / FE2                       | Web Client behavior, accessibility, localization, platform adapters, generated-client integration, and frontend unit/component tests |
| BE1 / BE2                       | Application behavior, domain invariants, persistence, jobs, external adapters, migrations, and backend tests                         |
| Engineer coordinator            | Prepares evidence and review artifacts, schedules reviews, applies corrections, and records reviewer metadata                        |
| Qualified Khmer reviewer        | Approves consequential Khmer interface wording and comprehension instruments                                                         |
| Qualified food-domain reviewer  | Approves reference vocabularies, mappings, rules, English explanations, and Knowledge Entries within their competence                |
| Qualified Halal-domain reviewer | Approves project-authored prohibited/source-ambiguous Halal ingredient mappings within the cited source scope                        |
| Privacy / operations reviewer   | Approves provider data handling, isolation, retention, observability, incident, and rollback readiness                               |

Engineers coordinate review but do not self-approve consequential content without the required qualification. Reference Dataset Version approval is separate from Product review, verification, and authoritative-source confirmation.

## 3. Architecture and contract guardrails

- Preserve `GET /api/v1/package-matches?identifier={value}` as the existing Package Match interface.
- Define each new HTTP contract only inside the vertical slice that implements and tests its observable behavior.
- Commit generated OpenAPI clients with the backend contract in the same pull request; do not merge placeholder routes far ahead of implementation.
- Keep FastAPI handlers thin and place behavior behind focused application and domain module interfaces.
- Use `@zxing/browser` for camera and image barcode scanning, with native capability only as a tested progressive enhancement.
- Keep Package Capture intake, automated interpretation, catalog ingestion, and evaluation as separate modules and data flows.
- Serve MVP-1 Product records only from the Active OFF Dataset Version in MongoDB; never treat local storage, activation, citations, or integrity hashes as Product review.
- Store assessment reference versions in PostgreSQL with source, license, jurisdiction, edition, retrieval, integrity, reviewer, validation, activation, and rollback metadata.
- Keep Cambodian rules, Codex international references, jurisdiction-specific rules, lexical taxonomies, ontologies, and project-authored explanations separate.
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

| Pod 1: external acquisition                                                                              | Pod 2: deterministic evidence                                                                           |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [#53 Pinned OFF Dataset Version](https://github.com/internetOnion/life-goods/issues/53)                  | [#11 External-evidence and assessment scenarios](https://github.com/internetOnion/life-goods/issues/11) |
| [#16 OFF dataset/image licensing and attribution](https://github.com/internetOnion/life-goods/issues/16) | Preserve sparse, unavailable, and citation-only behavior                                                |

Gate: known identifiers return attributable OFF candidates from a pinned local dataset; every field/image retains citations and Dataset Version metadata; no empty upstream field becomes a negative Claim; no reviewed Product data is implied or written.

### Post-Wave 1 — Shopper experience scaffold checkpoint

After [#5](https://github.com/internetOnion/life-goods/issues/5) is complete, [#47](https://github.com/internetOnion/life-goods/issues/47) establishes the production-quality shopper-facing route and page skeleton before the remaining feature backends are available. This checkpoint does not add placeholder HTTP contracts or generated-client changes.

| Foundation first                                                                                                   | Parallel page-family work after foundation                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| [#51 MVP routes, demo mode, and feature-owned translations](https://github.com/internetOnion/life-goods/issues/51) | [#50 Search and evidence-scoped Shopper Guidance skeleton](https://github.com/internetOnion/life-goods/issues/50) |
|                                                                                                                    | [#52 Private Package Capture skeleton](https://github.com/internetOnion/life-goods/issues/52)                     |
|                                                                                                                    | [#48 Learn index and Allergies preferences skeleton](https://github.com/internetOnion/life-goods/issues/48)       |

The scaffold follows these boundaries:

- Real implemented capabilities, including the Open Food Facts Package Match journey, continue using real data and preserve real empty, no-match, and unavailable outcomes.
- Unfinished interactive flows use visibly simulated inline fixtures only when `VITE_MVP_DEMO_MODE=true`; scenario URLs cannot enable fixture behavior by themselves.
- Normal builds show honest unavailable states for unfinished capabilities and never fall back to fixtures after a real failure.
- Package Capture fixtures never request camera permission, open a file picker, read media, upload data, or create provisional storage or API contracts.
- Scaffold Khmer copy remains draft until the owning feature issue coordinates qualified review.
- The existing History route and placeholder remain unchanged; [#33](https://github.com/internetOnion/life-goods/issues/33) retains its implementation and session-lifetime decisions.

Gate: every shopper-facing MVP destination has a stable responsive and accessible frontend boundary; demo content remains explicit and isolated; the three page-family issues can proceed in parallel without shared route or translation ownership conflicts.

### Wave 2 — Identification completeness

| Pod 1: scan and host                                                                            | Pod 2: search and recovery                                                                   |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [#7 Camera barcode scanning and recovery](https://github.com/internetOnion/life-goods/issues/7) | [#17 OFF multilingual search](https://github.com/internetOnion/life-goods/issues/17)         |
| [#18 Telegram Mini App adapter](https://github.com/internetOnion/life-goods/issues/18)          | [#8 External uncertainty and recovery](https://github.com/internetOnion/life-goods/issues/8) |

Gate: manual entry, camera scanning, and search converge on the same Package Match, source, uncertainty, and recovery behavior in browsers and Telegram.

### Wave 3 — Private capture and evaluation

| Pod 1: private intake                                                                        | Pod 2: evaluation foundation                                                                            |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [#9 Package Capture intake and expiry](https://github.com/internetOnion/life-goods/issues/9) | [#19 Provider-neutral extraction and provenance](https://github.com/internetOnion/life-goods/issues/19) |
| Session authorization, isolation, cleanup, and overdue-media observability                   | [#21 Provider benchmark and model selection](https://github.com/internetOnion/life-goods/issues/21)     |

Gate: private intake is isolated and expiring; the benchmark uses project-owned or consented data; provider terms are approved; selection follows measured results.

### Wave 4 — Evidence interpretation foundations

| Pod 1: processing and transcription                                                              | Pod 2: reference-data releases                                                                               |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| [#22 Private Package Capture processing](https://github.com/internetOnion/life-goods/issues/22)  | [#24 Versioned reference dataset release workflow](https://github.com/internetOnion/life-goods/issues/24)    |
| [#23 Label text and ingredient structure](https://github.com/internetOnion/life-goods/issues/23) | Begin [#25 English-first Knowledge Entries and Learn](https://github.com/internetOnion/life-goods/issues/25) |

Gate: original evidence survives extraction; private results remain private; activated and unavailable reference data are distinguishable; published reference versions are immutable and do not imply Product verification.

### Wave 5 — Assessments and Shopper Guidance

| Pod 1: consequential matching                                                            | Pod 2: interpretation and presentation                                                                                                                                |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#28 Allergen Assessment](https://github.com/internetOnion/life-goods/issues/28)         | [#30 Additive Assessment](https://github.com/internetOnion/life-goods/issues/30)                                                                                      |
| [#29 Halal Ingredient Assessment](https://github.com/internetOnion/life-goods/issues/29) | [#31 Date Interpretation](https://github.com/internetOnion/life-goods/issues/31)                                                                                      |
| Integrate activated reference data and exact evidence spans                              | [#10 Evidence-backed Product result](https://github.com/internetOnion/life-goods/issues/10) and complete [#25](https://github.com/internetOnion/life-goods/issues/25) |

Gate: every consequential outcome traces to readable OFF evidence, an activated reference version, a versioned rule, and an Assessment Run. Cambodian additive rules and international references remain distinct; ingredient screening never implies certification.

### Wave 6 — Reference content and anonymous experience

| Pod 1: reviewed reference content                                                                                 | Pod 2: anonymous shopper experience                                                                     |
| ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [#26 Release allergen, Halal, and additive reference data](https://github.com/internetOnion/life-goods/issues/26) | [#33 Local preferences and session-only history](https://github.com/internetOnion/life-goods/issues/33) |
| [#27 Author required MVP Learn entries](https://github.com/internetOnion/life-goods/issues/27)                    | [#12 Anonymous telemetry and privacy controls](https://github.com/internetOnion/life-goods/issues/12)   |
| Activate source-cited English descriptions and Learn content                                                      | Complete browser journeys without accounts or persistent identity                                       |

Gate: required reference data and explanatory content are activated; preferences never hide other concerns or uncertainty; history is session-only; private profile values never enter backend storage or analytics.

### Wave 7 — Deployment and pilot validation

| Pod 1: operations                                                                                   | Pod 2: validation and remediation                                                                                                        |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| [#34 Local dataset and pilot infrastructure](https://github.com/internetOnion/life-goods/issues/34) | [#35 MVP-1 usability, device, privacy, accessibility, and performance validation](https://github.com/internetOnion/life-goods/issues/35) |
| Migrations, monitoring, cleanup alerts, smoke checks, and rollback                                  | Coordinate research, record failures, land corrections, and rerun blocked gates                                                          |

Final release issue: [#13 Deploy and verify the pilot-ready MVP](https://github.com/internetOnion/life-goods/issues/13).

Gate: all specification thresholds, dataset/content activation records, privacy checks, operational drills, device checks, WCAG journey checks, and comprehension gates pass. Critical interpretation failures require correction and retest.

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

Use exactly one wave label and one or both role labels on each MVP issue. Deferred issues use the `Post-MVP` label instead of an MVP wave label.

- `Wave 0 · Foundation`
- `Wave 1 · Package Match`
- `Wave 2 · Identification`
- `Wave 3 · Capture & Evaluation`
- `Wave 4 · Evidence Foundations`
- `Wave 5 · Assessments & Guidance`
- `Wave 6 · Content & Anonymous Experience`
- `Wave 7 · Deployment & Validation`

Role labels are `Frontend` and `Backend`. Do not add separate status, review, privacy, operations, research, documentation, or readiness labels; those concerns belong in the issue body, milestone, project status, or wave label.

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

Run applicable migration tests. Generated-client drift, formatting, type, unit/component or API/database test, or build failure blocks merge.

### Integration gate

- Apply migrations to an empty database and from the previous integration state.
- Verify deterministic external fixtures, worker idempotency, retry and timeout behavior, privacy isolation, retention, and inaccessible expired media.
- Verify Web Client and backend use the committed OpenAPI contract.

### Release gate

- Run staging smoke tests with production-shaped services and isolated configuration.
- Verify monitoring, scrubbing, cleanup alerts, overdue-media alerts, migration release steps, rollback, and incident contacts.
- Complete physical-device, Telegram WebView, accessibility, Khmer rendering, and performance checks.
- Confirm OFF attribution and every activated reference version's human-review and licensing record.

### Pilot gate

- At least 80% of valid known barcodes return usable identity information.
- At least 90% of known results complete within three seconds under documented conditions.
- At least 80% of completed Package Captures return an interpretation within 15 seconds.
- At least 80% of participants distinguish a declared concern, no declaration detected in readable evidence, and Evidence Uncertainty.
- Any safety, Halal, allergen-free, legal, authenticity, or purchase guarantee interpretation is a critical failure.
- OFF Dataset Version, reference-data, Knowledge Entry, privacy, and evaluation readiness are documented and approved.

## 8. Explicitly deferred

The plan does not add locally observed Product seed data, reviewed-local precedence, Product Claim moderation, Preferred Claims, Product conflicts, Khmer ingredient-description translation, offline operation, public contribution and reputation, SME authenticity advisories, nutrition scores or visualizations, certificate verification beyond Seal Observation, legal Compliance Assessments, Telegram share cards, Official Report Referrals, or a broad Food Literacy Hub.
