---
status: accepted
amended-by: 0005
---

# Single-Product label reading within the bounded photo exception

The activated Dataset Snapshot contains 1,232 Cambodia-tagged Source Records out of 4,710,709 (about 0.026%; see `docs/research/open-food-facts-dataset-justification.md`). An Unmatched Barcode is therefore the ordinary outcome of a Cambodian Shopper's scan, not an edge case. Before this decision the Product Lookup 404 was a dead end, and the only photo-based path, Compare Nutrition, required two Products.

Four alternatives were considered:

1. **Leave the Unmatched Barcode as a dead end.** Honest, but the most common outcome of the core workflow stays useless.
2. **Fall back to the live Open Food Facts API.** Forbidden by ADR 0001; it also would not help, because the upstream database has the same coverage gap.
3. **Let the Shopper contribute what they photograph back to Open Food Facts.** Forbidden by `PRODUCT.md` and `docs/SPEC.md`: the Shopper interface exposes no contribution, correction, or verification controls.
4. **Offer a single-Product reading inside Compare Nutrition with a placeholder second Product.** A dishonest interface and an entangled two-sided state machine.

Life Goods widens the bounded photo exception **in purpose only**, from "compare two nutrition labels" to "read one nutrition label or compare two". Read This Label and Compare Nutrition together form the Nutrition Labels section. Read This Label is also the primary next step offered for an Unmatched Barcode.

The mechanism is unchanged: the same `POST /api/v1/photo-comparison/extractions` operation, provider, model, prompt configuration, upload limits, retention rules, and one shared anonymous admission budget and single-active-provider lease across both modes. A Label Reading is Photo Evidence, held only in the Shopper's browser memory for the current page.

This decision does **not** authorize:

- storing a Label Reading anywhere (ADR 0002 stands: no MongoDB, Redis, browser storage, or relational persistence);
- presenting a Label Reading as a Source Record, Original Text, or Khmer Translation input, or with Source Attribution or Source Assessments;
- offering a Label Reading as an Open Food Facts contribution, correction, or verification;
- sending a Barcode to the AI provider, or associating a Barcode with a photo submission in any request, log, metric, or cache key;
- any health, safety, allergen-free, Halal, authenticity, legal, or purchase verdict or score;
- carrying a Label Reading into Compare Nutrition;
- changing the provider or model, or adding a second provider budget.

Numbering note: `0003` was used twice historically (`0003-independent-ingredient-to-allergen-reference-data.md` and `0003-isolated-generated-data-persistence.md`). Neither is renumbered because both are cited elsewhere; `0004` is the next unused number.
