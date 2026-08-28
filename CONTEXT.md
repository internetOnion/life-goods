# Khmer Food Product Intelligence

A Khmer-first domain for helping Cambodian shoppers understand evidence from packaged-food labels before purchase. The platform presents evidence-scoped guidance and uncertainty; it does not decide whether a product is safe, healthy, Halal, legal, or authentic.

## People and scope

**Primary Shopper**:
A Khmer-speaking consumer who buys packaged food but cannot confidently interpret foreign-language labels or technical ingredient information while shopping. Age, gender, parenthood, and shopping location are contextual rather than defining traits.
_Avoid_: Sokha, low-literacy mother, everyday user

**Supported Product**:
A sealed retail packaged food or non-alcoholic beverage offered for sale in Cambodia. Alcohol, supplements, infant formula and specialized nutrition, medicines, restaurant or fresh food, and unlabeled products are outside the MVP boundary.
_Avoid_: Any Open Food Facts record, all consumer goods

**Anonymous Shopper Session**:
A package-identification-and-view interaction that requires no account and retains lookup history only for the current session.
_Avoid_: Guest account, anonymous user record

**Contributor**:
A deferred post-MVP role for a person who offers evidence for possible shared catalog use. The MVP has no contributor profiles, reputation, or public-submission workflow.
_Avoid_: MVP shopper, Telegram user

**Moderator**:
A deferred post-MVP authenticated project-team member who reviews Claims, Evidence, Catalog Candidates, and conflicts under an auditable policy.
_Avoid_: Community verifier, admin

## Product identity

**Product**:
The stable, consumer-recognizable food or beverage offering that may be sold through multiple Package Variants and revised over time. A Product is not uniquely identified by a barcode or image.
_Avoid_: Item, goods, SKU, barcode record

**Package Variant**:
A market-facing form of a Product distinguished by characteristics such as package quantity, intended market, identifiers, and packaging languages.
_Avoid_: Product version, SKU

**External Identifier**:
A sourced identifier associated with a Package Variant, such as a normalized GTIN-8, UPC-A, EAN-13, or GTIN-14, together with its scheme, validation state, evidence, and any known effective period. It is a lookup key, not the Product's identity.
_Avoid_: Product ID, barcode primary key

**Package Revision**:
A historically distinct label or formulation of a Package Variant, preserved rather than overwritten by later changes.
_Avoid_: Current product data, edit

**Observed Package**:
Evidence captured from one physical package at a particular time, including its photos and directly observable label facts.
_Avoid_: Product Submission, scan result

**Batch**:
A set of physical packages associated with the same manufacturer-assigned lot or batch code. Concrete manufacture and expiry dates may apply to a Batch but never to a Product as a whole.
_Avoid_: Product version, shipment

**Catalog Candidate**:
An internal proposal for a Product, Package Variant, or Package Revision assembled by the project team from evidence but not yet accepted as shared catalog information.
_Avoid_: Unverified Product, public draft, shopper submission

**Product Name Claim**:
A language-tagged name for a Product or Package Variant, distinguished by source and role such as original label name, reviewed Khmer name, or external community name.
_Avoid_: Product name field, translated title

**Shopper Category**:
A Khmer-first consumer classification used for browsing and explanation. It does not independently determine regulatory treatment.
_Avoid_: Regulatory category, Open Food Facts tag

**Regulatory Food Category**:
A versioned classification under a specified regulatory standard, supported by mapping evidence and review state, used for category-dependent rules.
_Avoid_: Browse category, product tag

## Label data

**Label Transcription**:
Original-language packaging text read from a specific region of evidence, preserved with its language and uncertainty.
_Avoid_: Ingredient translation, cleaned text

**Ingredient Occurrence**:
An ordered, source-spanned node in a Package Revision's declared ingredient tree, preserving compound-ingredient nesting, percentages, and possible normalized mappings.
_Avoid_: Flat ingredient, canonical ingredient row

**Normalized Ingredient**:
A canonical ingredient or additive concept mapped from Label Transcription when evidence is sufficiently strong.
_Avoid_: Raw ingredient text, Khmer name

