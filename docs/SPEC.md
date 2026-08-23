# Khmer Food Product Intelligence MVP

## 1. Purpose

The MVP helps a Khmer-speaking shopper understand evidence from a sealed packaged-food label before purchase. It is delivered online as a responsive website and Telegram Mini App.

The product provides Shopper Guidance: prioritized declared concerns, uncertainty, Khmer label facts, and supporting evidence. It does not recommend whether to buy a Product and never declares a Product safe, healthy, allergen-free, Halal, legally compliant, or authentic.

## 2. Pilot boundary

### Included products

- Sealed retail packaged foods sold in Cambodia
- Non-alcoholic packaged beverages sold in Cambodia

### Unsupported in the MVP

- Alcohol
- Dietary supplements
- Infant formula and specialized clinical nutrition
- Medicines or products making medicinal claims
- Restaurant-prepared and fresh food
- Unlabeled homemade products

Unsupported products receive an explicit scope message rather than a generic assessment.

### Included capabilities

- Barcode scan and multilingual catalog search
- Open Food Facts identity and label evidence with field-level provenance
- Internally reviewed pilot catalog of approximately 100–200 locally observed Products
- Temporary private Package Capture when current label evidence is missing
- Original label transcription and concise Khmer ingredient names
- Allergen, Halal-ingredient, additive, and date assessments
- Evidence uncertainty and source inspection
- Approximately 20–30 contextual Learn More entries
- Optional local preference prioritization
- Khmer interface with optional English

### Deferred capabilities

- Offline operation
- Public contributions and community verification
- SME authenticity advisories
- Nutrition visualizations and health scoring
- Certificate verification beyond seal observation
- Legal Compliance Assessments
- Share-card generation
- Official reporting referrals
- Broad Food Literacy Hub content

## 3. Primary journey

1. The shopper scans a barcode.
2. The system validates and normalizes the identifier.
3. The system finds Package Variant candidates in the reviewed catalog and Open Food Facts.
4. The result displays immediately with a reference package image and “Different package?” action.
5. The first screen prioritizes:
   1. candidate identity;
   2. Critical Declared Concerns;
   3. Evidence Uncertainty;
   4. Khmer label summary;
   5. source evidence and observation date.
6. Missing, inconsistent, or visibly different evidence leads to optional private Package Capture.
7. The shopper may open reusable Knowledge Entries for details.

No confirmation blocks the initial result. Barcode identity and visual similarity produce candidates, not proof that the physical package is the same revision.

## 4. Identification and fallback behavior

### Barcode

- Support common GTIN/EAN/UPC retail identifiers.
- Verify check digits and store normalized scheme/value separately from internal IDs.
- Do not infer manufacturing country from a GS1 prefix.
- Target detection within one second on representative pilot devices.
- Target a usable known result within three seconds at the 95th percentile during pilot testing.

### Failure-specific recovery

- No detection after about five seconds: offer zoom, Package Capture, or search.
- Valid identifier not found: offer Package Capture immediately.
- Repeated invalid identifier: explain and continue scanning.
- Camera permission/device failure: show direct recovery and image upload.
- Network failure: explain that the MVP requires internet.

### Search

- Search identifiers, reviewed Khmer names, and original Product/brand names.
- Cover Khmer, English, Vietnamese, Simplified Chinese, and Thai source names.
- Preserve language and source for every name.
- Distinguish Package Variants rather than merging sizes and markets.

## 5. Data acquisition

### Open Food Facts

Open Food Facts is an External Evidence Source, not the source of truth. The data-availability audit found 1,231 Cambodia-tagged records on 2026-08-21, but only 19.3% contained ingredient text and 0.5% Khmer ingredient text. See [`research/mvp-food-data-availability.md`](research/mvp-food-data-availability.md).

The MVP may use all eligible available fields, including identifiers, names, brands, selected images, original ingredient text, declared allergen/trace tags, nutrition declarations, categories, packaging languages, and source metadata.

Rules:

- Preserve source URL, attribution, retrieval time, source revision/last-modified data, and field provenance.
- Keep OFF Claims distinguishable from internally reviewed Claims.
- Never interpret an empty field as a negative result.
- Display OFF-only results as external community data not reviewed by this project.
- Link to the source Product and comply with ODbL, Database Contents License, and image CC BY-SA obligations after licensing review.

### Reviewed pilot catalog

- Review approximately 100–200 Products physically observed in selected Cambodian stores and markets.
- Prioritize common snacks, noodles, sauces, dairy, canned foods, and non-alcoholic drinks.
- Require front and ingredient-panel evidence before treating a Package Revision as reviewed.
- Expand based on scan demand and market observation rather than claiming national coverage.

### Private Package Capture

- Require front and ingredient/label-panel photos.
- Request targeted close-ups only when critical evidence is unreadable or absent.
- Immediate output remains private to the session and never becomes catalog or training data.
- Application media retention is limited to active processing and encrypted retry/recovery for at most 24 hours.
- AI-provider transmission and retention terms must be disclosed and approved before launch.
- Target interpretation within 15 seconds after upload in pilot conditions.

## 6. Translation and vocabulary

### Ingredient presentation

- Preserve original label text, order, punctuation, percentages, and compound-ingredient structure.
- Show concise Khmer names alongside source terms.
- Put longer explanations behind Learn More.
- Use approved human-reviewed Khmer wording for safety-critical terms.
- Clearly mark AI-generated ordinary ingredient names as unreviewed.
- Keep ambiguous terms untranslated and show uncertainty.

