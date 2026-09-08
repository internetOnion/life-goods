# Issue #100 verification evidence

Issue #100 evaluates the expanded Khmer Translation contract without claiming semantic accuracy or human review.

## Automated offline evidence

The 2026-09-08 deterministic run exercised 15 synthetic Source Record fixtures through the production projection, translation module, coordinator, 12-second deadline, and cache. It covered English, French, Thai, Vietnamese, Chinese, Khmer, unknown-language, mixed-script, sparse, brand-only, long-input, partial, unavailable, and expanded storage, packaging, category, and taxonomy data.

All 15 fixtures passed structural validation and token preservation. Cached replay made zero provider calls. Offline token usage, provider latency, and cost are deliberately unavailable, not zero or estimated. Fifteen samples are insufficient for a production percentile, so no P95 is reported. See [`offline/summary.json`](offline/summary.json), [`offline/measurements.json`](offline/measurements.json), and [`offline/evaluation_report.md`](offline/evaluation_report.md).

## Real-service evidence

The 15 generated-data integration checks passed against local MongoDB 8.2 and Redis 8.2. They covered database permission isolation, schema and index verification, atomic leases, cross-instance single flight, cache reuse, configuration isolation, cross-snapshot reuse, store-write failure, quarantine, expired-lease recovery, and absence of Barcode or Shopper associations in generated storage.

## Live benchmark scope decision

Live Gemini execution was not performed. On 2026-09-08, the project owner decided that a live provider benchmark was not required to complete issue #100 because production uses the already-approved exact Gemini model rather than selecting among candidate models. No fixture content was sent and no provider charge was incurred.

This means the repository makes no measured claims about live uncached provider latency, completion or timeout rates, reported token usage, retry cost, or estimated provider cost. The deterministic contract evidence and real MongoDB/Redis integration evidence remain the completion basis. `pnpm benchmark:live` remains available as an optional operator diagnostic; it uses the exact production model and writes sanitized output under `docs/research/translation-benchmark/issue-100/live/` without exporting prompts or raw provider payloads.

Pricing calculations use Google's Gemini 3.8 Flash standard rates effective through 2026-12-31: $0.75 per million input tokens and $3.75 per million output tokens, including thinking tokens. Source: [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing).
