# MVP Personas and User Stories

This document defines the first pilot for the Khmer Food Product Intelligence platform. Stories use the domain language in [`CONTEXT.md`](../CONTEXT.md) and the evidence boundary established during the product interview.

## Product outcome

A Cambodian shopper scans or photographs a sealed packaged food before purchase and receives original label evidence, English-first ingredient explanations, evidence-scoped assessments, and visible uncertainty through a Khmer-first interface. The platform informs the shopper; it does not issue a buy/don't-buy verdict or declare a Product safe, healthy, Halal, legal, compliant, verified, or authentic.

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

- Searches the Active OFF Dataset Version by barcode and available original Product or brand names.
- Preserves a language tag and source for every displayed name.
- Handles Unicode normalization and common spacing or punctuation differences.
- Does not promise untested cross-script transliteration or typo tolerance.
- Shows Package Variants rather than collapsing different sizes or market packages.

## Epic 2: Use existing and current evidence

### US-2.1 — View an Open Food Facts result

As a Primary Shopper, I want locally available community data to be useful while LifeGoods has no reviewed Product catalog.

Acceptance criteria:

- Uses eligible Open Food Facts fields as field-level external Evidence, not as one authoritative Product record.
- Labels the result “Community data from Open Food Facts—not yet reviewed by this project.”
- Shows attribution, source link, retrieval/activation times, Dataset Version, integrity metadata, and relevant source modification data.
- Never interprets an empty ingredient, allergen, trace, or nutrition field as “none.”
- Asks the shopper to compare the reference front image with the physical package.
- Runs activated human-reviewed reference mappings only against readable source evidence.
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

## Epic 3: Understand the available label evidence

### US-3.1 — See a prioritized result

As a Primary Shopper, I want the most consequential information first so that I can understand the package quickly.

Acceptance criteria:

- Presents, in order: package identity, profile-matched and other concerns, Evidence Uncertainty, available label evidence and English explanations, and source access.
- Includes the original source text or image location for important findings.
- Does not show a universal health score or purchase verdict.
- Uses “declared,” “detected in readable label,” “uncertain,” and “not assessed” consistently.

### US-3.2 — Read ingredient explanations

As a Primary Shopper, I want concise English ingredient descriptions alongside the original label wording when they are available so that I can inspect meaning without losing the source.

Acceptance criteria:

- Preserves original ingredient order, nesting, percentages, and source text.
- Shows project-authored, source-cited, activated English descriptions linked to stable ingredient concepts.
- Keeps ambiguous terms in the original language and marks them uncertain.
- Does not use a description or translation as the assessment input.
- Defers Khmer ingredient-description translation to the next version.

### US-3.3 — Learn about a term

As a Primary Shopper, I want an explanation only when I ask for it so that the main result stays simple.

Acceptance criteria:

- Opens a contextual Learn More view without leaving the result.
- Uses a locally hosted, source-cited, activated English Knowledge Entry when available.
- Shows original summaries rather than copied web text.
- Provides an authoritative external link when activated local content is unavailable.
- Keeps Product-specific conclusions separate from general education.

## Epic 4: Interpret declared concerns conservatively

### US-4.1 — Understand allergen evidence

As an allergy-conscious shopper, I want the app to distinguish what the label says from what it cannot establish.

Acceptance criteria:

- Supports `DECLARED_CONTAINS`, `DECLARED_MAY_CONTAIN`, `DERIVED_FROM_INGREDIENT`, `NO_DECLARATION_DETECTED_IN_READABLE_LABEL`, `LABEL_INCOMPLETE_OR_UNREADABLE`, and `NOT_ASSESSED` outcomes.
- Activated exact, synonym, precautionary, and derivative mappings may produce automatic assessments.
- Missing, ambiguous, or inactive mappings remain uncertain.
- “No declaration detected” includes the qualification that it is not an allergen-free guarantee.
- Every assessment points to original OFF evidence and the exact Reference Dataset Version.

### US-4.2 — Understand Halal-related evidence

As a Halal-conscious shopper, I want ingredient screening and certification kept separate so that absence of a detected concern is not mistaken for certification.

Acceptance criteria:

- Ingredient outcomes distinguish explicit prohibited ingredient, ambiguous source, no declared non-Halal ingredient detected in readable evidence, incomplete evidence, and not assessed.
- Uses a project-authored, human-reviewed mapping derived from cited Cambodian and properly licensed international sources.
- Does not label a Product “Halal” from ingredient screening, lack of a match, logo, brand, origin, or Product category.
- Keeps Seal Observation and certificate verification separate and not assessed in this slice.
- Every outcome points to original label evidence and the exact Reference Dataset Version.

### US-4.3 — Understand an additive

As a Primary Shopper, I want an additive identified and explained without unsupported danger language.

Acceptance criteria:

- Matches approved INS/E-number, name, synonym, and function data.
- Provides a neutral, source-cited English explanation when available.
- Shows unknown codes or terms with an explanation pending state rather than guessing.
- Uses a reviewed Cambodian rule when applicable; otherwise a reviewed Codex rule may appear only as an international reference.
- States a limit concern only when jurisdiction/reference scope, food category, effective period, concentration, and unit support it.
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
- Offers only allergens from the activated reviewed vocabulary and accepts no free text.
- Stores preferences only in that browser/device until reset and never sends values to the backend or analytics.
- Prioritizes matching declared, may-contain, and derived outcomes without changing assessment logic or hiding other concerns or uncertainty.
- Says “matches your selected concern,” not “harmful” or “safe for you.”

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
- Test comprehension of declarations, derived matches, none detected in readable evidence, uncertainty, international additive references, and ingredient screening versus certification.
- Measure whether English-first ingredient descriptions are usable and document the audience excluded until Khmer translation ships.
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
- Locally observed Product seed data and reviewed-local precedence
- Product Claim moderation, Preferred Claims, and Unresolved Conflicts
- Khmer ingredient-description and Knowledge Entry translation
- Broad standalone Food Literacy Hub content
