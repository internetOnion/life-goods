# Issue #100 verification evidence

Issue #100 evaluates the expanded Khmer Translation contract without claiming semantic accuracy or human review.

## Automated offline evidence

The 2026-09-08 deterministic run exercised 15 synthetic Source Record fixtures through the production projection, translation module, coordinator, 12-second deadline, and cache. It covered English, French, Thai, Vietnamese, Chinese, Khmer, unknown-language, mixed-script, sparse, brand-only, long-input, partial, unavailable, and expanded storage, packaging, category, and taxonomy data.

All 15 fixtures passed structural validation and token preservation. Cached replay made zero provider calls. Offline token usage, provider latency, and cost are deliberately unavailable, not zero or estimated. Fifteen samples are insufficient for a production percentile, so no P95 is reported. See [`offline/summary.json`](offline/summary.json), [`offline/measurements.json`](offline/measurements.json), and [`offline/evaluation_report.md`](offline/evaluation_report.md).

## Real-service evidence

The 15 generated-data integration checks passed against local MongoDB 8.2 and Redis 8.2. They covered database permission isolation, schema and index verification, atomic leases, cross-instance single flight, cache reuse, configuration isolation, cross-snapshot reuse, store-write failure, quarantine, expired-lease recovery, and absence of Barcode or Shopper associations in generated storage.

## Live evidence limitation

Live Gemini execution was not performed. The run requires explicit approval to send the repository's synthetic fixture text to Google Gemini using the configured credential. No fixture content was sent and no provider charge was incurred. Live uncached latency, completion/timeout rates, reported token usage, retry cost, and estimated provider cost therefore remain outstanding evidence.

When explicitly authorized, run `pnpm benchmark:live`. The command uses the exact production model and writes sanitized output under `docs/research/translation-benchmark/issue-100/live/`; it never exports prompts or raw provider payloads.

Pricing calculations use Google's Gemini 3.8 Flash standard rates effective through 2026-12-31: $0.75 per million input tokens and $3.75 per million output tokens, including thinking tokens. Source: [Gemini Developer API pricing](https://ai.google.dev/gemini-api/docs/pricing).
