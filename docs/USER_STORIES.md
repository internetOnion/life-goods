# MVP Personas and User Stories

This document defines the first pilot for the Khmer Food Product Intelligence platform. Stories use the domain language in [`CONTEXT.md`](../CONTEXT.md) and the evidence boundary established during the product interview.

## Product outcome

A Cambodian shopper scans or photographs a sealed packaged food before purchase and receives understandable Khmer label information, evidence-scoped assessments, and visible uncertainty. The platform informs the shopper; it does not issue a buy/don't-buy verdict or declare a Product safe, healthy, Halal, legal, or authentic.

## Personas

### Primary persona: Sokha, the Primary Shopper

Sokha is a provisional behavioral persona, not a validated demographic profile. She:

- speaks Khmer and regularly buys packaged food in Cambodia;
- cannot confidently interpret some foreign-language labels or technical ingredient terms;
- needs the important information quickly while physically evaluating a package;
- may use a low- or mid-range phone and an inconsistent mobile connection;
- should not need an account, saved profile, or technical knowledge.

Age, gender, parenthood, exact location, and preferred store are hypotheses rather than defining traits. The persona must be revised after direct interviews and observation.

### Need profile: Halal-conscious shopper

This shopper follows the same before-purchase journey but needs ingredient-source ambiguity, explicit prohibited ingredients, seal observation, and certificate status kept separate. “No declared non-Halal ingredient detected” is useful but is never presented as certification.

### Need profile: Allergy-conscious shopper

This shopper follows the same journey but needs explicit contains statements, may-contain statements, ingredient-derived matches, and incomplete evidence distinguished. The platform never declares a Product allergen-free.

### Deferred personas

- **Contributor/Bopha**: public submissions, attribution, reputation, and community moderation are post-MVP.
- **SME owner/Rithy**: verified brand pages and authenticity advisories are post-MVP.

## Epic 1: Identify the physical package

### US-1.1 — Scan a known barcode

As a Primary Shopper, I want to scan a package barcode so that I can retrieve a candidate result without typing.

Acceptance criteria:

- Recognizes supported GTIN/EAN/UPC formats on representative pilot devices.
- Targets barcode detection within one second under test conditions.
- Validates and normalizes the identifier before lookup.
- Treats the identifier as a lookup key for Package Variant candidates, not proof of Product identity or manufacture origin.
- Shows the reference package image prominently with a “Different package?” action.
- Targets a usable known-barcode result within three seconds at the 95th percentile during the pilot.

### US-1.2 — Receive the right fallback

As a Primary Shopper, I want help appropriate to the scanner failure so that I can continue without understanding camera technology.

Acceptance criteria:

- No detection after about five seconds offers zoom, Package Capture, or search.
- A valid identifier with no result offers Package Capture immediately.
- Repeated invalid identifiers explain the problem without treating them as Products.
- Camera permission or device failures provide direct recovery and image-upload options.
- Network lookup failures explain that the online MVP requires connectivity.
- Each failure category is measured separately.

### US-1.3 — Search the catalog

As a Primary Shopper, I want to search when scanning is unavailable so that I can still find a package candidate.

Acceptance criteria:

- Searches by barcode, reviewed Khmer names, and original names or brands in Khmer, English, Vietnamese, Simplified Chinese, and Thai.
- Preserves a language tag and source for every displayed name.
- Handles Unicode normalization and common spacing or punctuation differences.
- Does not promise untested cross-script transliteration or typo tolerance.
- Shows Package Variants rather than collapsing different sizes or market packages.

## Epic 2: Use existing and current evidence

### US-2.1 — View an Open Food Facts result

As a Primary Shopper, I want available community data to be useful even when the Product is not in the reviewed pilot catalog.

Acceptance criteria:

- Uses eligible Open Food Facts fields as field-level external Evidence, not as one authoritative Product record.
- Labels the result “Community data from Open Food Facts—not yet reviewed by this project.”
- Shows attribution, source link, retrieval time, and relevant source modification data.
- Never interprets an empty ingredient, allergen, trace, or nutrition field as “none.”
- Asks the shopper to compare the reference front image with the physical package.
- Runs approved safety vocabulary rules only against readable source evidence.
- Offers private Package Capture when evidence is missing, inconsistent, or does not match.

