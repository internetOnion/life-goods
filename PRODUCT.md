# Product

<!-- impeccable:product-schema 1 -->

# Life Goods

## Platform

web, also opened as a Telegram Mini App from the same build and URL (ADR 0006)

## Users

The first audience is Khmer-speaking Shoppers using a mobile phone while shopping in Cambodia. Life Goods remains accessible elsewhere, but Cambodia determines the initial language, device, connectivity, and usability priorities.

## Product Purpose

Life Goods makes Open Food Facts data easier to access and understand without creating a separate food catalog or verification system. A Shopper scans a packaged-food Barcode and receives a readable presentation of the available Source Record. Typed Barcode entry is the fallback when scanning is unavailable or unsuccessful. When a Barcode has no Source Record, a Shopper can read that Product's nutrition label from photos. Independently of any Barcode, a Shopper can read one Product's label or compare two Products from photos of their nutrition labels.

The English prototype explores a mobile information architecture against complete, sparse, multilingual, irregular, and data-rich Source Records. The public MVP follows with Khmer localization and on-demand Khmer Translation while retaining Original Text in the Source Record.

Success means a Shopper can move quickly from a Barcode to understandable Product information while always being able to distinguish source data, Source Assessments, generated translation, and Source Data Unavailable.

## Positioning

Life Goods is a Khmer-first, read-only presentation layer over one static local Open Food Facts Dataset Snapshot. It localizes and redesigns the experience while keeping Open Food Facts visibly attributed and without adopting its data as a Life Goods catalog or judgment.

## Operating Context

The primary workflow happens one-handed on a mobile phone in a shop. The Shopper scans a physical Barcode on-device or types it, then reads Product identity, images, ingredients, nutrition, Source Assessments, environmental and packaging information, other available details, and source history. Connectivity may be constrained, Product records may be incomplete or inconsistent, and package images and text may be multilingual.

## Capabilities and Constraints

- Mobile-first progressive web application with anonymous, read-only use
- On-device Barcode decoding; Barcode camera frames are not uploaded or retained
- Product Lookup against one static, locally hosted Open Food Facts Dataset Snapshot
- Nutrition Labels: Read This Label for one Product's package label and Compare Nutrition for two Products' nutrition labels, from the Shopper's photos, including when a Barcode has no Source Record, with transient provider processing and no retained reading or comparison history
- Independent ingredient-text allergen evidence compared with Open Food Facts allergen tags
- English information-architecture prototype before the Khmer public MVP
- On-demand Khmer Translation in the public MVP while retaining Original Text in the Source Record
- Translation failure falls back to Original Text instead of failing Product Lookup
- Visible Source Attribution on every Product page and a global data-and-licenses notice
- Privacy-preserving aggregate operational metrics only; no accounts, saved Products, persistent scan history, comparison history, personalization, Barcode-level analytics, persistent Shopper identifiers, or retained comparison photos
- No Product contributions, corrections, moderation, verification, live Open Food Facts fallback, or automatic Dataset Snapshot updates
- No health, safety, allergen-free, Halal, authenticity, legal, compliance, or purchase verdicts, and no overall comparison winner or Life Goods comparison score
- Shopper allergen choices are stored in browser storage only (with an in-memory
  fallback for the current tab when storage is unavailable) and highlight
  matching Source Record evidence on Product pages. Choices are never sent to
  the backend, stored in an account, or included in analytics.

When available, ingredient-text allergen evidence is shown separately from Open Food Facts
allergen tags. The comparison describes agreement and differences between two source-based
signals; it does not verify either source or make an allergen-free or safety claim.

## Nutrition Labels

Nutrition Labels is a primary Life Goods section, alongside Barcode scanning,
with two modes that share one photo budget: Read This Label and Compare
Nutrition.

Read This Label guides the Shopper to photograph one Product's package (front,
back, and an optional side panel) and presents a Label Reading: the ingredients
and Printed Allergen Statements as printed, a Khmer Rendering of that text,
every printed nutrition column with its printed basis, and a short list of other
printed facts, all clearly marked as Photo Evidence. When a photo shows a Barcode
that has a Source Record, the Shopper is offered the Product page instead. Read
This Label is available directly from the Nutrition Labels section and is the
primary next step offered for an Unmatched Barcode. A Label Reading is not a
Source Record, carries no Source Attribution or Source Assessment, and never uses
the phrase Source Data Unavailable, which describes Source Records only. It
reports the Shopper's selected allergens only where they appear in the text that
was read, and never says a Product is free of anything. The Barcode, when present,
is shown for context and never sent to the AI provider or with the photos.

