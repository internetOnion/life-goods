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
- A manually activated, project-hosted OFF Dataset Version for Product lookup
- Locally hosted, immutable, human-reviewed reference datasets for allergen, Halal ingredient, and additive assessments
- Temporary private Package Capture when current label evidence is missing
- Original label transcription and concise source-cited English ingredient descriptions
- Allergen, Halal-ingredient, additive, and date assessments
- Evidence uncertainty and source inspection
- A data-driven Learn section covering every consequential concept presented by the MVP
- Optional local preference prioritization
- Khmer interface with optional English

### Deferred capabilities

- Locally observed Product seed data, reviewed-local precedence, Product Claims, Preferred Claims, conflicts, and catalog moderation
- Khmer ingredient descriptions and Khmer Knowledge Entry translation
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
3. The system finds Package Match candidates in the Active OFF Dataset Version.
4. The result displays immediately with a reference package image and “Different package?” action.
5. The first screen prioritizes:
    1. candidate identity;
    2. profile-matched and other evidence-scoped concerns;
    3. Evidence Uncertainty;
    4. available original label evidence and English ingredient explanations;
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

- Search identifiers and available Product/brand names in the Active OFF Dataset Version.
- Preserve any Khmer, English, Vietnamese, Simplified Chinese, and Thai source names present in OFF without inventing translations.
- Preserve language and source for every name.
- Distinguish Package Variants rather than merging sizes and markets.

## 5. Data acquisition

### Open Food Facts

Open Food Facts is an External Evidence Source, not the source of truth. The data-availability audit found 1,231 Cambodia-tagged records on 2026-08-21, but only 19.3% contained ingredient text and 0.5% Khmer ingredient text. See [`research/mvp-food-data-availability.md`](research/mvp-food-data-availability.md).

The MVP may use all eligible available fields, including identifiers, names, brands, selected images, original ingredient text, declared allergen/trace tags, nutrition declarations, categories, packaging languages, and source metadata.

Package Match reads these fields from the Active OFF Dataset Version: a manually imported, full global official export stored read-only in project-operated MongoDB. The dataset version is immutable and identified by its source URL, retrieval and activation times, integrity hash, and observed schema versions. It remains active until an operator validates and atomically activates another version; no age implies synchronization with upstream OFF.

Rules:

- Preserve source URL, attribution, retrieval time, source revision/last-modified data, and field provenance.
- Treat citations and integrity hashes as provenance metadata only; they do not verify the Product, package, or any Claim.
- Keep OFF Evidence distinguishable from future project-reviewed Product Claims.
- Never interpret an empty field as a negative result.
- Display OFF-only results as external community data not reviewed by this project.
- Link to the source Product and comply with ODbL, Database Contents License, and image CC BY-SA obligations after licensing review.
- Expose the OFF Dataset Version and retrieval date with every OFF Package Match.
- Return the unavailable journey when no valid Active OFF Dataset Version can serve a cited candidate.
- Do not fall back to the public OFF product API. Selected image URLs may continue through the constrained image proxy.

### Assessment reference datasets

MVP-1 hosts Reference Dataset Versions in PostgreSQL for allergen vocabulary, Halal ingredient mappings, additive rules, ingredient concepts and English descriptions, and Knowledge Entries.

Rules:

- Record source URL, license/reuse decision, jurisdiction, edition/effective period where applicable, retrieval time, integrity hash, reviewer, review date, validation result, and activation time.
- Keep source sets separate rather than merging Cambodian rules, international references, lexical taxonomies, ontologies, and project-authored explanations into one truth table.
- Require a one-time qualified human review before a version is activated; corrections create a new immutable version.
- Treat activation as approval for a scoped assessment input, never Product review or verification.
- Begin the allergen vocabulary with the current Codex major-allergen baseline; keep jurisdiction-specific extensions and exemptions separate.
- Maintain a small project-authored Halal mapping that distinguishes explicit prohibited ingredients from source-dependent ambiguity and cites Cambodian and properly licensed international sources.
- Prefer reviewed Cambodian additive rules. If none apply, a reviewed Codex rule may be used only as an explicitly labeled international reference.
- Host concise project-authored English ingredient descriptions linked to stable identifiers and cited sources; defer Khmer translation.
- Use manual import, validation, activation, and rollback. Do not synchronize reference data automatically in MVP-1.