### US-2.2 — Capture a package privately

As a Primary Shopper, I want a current interpretation when catalog evidence is missing so that I can still understand the package in front of me.

Acceptance criteria:

- Requests a front-package photo and an ingredient/label-panel photo.
- Requests barcode, allergen, date, importer-label, or certification close-ups only when needed; these are optional.
- Shows progress and targets an interpretation within 15 seconds after upload during the pilot.
- Returns partial evidence and explicit uncertainty if extraction fails or times out.
- Keeps the result private to the Anonymous Shopper Session.
- Does not create a Contributor, public submission, or Catalog Candidate.
- Retains media only for processing and encrypted retry/recovery for at most 24 hours.
- Does not use shopper media for training, catalog growth, analytics, or manual review.

### US-2.3 — Challenge a package match

As a Primary Shopper, I want to indicate that the catalog image differs from my package so that old or market-specific evidence is not silently reused.

Acceptance criteria:

- A “Different package?” action is visible but does not block the first result.
- Selecting it marks the catalog match uncertain and starts Package Capture.
- Ingredient, allergen, date, certification, importer, or front-design differences are material.
- A shopper capture never automatically overwrites or publishes a Package Revision.

## Epic 3: Understand the label in Khmer

### US-3.1 — See a prioritized result

As a Primary Shopper, I want the most consequential information first so that I can understand the package quickly.

Acceptance criteria:

- Presents, in order: package identity, Critical Declared Concerns, Evidence Uncertainty, Khmer label summary, and source access.
- Includes the original source text or image location for important findings.
- Does not show a universal health score or purchase verdict.
- Uses “declared,” “detected in readable label,” “uncertain,” and “not assessed” consistently.

### US-3.2 — Read ingredient names in Khmer

As a Primary Shopper, I want concise Khmer ingredient names alongside the original label wording so that I can scan the list without losing the source meaning.

Acceptance criteria:

- Preserves original ingredient order, nesting, percentages, and source text.
- Shows approved Khmer vocabulary for safety-critical ingredients and additives.
- May show clearly marked AI-generated names for ordinary ingredients.
- Keeps ambiguous terms in the original language and marks them uncertain.
- Does not use an unreviewed Khmer translation as the sole basis of an assessment.
- Lets the shopper flag an unclear translation.

### US-3.3 — Learn about a term

As a Primary Shopper, I want an explanation only when I ask for it so that the main result stays simple.

Acceptance criteria:

- Opens a contextual Learn More view without leaving the result.
- Uses one of the 20–30 source-cited, reviewed MVP Knowledge Entries when available.
- Shows original summaries rather than copied web text.
- Provides an official external link when reviewed local content is unavailable.
- Keeps Product-specific conclusions separate from general education.

## Epic 4: Interpret declared concerns conservatively

### US-4.1 — Understand allergen evidence

As an allergy-conscious shopper, I want the app to distinguish what the label says from what it cannot establish.

Acceptance criteria:

- Supports `DECLARED_CONTAINS`, `DECLARED_MAY_CONTAIN`, `DERIVED_FROM_INGREDIENT`, `NO_DECLARATION_DETECTED_IN_READABLE_LABEL`, `LABEL_INCOMPLETE_OR_UNREADABLE`, and `NOT_ASSESSED` outcomes.
- Approved exact, synonym, and derivative matches may produce automatic assessments.
- New AI-suggested mappings remain uncertain until reviewed.
- “No declaration detected” includes the qualification that it is not an allergen-free guarantee.
- Every assessment points to the original label evidence and vocabulary/rule version.

### US-4.2 — Understand Halal-related evidence

As a Halal-conscious shopper, I want ingredient screening and certification kept separate so that absence of a detected concern is not mistaken for certification.

Acceptance criteria:

