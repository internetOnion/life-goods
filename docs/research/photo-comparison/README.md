# Photo-comparison trial notes

This directory records owner-assisted observations from the local
photo-comparison lab. Findings are practical development notes, not an
accuracy benchmark or evidence that photo-derived values are verified package
facts.

## Feature-first sequence

The implementation order was extraction (`#112`), deterministic comparison
(`#113`), standalone local API and browser page (`#114`), then a real-photo
trial (`#115`). The reviewed multilingual corpus and transcription tool from
`#111` were closed as not planned; they are not part of the current
photo-comparison implementation.

## Trial status

The browser page and local API are implemented. A supplied MAMA photo was tried
on 2026-09-10. The original 8,192-token budget returned `MAX_TOKENS`, with 4,455
thinking tokens and 3,722 response tokens. Configuration `photo-extraction-v2`
raises the budget to 16,384 and reports truncation explicitly.

Increasing the budget alone encountered quantity validation failures and timeouts.
Configuration `photo-extraction-v3` simplifies the provider schema, assigns field
and column IDs locally, derives serving state from the optional quantity, and uses
the model's supported low thinking level. Identity display labels are generated
locally from the field role; the actual name/brand text remains literal evidence.

The supplied MAMA photo then passed extraction validation in 11.3 seconds. The
final configuration passed the browser's multipart endpoint with HTTP 200 in
11.6 seconds and returned a partial extraction with unknown preparation. Its
13 amount rows matched the visible label: Calories 280; fat 12 g; saturated fat
6 g; trans fat 0 g; carbohydrate 37 g; fibre 1 g; sugars 2 g; protein 5 g;
cholesterol 0 mg; sodium 1380 mg; potassium 100 mg; calcium 0 mg; iron 2 mg.
Calories had no separate printed unit and remained unnormalized. Percentage rows
were retained separately. Comparing the validated extraction to a second local
Product containing the same evidence returned HTTP 200; this was an API smoke
test rather than a formal two-Product accuracy trial. Issue `#115` was later
closed when the experimental photo-comparison sprint was retired, so broader
Mee Chiet and browser-interaction trials are not planned follow-up work. No raw
provider bodies or photos are retained here.

Thinking configuration reference:
[Gemini thinking](https://ai.google.dev/gemini-api/docs/generate-content/thinking).

When the original photos are available, use the page to try the complete panel
sets, the separate Mee Chiet 65 g weight photo, replacing an unreadable photo,
and comparing partial results. Record only practical observations and concrete
follow-up changes; keep personal paths, raw provider bodies, and unapproved
attachments out of committed notes.
