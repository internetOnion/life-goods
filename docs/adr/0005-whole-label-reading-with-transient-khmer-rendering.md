---
status: accepted
amends: 0004
---

# Whole-label reading with transient Khmer Rendering

ADR 0004 made Read This Label the next step for an Unmatched Barcode, but it only reads nutrition values. The prompt explicitly forbids transcribing ingredients. A Shopper holding an imported Product whose Barcode has no Source Record mostly wants to know what is in it: the ingredients and the printed allergen statement. Many of these labels are in Thai, Vietnamese, Chinese, Korean, or English, so the Shopper also needs a Khmer reading. Nutrition matters, but it is third on that list.

The capture experience is also weak. Photos come from the operating system's file picker or native camera with one line of guidance, and the result reads like an evidence log rather than an answer.

Four alternatives were considered:

1. **Keep nutrition-only reading and improve only the presentation.** This leaves the Shopper's main question unanswered.
2. **Extend the shared `Extraction` contract used by Compare Nutrition.** That contract forbids extra fields, requires a readable nutrition column (otherwise the outcome is `retake_required`), and its prompt excludes ingredients to protect Compare's token budget. Widening it would change Compare Nutrition for no benefit.
3. **Read and translate in one provider call.** Khmer output tokens are dense, so a truncated response would discard the whole paid reading. Asking one prompt to both transcribe verbatim and translate also weakens transcription fidelity.
4. **Send photo-derived text through the Khmer Translation pipeline.** That pipeline stores content-addressed artifacts in generated-data MongoDB. Storing photo-derived text breaks ADR 0002 and the no-retention rule.

## Decision

Read This Label reads the **whole printed label**, not only nutrition values.

**Scope of a Label Reading**

- Identity (name, brand), package quantity, and nutrition columns, as today.
- Ingredients: transcribed verbatim, one block per printed language, with no correction, inference, or translation.
- Printed Allergen Statements: the printed "Contains" / "May contain" wording, transcribed verbatim.
- Printed facts, from a closed list only: serving size, servings per package, storage instructions, country of origin, manufacturer, importer or distributor.
- Excluded from extraction: free-from claims, certification or Halal marks, health or nutrition claims, and marketing copy. Transcribing these would read as a verdict.

**Mechanism**

- Read This Label gets its own operation (`POST /api/v1/label-readings`), prompt, response schema, and configuration version (`label-reading-v1`). This reverses ADR 0004's "same operation / prompt configuration / no separate endpoint". Compare Nutrition keeps `POST /api/v1/photo-comparison/extractions` and `photo-extraction-v3` unchanged.
- The provider and model are unchanged. Upload, image, and response limits are unchanged.
- All photo-derived provider calls, including Khmer Rendering, share **one** anonymous admission budget and **one** single-active-provider lease with Compare Nutrition. There is no second provider budget.
- The label-reading request carries no free-form identifier field. It sends only photos and their capture roles (`package_front`, `package_back`, `package_side`, `unspecified`).

**Guided capture**

- Photos are taken in guided steps: front of package, back of package, and an optional side panel. The in-app camera shows a framing overlay and a tip for each step. The library and the device's native camera remain available as fallbacks.
- Blur, darkness, and glare are checked on the device. These checks are advisory only and never block submission.

**Khmer Rendering**

- Khmer Rendering is a separate, text-only provider call on Photo Evidence text, using the same model (`POST /api/v1/label-readings/khmer-renderings`).
- It is **not** Khmer Translation. It creates no artifacts and uses no generated-data MongoDB, no translation cache, and no translation quota. It carries no Original Text semantics.
- It is transient and lives in browser memory only. It makes one provider attempt. If rendering fails, the printed text is shown alone and the reading is not failed.
- It is labelled as machine-generated Khmer from the Shopper's photo, never as label wording.

**Allergen mentions**

- The backend runs the existing deterministic ingredient-text matcher on the photo-derived ingredient and allergen-statement text. No provider call is involved.
- The backend returns every allergen-group mention it finds. Shopper concern selections never leave the browser; filtering happens client-side.
- The interface reports only what was found in the text that was read. It never states that an allergen was not found, is absent, or that the Product is free of anything. When no eligible text exists or the matcher is unavailable, the state is shown as not checked.

**Barcode from photos**

- Captured photos may be decoded for a Barcode **on the device**. A decoded, check-digit-valid Barcode may trigger an ordinary Product Lookup. If it finds a Source Record, the Shopper is offered the Product page instead of a Label Reading.
- The lookup and the photo submission must never share a request, header, identifier, filename, log field, metric, or cache key. Uploaded files are renamed to neutral filenames before submission. The Barcode is never sent with photos or photo text and never reaches the provider.
- Residual risk: two anonymous requests from the same network address, seconds apart, can be correlated at the network level. This is acknowledged. It is mitigated by the existing access-log redaction and by having no application-level association.

## Still not authorized

Everything ADR 0004 excluded still stands, plus the new limits above:

- storing a Label Reading or Khmer Rendering anywhere (ADR 0002 stands);
- presenting a Label Reading as a Source Record, Original Text, or Khmer Translation input, or with Source Attribution or Source Assessments;
- offering a Label Reading as an Open Food Facts contribution, correction, or verification;
- sending a Barcode to the AI provider, or associating a Barcode with a photo submission in any request, log, metric, or cache key;
- any health, safety, allergen-free, Halal, authenticity, legal, or purchase verdict or score;
- carrying a Label Reading into Compare Nutrition;
- changing the provider or model, or adding a second provider budget.

## Consequences

- Shoppers may lean on AI-read allergen text for allergy decisions. Mitigations:
  - always show the printed text verbatim
  - one strong Photo Evidence notice
  - never state absence
  - explicit not-checked states
  - evidence one tap away
- A whole-label response needs more output tokens and time. The existing 16,384-token and 60 s limits must be measured against real Cambodian-market packages before any change. Raising them is a `docs/SPEC.md` change and requires the capacity lease TTL to stay above the provider deadline.
- Each Label Reading can make two admissions (reading plus Khmer Rendering), so capacity limits are reached sooner for both modes. Khmer Rendering is skipped for text that is already in Khmer script.
- The deterministic matcher is English-oriented, so many regional labels will show allergen mentions as not checked. Copy must set that expectation.
- The matcher's reference data comes from the Open Food Facts ingredient taxonomy. That is named only in the evidence details, not as Source Attribution on the reading.