**Khmer Ingredient Name**:
A concise Khmer display name linked to source text and any Normalized Ingredient, shown alongside rather than instead of the original label wording.
_Avoid_: Ingredient description, rewritten ingredient list

**Ingredient Explainer**:
A reusable, language-tagged description of a Normalized Ingredient's identity, common function, relevant evidence, and uncertainty, opened on demand.
_Avoid_: Product warning, per-product translation

**Date Marking**:
A manufacture date, expiry date, best-before date, or shelf-life instruction read from an Observed Package and scoped to that package or its identified Batch.
_Avoid_: Product expiry date, catalog date

**Date Interpretation**:
An assessment identifying a Date Marking's type, interpreted value, source text, and whether the date has passed. Shopper correction is optional, and the result never declares a Product safe.
_Avoid_: Safety date, Product freshness

**Nutrition Declaration**:
Nutrition values transcribed from label evidence with their basis, such as per serving, per 100 g/ml, per package, or prepared product.
_Avoid_: Product nutrition, health score

**Nutrition Visualization**:
A deferred transparent calculation derived from a Nutrition Declaration whose quantity basis and units are explicit.
_Avoid_: Nutrition score, healthy badge

**Organization**:
A legally or commercially identifiable entity associated with packaged food, such as a brand owner, manufacturer, importer, distributor, or certifier.
_Avoid_: Brand, vendor, company field

**Organization Role**:
The explicit capacity in which an Organization relates to a Product, Package Variant, Package Revision, or Batch, together with any known effective period.
_Avoid_: Origin Data, vendor type

**Manufacture Origin**:
An evidence-backed Claim about where a Package Revision or Batch was manufactured. It is not inferred from a barcode prefix or brand country.
_Avoid_: Barcode country, brand country

## Evidence and trust

**Claim**:
A single assertion about a domain subject whose trust can be evaluated independently, such as an ingredient declaration, barcode, origin, or certification.
_Avoid_: Product fact, field value

**Evidence**:
Source material supporting or contradicting a Claim, including package photos, external records, manufacturer material, and reviewed project observations, with source and observation time.
_Avoid_: Proof, attachment

**Claim Review State**:
The lifecycle state `PROPOSED`, `ACCEPTED`, `DISPUTED`, `REJECTED`, `SUPERSEDED`, or `WITHDRAWN`, stored separately from production method, confidence, and authority.
_Avoid_: Verification tier, AI status, Product approval

**Claim Verification**:
The provenance and review of an individual Claim, including how it was produced, its evidence, and whether an authoritative source confirmed it. Verification never applies indiscriminately to a whole Product.
_Avoid_: Product verification status, trust score

**Preferred Claim**:
The Claim selected for a specific Package Revision because its identity and evidence are sufficiently strong. Selection does not erase competing Claims.
_Avoid_: True value, canonical fact

**Unresolved Conflict**:
A material disagreement between Claims that cannot be attributed to distinct Package Revisions with sufficient confidence and remains visible when relevant.
_Avoid_: Data error, duplicate value

**Extraction Run**:
A reproducible record of an AI processing attempt, including model, prompt and schema versions, input evidence, structured output, timing, uncertainty, status, and proposed Claims or translations.
_Avoid_: AI verification, Product extraction status

**Assessment Run**:
A reproducible application of specified vocabulary and rule versions to source Claims and evidence. Recalculation supersedes earlier assessments without erasing them.
_Avoid_: Mutable warning calculation

**External Evidence Source**:
A third-party source such as Open Food Facts whose fields and images remain individually attributed, dated, and distinguishable from project-reviewed Claims.
_Avoid_: Imported Product truth, silent data merge

**OFF Dataset Version**:
An immutable, identified export of Open Food Facts Product documents with its source location, retrieval time, and integrity hash. Its age limits what it can say about upstream Open Food Facts, but does not erase its value as dated external Evidence.
_Avoid_: Current OFF data, reviewed catalog, local Product truth

**Active OFF Dataset Version**:
The OFF Dataset Version selected for Package Match lookup until an operator explicitly activates another version. Active means locally selected, not synchronized with or verified by Open Food Facts.
_Avoid_: Latest OFF data, live mirror, source of truth