### Reviewed Safety Vocabulary

Initial content:

- Current Codex allergen concepts plus Cambodia-specific decisions after review
- Highest-frequency 100–150 additives observed in pilot evidence
- Approximately 40–80 critical declaration and uncertainty phrases
- Multilingual source synonyms and derivatives in Khmer, English, Vietnamese, Simplified Chinese, and Thai

Workflow states:

`AI_DRAFT → IN_LANGUAGE_REVIEW → IN_DOMAIN_REVIEW → APPROVED`

Entries may also become `REJECTED` or `SUPERSEDED`. AI generates structured drafts; Khmer language and food-domain reviewers approve them. Only approved wording powers safety-critical shopper guidance.

## 7. Assessment semantics

All assessments are derived from original readable evidence through approved vocabulary and versioned rules. A Khmer translation alone is never the safety input.

### Allergen

Supported outcomes:

- `DECLARED_CONTAINS`
- `DECLARED_MAY_CONTAIN`
- `DERIVED_FROM_INGREDIENT`
- `NO_DECLARATION_DETECTED_IN_READABLE_LABEL`
- `LABEL_INCOMPLETE_OR_UNREADABLE`
- `NOT_ASSESSED`

“No declaration detected” must state that it is not an allergen-free guarantee.

### Halal-related ingredient evidence

Supported outcomes:

- explicit prohibited ingredient declared;
- source ambiguous;
- no declared non-Halal ingredient detected in readable evidence;
- label incomplete or unreadable;
- not assessed.

Ingredient screening, seal observation, and certificate verification are separate. The MVP observes seals but does not verify certificates unless a supported authoritative check becomes available and is separately approved.

### Additives

- Identify exact approved names, synonyms, INS/E-numbers, and functions.
- Provide neutral reviewed Khmer explanations.
- State regulatory restriction only when jurisdiction, food category, effective period, and required concentration support it.
- Use `CONCENTRATION_UNKNOWN` when amount is required but not declared.
- Never label an additive dangerous merely because it appears.

### Dates

- Distinguish manufacture, best-before, use-by/expiry, shelf-life instruction, and unknown.
- Preserve exact source text and scope the date to the Observed Package or identified Batch.
- Say date has passed, date has not passed, or date meaning uncertain.
- Never say safe.
- Keep correction/manual entry optional.

## 8. Trust and moderation

Verification belongs to individual Claims, not an entire Product.

Claim review states:

- `PROPOSED`
- `ACCEPTED`
- `DISPUTED`
- `REJECTED`
- `SUPERSEDED`
- `WITHDRAWN`

Production method, confidence, source authority, and review state are separate attributes. Competing Claims remain preserved. A Preferred Claim may be selected for a Package Revision without deleting conflicts.

Only project-team Moderators accept shared Claims during the MVP. “Official” confirmation requires identifiable authoritative evidence rather than moderator opinion.

## 9. AI and rule provenance

Model selection is not locked before evaluation. Build a representative 50–100-image benchmark covering regional languages, small print, glare, curved packages, date codes, allergens, and ambiguous ingredients. Compare transcription accuracy, structured extraction, latency, cost, and failures.

Every Extraction Run records:

- provider and model identifier;
- prompt, schema, and processing versions;
- input evidence references;
- raw structured output and uncertainty;
- status, latency, and failure reason;
- proposed Claims and translations.

Every Assessment Run records the Claims, evidence, approved vocabulary, and rule versions used. Recalculation creates new assessments and supersedes rather than overwrites history.

Unsupported accuracy, “zero hallucination,” and “zero false negative” claims are prohibited.

## 10. Privacy and analytics

- No account is required for shopper features.
- Preferences remain local and prioritize rather than hide concerns.
- Scan history is current-session only.
- Do not collect GPS by default or retain EXIF metadata.
- Analytics use short-lived random sessions and record journey/failure events only.
- Analytics exclude raw photos, precise location, dietary preferences, and persistent identity.
- A failed extraction returns partial evidence and uncertainty, never a fabricated or safety-clearing result.

## 11. Knowledge content

- Launch with approximately 20–30 high-priority Knowledge Entries.
- Draft original Khmer summaries with AI from primary sources.
- Preserve source, edition, jurisdiction, retrieval date, author/reviewer, and review state.
- Publish approved guidance only after language and domain review.
- Link to official material when a reviewed local entry is unavailable.
- Do not scrape and republish content merely because it is publicly accessible.

## 12. Pilot research and gates

- Interview and observe approximately 8–12 relevant shoppers.
- Run iterative Khmer usability rounds of about five participants.
- Validate the provisional persona, barcode-first behavior, image comparison, and uncertainty language.
- Require at least 80% known-barcode identity success, 90% of known results within three seconds, and 80% of Package Captures within 15 seconds under pilot conditions.
- Require at least 80% participant comprehension of concern vs no declaration detected vs uncertainty.
- Treat any interpretation of the UI as a safety, Halal, allergen-free, legal, or authenticity guarantee as a critical design failure.

See [`USER_STORIES.md`](USER_STORIES.md) for behavioral acceptance criteria and [`DATA_MODEL.md`](DATA_MODEL.md) for the conceptual and logical data model.