Compare Nutrition, described as “Compare nutrition labels using photos,”
photographs Product A and Product B, taps Compare, and
receives readable nutrition differences with a clearly stated comparison basis.
It works without a Barcode or Source Record, so missing or incomplete source data
does not prevent comparison. Compare Nutrition helps a Shopper interpret label
differences; it does not declare an overall winner or a health, safety, or
purchase verdict.

Nutrition Labels photo processing is the one bounded exception to the
read-only, no-upload MVP boundary (ADR 0004, ADR 0005). Photos submitted in either mode are
sent to the configured AI provider for processing and are never retained by Life
Goods as Product data, Source Records, reading or comparison history, or Khmer
Translation input. Khmer Rendering of text read from photos is transient and is
not Khmer Translation. Extracted values remain
submitted Photo Evidence: they are kept separate from Open Food Facts data, are
not a Source Record, and are not glossary-defined Original Text. The exception
does not create Product contributions, corrections, or verification, and it does
not change Product Lookup, Product Search, Dataset Snapshot, Source Attribution,
or Khmer Translation behavior.

Shopper choices use the 13 agreed Open Food Facts allergen groups and exact tags. They are
browser-only display preferences. Immediately after a Product name, the Product page shows a
short notice labeled “Selected allergens found” followed by the matched names only when a selected group has completed, unambiguous backend ingredient
evidence or an exact Open Food Facts declaration. Raw ingredient text, legacy assessments, and
frontend keyword guesses cannot create a match. “May contain” wording, Open Food Facts traces,
negated wording, unclear wording, and missing or incomplete checks remain in the detailed source
sections below and do not create the compact notice. When no selected group matches, the notice
is hidden.

Source Assessments such as Nutri-Score, NOVA, Green-Score, and nutrient-level classifications remain visibly attributed Open Food Facts calculations. Life Goods does not verify, recalculate, or adopt them as its own judgments. Source Data Unavailable is unknown, not evidence that a Product has or lacks a property.

## Brand Commitments

The product name is written “Life Goods”; the logo wordmark is set as one word, “LifeGoods.” The supplied warm amber brand, cool slate surface palette, and close visual relationship to the `life-goods-viewer` reference are binding inputs. The public identity must remain Khmer-ready rather than treating Khmer as a fallback adaptation. Visual communication, including iconography and illustrations, must prioritize semantic clarity for the Shopper and maintain a crafted, vibe-coded character over rigid adherence to any single icon vendor.

## Evidence on Hand

- Raw Source Records and Dataset Snapshot metadata from the experimental Product Lookup API
- Open Food Facts Product images and Product-page links when supplied by the Source Record
- Complete and sparse Open Food Facts test fixtures under `backend/tests/fixtures/open_food_facts/`
- A visual and interaction reference in the sibling `life-goods-viewer` repository
- No testimonials, customer claims, verification evidence, pricing claims, or Life Goods-owned Product data

## Product Principles

1. **Source breadth before hierarchy.** First learn which Open Food Facts data is useful; then refine how it is prioritized.
2. **Localization without ownership.** Life Goods translates and redesigns the experience but does not present source data as its own catalog.
3. **Original meaning remains accessible.** Khmer Translation never replaces Original Text in the Source Record; the selected locale supplies display-language context and generated output is not presented as human-reviewed or verified.
4. **Missing means unknown.** An absent field is Source Data Unavailable, not evidence that a property is absent.
5. **Attribution stays visible.** Every Product page identifies Open Food Facts as the source and links to applicable data and image licensing information.
6. **Lookup works without translation.** A translation failure falls back to Original Text instead of failing the Product page.
7. **Privacy by omission.** Barcode decoding happens on the device, and Life Goods does not build accounts, scan histories, or Barcode-level analytics.

## Accessibility & Inclusion

Khmer support is required before the public MVP. Fluent human review is required for interface terminology, navigation, explanations, disclaimers, and accessibility copy. Complete, sparse, multilingual, irregular, and data-rich Source Records must render intentionally on mobile without broken layouts or accidental raw-field dumps.

## Attribution

Every Product page displays a visible “Data from Open Food Facts” link. A global data-and-licenses notice covers the [Open Food Facts reuse terms](https://world.openfoodfacts.org/data), including the database, database contents, and image licenses.