**Reference Dataset Version**:
An immutable, human-reviewed release of sourced concepts, mappings, rules, descriptions, or Knowledge Entries used to interpret Evidence. Its approval applies to that reference release and never reviews or verifies a Product record.
_Avoid_: Verified Product data, universal truth list, mutable lookup table

**Active Reference Dataset Version**:
The Reference Dataset Version explicitly selected for an assessment purpose. Active means approved for that scoped use, not universally authoritative or applicable outside its recorded jurisdiction and effective period.
_Avoid_: Current truth, globally valid rule, Product approval

## Vocabulary, translation, and education

**Reviewed Safety Vocabulary**:
A versioned set of human-reviewed concepts, source terms, synonyms, derivative mappings, explanations, and critical phrases used by Allergen, Halal Ingredient, and Additive Assessments.
_Avoid_: AI glossary, universal allergen list, global Halal truth list

**Vocabulary Review State**:
A deferred granular editorial state for future authoring: `AI_DRAFT`, `IN_LANGUAGE_REVIEW`, `IN_DOMAIN_REVIEW`, `APPROVED`, `REJECTED`, or `SUPERSEDED`. MVP-1 approval applies to an immutable Reference Dataset Version rather than a runtime per-entry workflow.
_Avoid_: AI confidence, translated

**Safety Vocabulary Match**:
A traceable mapping from original Label Transcription to an approved canonical allergen, additive, or critical ingredient term. Safety assessments use this match and its evidence, never a Khmer translation alone.
_Avoid_: Translation match, AI safety guess

**Knowledge Entry**:
A reusable, versioned, language-tagged explanation linked to a canonical ingredient, allergen, additive, date, or certification concept, with sources, review state, and jurisdiction where relevant.
_Avoid_: Scraped article, Product description, uncited AI content

**Contextual Explainer**:
The one-tap Learn More presentation of a Knowledge Entry without leaving the product result.
_Avoid_: Generic help center, Product article

## Assessments and shopper guidance

**Derived Assessment**:
A rule- or review-produced interpretation linked to the Claims, evidence, vocabulary, and rule versions from which it was derived. It is not text declared directly by the package.
_Avoid_: Ingredient, label fact

**Allergen Assessment**:
An assessment for a specific allergen distinguishing an explicit contains declaration, precautionary may-contain declaration, ingredient-derived match, no declaration detected in readable evidence, incomplete evidence, or no assessment. It never declares a Product allergen-free.
_Avoid_: Allergen Flag, allergy badge

**Halal Ingredient Assessment**:
An assessment reporting an explicit prohibited ingredient, an ambiguous-source ingredient, no declared non-Halal ingredient detected in readable evidence, or no complete assessment. It does not establish certification.
_Avoid_: Halal certified, safe for Muslims

**Additive Assessment**:
An assessment identifying a declared additive, function, and any regulatory status demonstrably applicable by jurisdiction, food category, concentration when known, and effective period. Otherwise it provides a neutral explainer.
_Avoid_: Hazard Flag, dangerous chemical badge

**International Reference Concern**:
An Additive Assessment outcome indicating that declared evidence exceeds a reviewed international reference when no applicable Cambodian rule is available. It is not a Cambodian legal or Compliance Assessment.
_Avoid_: Illegal additive, Cambodia limit violation, global law

**Critical Declared Concern**:
A prominent indication that label evidence declares an allergen, explicit non-Halal ingredient, or passed expiry date. It does not imply independent testing.
_Avoid_: Universal Warning, confirmed hazard

**Evidence Uncertainty**:
A prominent indication that important evidence is unreadable, missing, stale, or conflicting, preventing reliable guidance.
_Avoid_: No warning, safe, data unavailable

**Shopper Guidance**:
A prioritized presentation of declared concerns, uncertainty, Khmer label facts, and evidence that helps a Primary Shopper decide. It is not a purchase verdict, health score, or safety declaration.
_Avoid_: Product recommendation, safety verdict