The current complete `FOOD_ALLERGEN` release is
`codex-food-allergen-2026-reviewed-english-v1`. It contains 26 active leaf concepts and three
non-emitting parent groups. Its reviewed English mappings comprise the 26 direct names plus
the project-reviewed derivatives `whey` and `tahini`; the typed `coconut milk` exclusion
suppresses only the contained milk match. The release contains no other derivative, synonym,
non-English, or Open Food Facts taxonomy mappings. Wheat, rye, barley, oats, sulphite,
lactose, and non-`FOOD_ALLERGEN` condition families are outside this release. The earlier
one-concept milk release remains immutable for tracer and rollback coverage but is not the
complete release.

### Reviewed Product catalog

Locally observed Product seed data, reviewed Package Revisions, Product Claims, Preferred Claims, Unresolved Conflicts, moderator workflow, and reviewed-local precedence are post-MVP. The future reviewed catalog remains separate from OFF and from the reference datasets used for interpretation.

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
- Show concise, project-authored, source-cited English descriptions alongside source terms when available.
- Put longer explanations behind Learn More.
- Use approved human-reviewed interface wording for consequential assessment states.
- Do not use AI-generated translations or descriptions as assessment inputs.
- Keep ambiguous terms untranslated and show uncertainty.

### Reviewed Safety Vocabulary

Initial content:

- Current Codex major-allergen baseline, with jurisdiction-specific additions and exemptions kept separate
- Reviewed declaration, precautionary, synonym, and ingredient-derivative mappings required by deterministic MVP scenarios
- A small project-authored Halal ingredient mapping with explicit-prohibited and source-ambiguous states
- Additive concepts and Cambodian rules where available, plus a separate Codex international-reference rule set
- Multilingual source synonyms only where supported and reviewed; no invented translation coverage

Each immutable version is imported, validated, reviewed by qualified humans, and explicitly activated. MVP-1 does not require a general Product verification or moderator system. Only activated reference mappings may power consequential assessments.

## 7. Assessment semantics

All assessments in MVP-1 are stateless Assessment Evaluations derived dynamically per Package Match request from original readable Evidence through an Active Reference Dataset Version and versioned rules, with optional non-durable caching. A translation or Ingredient Explainer is never the assessment input, and evaluations never write durable Assessment Run records to the database.

Assessment Evaluation availability is separate from per-concept outcomes. A completed
evaluation reports `COMPLETED` with a null reason, including when partial readable Evidence
produces only `LABEL_INCOMPLETE_OR_UNREADABLE` concept outcomes. An evaluation that cannot run
reports `NOT_ASSESSED` with exactly one reason: `FEATURE_DISABLED`, `REFERENCE_UNAVAILABLE`,
`EVIDENCE_UNAVAILABLE`, or `ASSESSMENT_FAILED`. These assessment states do not change Package
Match availability; an unavailable Active OFF Dataset Version retains its separate Package
Match failure behavior.

### Allergen

Supported outcomes:

- `DECLARED_CONTAINS`
- `DECLARED_MAY_CONTAIN`
- `DERIVED_FROM_INGREDIENT`
- `NO_DECLARATION_DETECTED_IN_READABLE_LABEL`
- `LABEL_INCOMPLETE_OR_UNREADABLE`
- `NOT_ASSESSED`

“No declaration detected” must state that it is not an allergen-free guarantee.

The Dietary Preference Profile may prioritize matching outcomes but does not change assessment logic or hide other concerns or Evidence Uncertainty.

Package Match returns one outcome for each active leaf concept in stable concept-ID order.
Each outcome includes its parent concept IDs in direct-parent-to-root order and the rule IDs
applicable to that leaf. Parent groups remain available for grouping and never appear as
separate outcomes.

### Halal-related ingredient evidence

Supported outcomes:

- explicit prohibited ingredient declared;
- source ambiguous;
- no declared non-Halal ingredient detected in readable evidence;
- label incomplete or unreadable;
- not assessed.

Ingredient screening, Seal Observation, and certificate verification are separate. Seal Observation and certificate verification are deferred in MVP-1; ingredient screening never populates either.

### Additives

