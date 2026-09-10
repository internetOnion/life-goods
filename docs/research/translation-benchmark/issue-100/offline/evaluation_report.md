# Khmer Translation automated evaluation

Generated: 2026-09-07 17:28:09 UTC
Evidence: **Deterministic offline verification**
Candidate: `gemini-3.8-flash`
Translation configuration: `v1`
Dataset: `v1`

Offline latency and fixture outputs are structural test evidence only; they are not observed provider performance or charges. Token usage and cost remain unavailable.
Automated checks establish structural behavior only; they do not claim semantic verification or human-reviewed Product translations. Human review is not required for this evaluation or production activation.

## Results

| Metric | Result |
| :--- | :--- |
| Items | 15 |
| Pass Rate | 100.0% (15/15) |
| 12-second deadline adherence | 100.0% |
| Average cold latency | 0.9 ms |
| P95 cold latency | not reported (requires at least 20 samples; n=15) |
| Completion statuses | `{"complete": 11, "not_needed": 2, "partial": 1, "unavailable": 1}` |
| Timeouts | 0 |
| Cached provider calls | 0 |
| Usage samples | 0/15 |
| Prompt tokens | unavailable |
| Visible output tokens | unavailable |
| Thinking tokens | unavailable |
| Billed output tokens | unavailable |
| Estimated cost | unavailable |

Cost uses Google Gemini 3.8 Flash standard pricing effective through 2026-12-31: $0.75 per million input tokens and $3.75 per million output tokens, including thinking tokens. Retries are included in provider attempt counts. A retried request reports cost as unavailable because the final response cannot establish usage for every attempt. Other usage is costed only when the API reports enough metadata to avoid treating missing data as zero. Pricing source: https://ai.google.dev/gemini-api/docs/pricing

## Scenario outcomes

- `bm_en_choc_01` (en, brand, e_number, units_and_quantities): pass; overall `complete`; cold 2.2 ms; cached 0.6 ms; provider calls cold/cached 1/0; provider attempts 0.
- `bm_fr_cheese_02` (fr, brand, e_number, units_and_quantities): pass; overall `complete`; cold 1.2 ms; cached 0.3 ms; provider calls cold/cached 1/0; provider attempts 0.
- `bm_th_noodle_03` (th, brand, units_and_quantities, e_number): pass; overall `complete`; cold 1.4 ms; cached 0.3 ms; provider calls cold/cached 1/0; provider attempts 0.
- `bm_vi_coffee_04` (vi, brand, units_and_quantities): pass; overall `complete`; cold 1.1 ms; cached 0.3 ms; provider calls cold/cached 1/0; provider attempts 0.
- `bm_und_tea_05` (und, units_and_quantities, brand): pass; overall `complete`; cold 0.8 ms; cached 0.2 ms; provider calls cold/cached 1/0; provider attempts 0.
- `bm_long_cereal_06` (en, long_ingredients, e_number, units_and_quantities, brand): pass; overall `complete`; cold 1.7 ms; cached 0.4 ms; provider calls cold/cached 1/0; provider attempts 0.
- `bm_adv_security_07` (en, adversarial, brand): pass; overall `complete`; cold 0.9 ms; cached 0.2 ms; provider calls cold/cached 1/0; provider attempts 0.
- `bm_km_local_08` (km, source_khmer, brand, units_and_quantities): pass; overall `not_needed`; cold 0.1 ms; cached 0.1 ms; provider calls cold/cached 0/0; provider attempts 0.
- `bm_sparse_salt_09` (en, sparse_missing, brand): pass; overall `complete`; cold 0.7 ms; cached 0.2 ms; provider calls cold/cached 1/0; provider attempts 0.
- `bm_mixed_bilingual_10` (th, en, mixed_script, brand, units_and_quantities): pass; overall `complete`; cold 1.0 ms; cached 0.3 ms; provider calls cold/cached 1/0; provider attempts 0.
- `bm_irreg_snack_11` (en, irregular, units_and_quantities, brand, e_number): pass; overall `complete`; cold 1.0 ms; cached 0.2 ms; provider calls cold/cached 1/0; provider attempts 0.
- `bm_zh_soy_12` (zh, multilingual, brand, units_and_quantities): pass; overall `complete`; cold 0.8 ms; cached 0.2 ms; provider calls cold/cached 1/0; provider attempts 0.
- `bm_brand_only_13` (en, brand_only): pass; overall `not_needed`; cold 0.1 ms; cached 0.1 ms; provider calls cold/cached 0/0; provider attempts 0.
- `bm_partial_14` (en, partial): pass; overall `partial`; cold 0.4 ms; cached 0.1 ms; provider calls cold/cached 1/0; provider attempts 0.
- `bm_unavailable_15` (en, unavailable): pass; overall `unavailable`; cold 0.3 ms; cached 0.1 ms; provider calls cold/cached 1/0; provider attempts 0.