**Dietary Preference Profile**:
An optional device-local selection of supported reviewed allergens that prioritizes matching concerns without onboarding or an account. It never changes assessment logic or hides other critical concerns or uncertainty.
_Avoid_: Mandatory profile, medical record

## Certification and regulation

**Regulatory Rule**:
A sourced, jurisdiction-specific requirement or restriction with defined scope and effective period.
_Avoid_: Safety fact, general guideline

**Supplemental Khmer Label Observation**:
Evidence that a Khmer supplemental label is visible, not visible, unreadable, or outside the photographed area. It does not establish legal compliance, registration, or authenticity.
_Avoid_: Official sticker verification, grey-market badge

**Compliance Assessment**:
A deferred conclusion that evidence satisfies an identified regulatory requirement and jurisdiction, made only when the applicable rule and authoritative evidence are known.
_Avoid_: Sticker status, legality flag

**Seal Observation**:
Evidence that a certification logo or registration mark is visible, unreadable, absent from the photographed area, or not assessed. It does not establish certificate validity.
_Avoid_: Verified certificate, certified Product

**Certificate**:
A sourced certification record identifying certifier, holder, certificate number, issue and expiry dates, status, and documentary source.
_Avoid_: Seal, Product badge

**Certificate Scope**:
The Products, Package Variants, Package Revisions, Organizations, or manufacturing sites explicitly covered by a Certificate.
_Avoid_: Brand-wide certification, logo scope

**Certificate Verification Event**:
An auditable check of a Certificate against an identified authoritative source at a particular time.
_Avoid_: Logo recognition, moderator approval

**Official Channel**:
A reviewed, dated directory entry for a government reporting page, hotline, or other official destination, including supported issue types, geography, language, source, and active state.
_Avoid_: Hard-coded report URL, complaint record

**Official Report Referral**:
A deferred handoff that directs a shopper to an Official Channel without collecting, submitting, or tracking a complaint.
_Avoid_: Report submission, evidence dossier

## Interactions and delivery

**Shopper-Facing Destination**:
A user-visible entry point into a shopper journey, such as identification, Package Match results, Package Capture, Learn, session history, or dietary preferences. Each destination preserves evidence scope and uncertainty rather than implying a purchase, health, safety, Halal, legal, or authenticity verdict.
_Avoid_: Route, screen, dashboard

**Scan Mode**:
The shopper-selected identification interface: barcode scan, manual identifier entry, Package Capture, or catalog browse.
_Avoid_: Camera mode, view type

**Manual Identifier Entry**:
A shopper-provided External Identifier entered as printed digits, optionally including spaces or hyphens, for validation and Package Match lookup.
_Avoid_: Free-text product search, Product identity

**Package Match**:
A set of candidate Package Variants or Revisions retrieved by identifier, appearance, or packaging text. A match is not proof that the physical package is the same revision.
_Avoid_: Product identity, visual truth

**Package Capture**:
The MVP flow where a shopper photographs a package for an immediate private interpretation. Media is retained only for active processing and encrypted retry/recovery for at most 24 hours and never becomes catalog or training data.
_Avoid_: Product Submission, public upload

**Product Submission**:
A deferred post-MVP contribution flow through which a Contributor offers evidence for possible catalog use.
_Avoid_: Package Capture, MVP photo scan

**Web Client**:
The responsive website entry point for the online MVP.
_Avoid_: Native app

**Telegram Mini App**:
The Telegram-embedded entry point to the same online MVP.
_Avoid_: Telegram bot, offline app

**Offline Market Mode**:
A deferred capability for launching and using retained guidance without connectivity. The MVP requires internet access.
_Avoid_: MVP offline support, Top 100 cache

**Telegram Share Card**:
A deferred, dated snapshot of evidence-scoped Shopper Guidance designed for Telegram sharing without accusing a Product or brand of being unsafe, illegal, or counterfeit.
_Avoid_: Public warning, accusation

**Brand Authenticity Advisory**:
A deferred capability for guidance published by an authenticated, authorized brand owner. It is not a platform counterfeit determination.
_Avoid_: Sponsored warning, counterfeit verdict