- Identify exact approved names, synonyms, INS/E-numbers, and functions.
- Provide neutral reviewed English explanations in MVP-1.
- State a Cambodian limit concern only when jurisdiction, food category, effective period, and required concentration support it.
- When no applicable Cambodian rule is available, a reviewed Codex rule may produce an explicitly labeled International Reference Concern, never a Cambodian legal conclusion.
- Use `CONCENTRATION_UNKNOWN` when amount is required but not declared.
- Never label an additive dangerous merely because it appears.

### Dates

- Distinguish manufacture, best-before, use-by/expiry, shelf-life instruction, and unknown.
- Preserve exact source text and scope the date to the Observed Package or identified Batch.
- Say date has passed, date has not passed, or date meaning uncertain.
- Never say safe.
- Keep correction/manual entry optional.

## 8. Trust and moderation

MVP-1 does not review or verify OFF Products. Citations, local storage, integrity hashes, and dataset activation establish provenance and operational integrity only.

Reference Dataset Version approval is a narrow release decision for assessment inputs. It does not create accepted Product Claims, Preferred Claims, Unresolved Conflicts, or reviewed Package Revisions.

The following reviewed Product catalog model is deferred until after MVP-1. When introduced, verification belongs to individual Claims, not an entire Product.

Claim review states:

- `PROPOSED`
- `ACCEPTED`
- `DISPUTED`
- `REJECTED`
- `SUPERSEDED`
- `WITHDRAWN`

Production method, confidence, source authority, and review state are separate attributes. Competing Claims remain preserved. A Preferred Claim may be selected for a Package Revision without deleting conflicts.

Future project-team Moderators may accept shared Product Claims only under an approved workflow. “Official” confirmation will require identifiable authoritative Evidence rather than moderator opinion.

## 9. AI and rule provenance

Model selection is not locked before evaluation. Build a representative 50–100-image benchmark covering regional languages, small print, glare, curved packages, date codes, allergens, and ambiguous ingredients. Compare transcription accuracy, structured extraction, latency, cost, and failures.

Every Extraction Run records provider and model identifier, prompt, schema, processing versions, input evidence references, raw structured output, uncertainty, status, latency, failure reason, and proposed Claims/translations.

Durable persistent Assessment Runs are deferred post-MVP; MVP-1 uses stateless Assessment Evaluations whose output is scoped to the candidate response, with optional non-durable cache-aside caching. When persistent Assessment Runs are introduced post-MVP, every run will record the Claims, evidence, approved vocabulary, and rule versions used.

Unsupported accuracy, “zero hallucination,” and “zero false negative” claims are prohibited.

## 10. Privacy and analytics

- No account is required for shopper features.
- The Dietary Preference Profile offers only allergens from the Active Reference Dataset Version and persists only in that browser/device until reset.
- Preference values never enter backend storage or analytics and prioritize rather than hide concerns.
- Scan history is current-session only.
- Do not collect GPS by default or retain EXIF metadata.
- Analytics use short-lived random sessions and record journey/failure events only.
- Analytics exclude raw photos, precise location, dietary preferences, and persistent identity.
- A failed extraction returns partial evidence and uncertainty, never a fabricated or safety-clearing result.

## 11. Knowledge content

- Use no fixed topic-count target; publish the reviewed entries needed to explain every consequential MVP-1 concept.
- Author concise original English summaries from primary or authoritative sources; defer Khmer translation.
- Preserve source, edition, jurisdiction, retrieval date, author/reviewer, and review state.
- Publish only after applicable language and domain review and explicit version activation.
- Link to official material when an activated local entry is unavailable.
- Do not scrape and republish content merely because it is publicly accessible.

## 12. Pilot research and gates

- Interview and observe approximately 8–12 relevant shoppers.
- Run iterative Khmer usability rounds of about five participants.
- Validate the provisional persona, barcode-first behavior, image comparison, and uncertainty language.
- Require at least 80% known-barcode identity success, 90% of known results within three seconds, and 80% of Package Captures within 15 seconds under pilot conditions.
- Require at least 80% participant comprehension of concern vs no declaration detected vs uncertainty.
- Treat any interpretation of the UI as a safety, Halal, allergen-free, legal, or authenticity guarantee as a critical design failure.

See [`USER_STORIES.md`](USER_STORIES.md) for behavioral acceptance criteria and [`DATA_MODEL.md`](DATA_MODEL.md) for the conceptual and logical data model.