- Ingredient outcomes distinguish explicit prohibited ingredient, ambiguous source, no declared non-Halal ingredient detected in readable evidence, incomplete evidence, and not assessed.
- Seal outcomes distinguish observed, unreadable, absent from photographed area, and not assessed.
- Does not label a Product “Halal” from ingredient screening or logo recognition.
- If no authoritative registry check exists, certificate verification remains not assessed.
- Every outcome points to its original label evidence.

### US-4.3 — Understand an additive

As a Primary Shopper, I want an additive identified and explained without unsupported danger language.

Acceptance criteria:

- Matches approved INS/E-number, name, synonym, and function data.
- Launches with reviewed Khmer coverage for the highest-frequency 100–150 additives found in pilot evidence.
- Shows unknown codes or terms with an explanation pending state rather than guessing.
- States a restriction only when jurisdiction, food category, effective period, and any required concentration support it.
- Otherwise provides a neutral, source-cited explainer.
- Never infers excessive quantity when concentration is not declared.

### US-4.4 — Interpret a package date

As a Primary Shopper, I want foreign date markings interpreted so that I do not confuse manufacture, best-before, and expiry dates.

Acceptance criteria:

- Identifies manufacture, best-before, use-by/expiry, shelf-life instruction, or unknown date type.
- Shows the exact source text and interpreted date.
- Uses “date has passed,” “date has not passed,” or “date meaning uncertain,” never “safe.”
- Explains the difference between best-before and use-by/expiry.
- Supports automatic interpretation first; correction or manual entry is optional.
- Stores concrete dates only for the Observed Package or identified Batch.

## Epic 5: Personalization, privacy, and delivery

### US-5.1 — Prioritize optional preferences

As a shopper with specific needs, I want an optional preferences page so that relevant concerns appear first without mandatory onboarding.

Acceptance criteria:

- Requires no account and does not appear as a blocking first-run step.
- Stores preferences locally on the device.
- Prioritizes selected concerns but never hides unselected critical concerns or uncertainty.
- Says “prioritized for your preferences,” not “only risks relevant to you.”

### US-5.2 — Use the app anonymously

As a Primary Shopper, I want to scan without creating an identity or lasting behavior profile.

Acceptance criteria:

- Scanning, search, Package Capture, dates, and Learn More require no account.
- Scan history is session-only and has a clear action.
- Analytics use short-lived random session identifiers and exclude preferences, precise location, raw media, and persistent shopper identity.
- Shared links never expose another scan or the shopper session.

### US-5.3 — Access the online MVP

As a Primary Shopper, I want the same core experience in Telegram or a normal browser.

Acceptance criteria:

- Provides an online Telegram Mini App and responsive Web Client from one product experience.
- Khmer is the default interface with optional English.
- Original package languages remain visible in either interface locale.
- Does not promise offline launch or operation in the MVP.

## Pilot validation

Before treating the persona and stories as final:

- Interview and observe approximately 8–12 relevant Cambodian shoppers across several shopping contexts.
- Run iterative Khmer usability rounds of about five participants each.
- Test comprehension of declared concern, none detected in readable evidence, uncertain, unreviewed AI translation, and seal/certificate status.
- Confirm shoppers compare package images and can complete the primary journey without assistance.
- Maintain an evaluation set of 50–100 project-owned or appropriately consented package images spanning Khmer, English, Vietnamese, Simplified Chinese, and Thai.

Initial pilot gates:

- At least 80% of valid known barcodes return usable identity information.
- At least 90% of known results meet the three-second pilot target.
- At least 80% of completed Package Captures return an interpretation within 15 seconds.
- At least 80% of usability participants correctly distinguish concern, none detected, and uncertainty.
- No participant interprets the interface as guaranteeing safety, Halal certification, allergen absence, legality, or authenticity.

## Explicitly deferred

- Offline Market Mode
- Public contribution, reputation, and community moderation
- SME brand authenticity advisories
- Nutrition spoon visualizations and health scoring
- Certificate verification beyond seal observation
- Khmer-label legal Compliance Assessments
- Telegram Share Cards
- Official Report Referral
- Broad standalone Food Literacy Hub content beyond 20–30 contextual Knowledge Entries
