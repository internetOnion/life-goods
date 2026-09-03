# Product

<!-- impeccable:product-schema 1 -->

# Life Goods

## Platform

web

## Users

The first audience is Khmer-speaking Shoppers using a mobile phone while shopping in Cambodia. Life Goods remains accessible elsewhere, but Cambodia determines the initial language, device, connectivity, and usability priorities.

## Product Purpose

Life Goods makes Open Food Facts data easier to access and understand without creating a separate food catalog or verification system. A Shopper scans a packaged-food Barcode and receives a readable presentation of the available Source Record. Typed Barcode entry is the fallback when scanning is unavailable or unsuccessful.

The English prototype explores a mobile information architecture against complete, sparse, multilingual, irregular, and data-rich Source Records. The public MVP follows with Khmer localization, on-demand Khmer Translation, and Original Text available per translated field.

Success means a Shopper can move quickly from a Barcode to understandable Product information while always being able to distinguish source data, Source Assessments, generated translation, and Source Data Unavailable.

## Positioning

Life Goods is a Khmer-first, read-only presentation layer over one static local Open Food Facts Dataset Snapshot. It localizes and redesigns the experience while keeping Open Food Facts visibly attributed and without adopting its data as a Life Goods catalog or judgment.

## Operating Context

The primary workflow happens one-handed on a mobile phone in a shop. The Shopper scans a physical Barcode on-device or types it, then reads Product identity, images, ingredients, nutrition, Source Assessments, environmental and packaging information, other available details, and source history. Connectivity may be constrained, Product records may be incomplete or inconsistent, and package images and text may be multilingual.

## Capabilities and Constraints

- Mobile-first progressive web application with anonymous, read-only use
- On-device Barcode decoding; camera frames and package photos are not uploaded or retained
- Product Lookup against one static, locally hosted Open Food Facts Dataset Snapshot
- English information-architecture prototype before the Khmer public MVP
- On-demand Khmer Translation in the public MVP, with Original Text available per translated field
- Translation failure falls back to Original Text instead of failing Product Lookup
- Visible Source Attribution on every Product page and a global data-and-licenses notice
- Privacy-preserving aggregate operational metrics only; no accounts, saved Products, persistent scan history, personalization, Barcode-level analytics, or persistent Shopper identifiers
- No Product contributions, corrections, moderation, verification, live Open Food Facts fallback, or automatic Dataset Snapshot updates
- No health, safety, allergen-free, Halal, authenticity, legal, compliance, or purchase verdicts

Source Assessments such as Nutri-Score, NOVA, Green-Score, and nutrient-level classifications remain visibly attributed Open Food Facts calculations. Life Goods does not verify, recalculate, or adopt them as its own judgments. Source Data Unavailable is unknown, not evidence that a Product has or lacks a property.

## Brand Commitments

The product name and wordmark use the spaced form “Life Goods.” The supplied warm amber brand, cool slate surface palette, and close visual relationship to the `life-goods-viewer` reference are binding inputs. The public identity must remain Khmer-ready rather than treating Khmer as a fallback adaptation. Visual communication, including iconography and illustrations, must prioritize semantic clarity for the Shopper and maintain a crafted, vibe-coded character over rigid adherence to any single icon vendor.

## Evidence on Hand

- Raw Source Records and Dataset Snapshot metadata from the experimental Product Lookup API
- Open Food Facts Product images and Product-page links when supplied by the Source Record
- Complete and sparse Open Food Facts test fixtures under `backend/tests/fixtures/open_food_facts/`
- A visual and interaction reference in the sibling `life-goods-viewer` repository
- No testimonials, customer claims, verification evidence, pricing claims, or Life Goods-owned Product data

## Product Principles

1. **Source breadth before hierarchy.** First learn which Open Food Facts data is useful; then refine how it is prioritized.
2. **Localization without ownership.** Life Goods translates and redesigns the experience but does not present source data as its own catalog.
3. **Original meaning remains accessible.** Khmer Translation never replaces Original Text and is always identified as machine-generated.
4. **Missing means unknown.** An absent field is Source Data Unavailable, not evidence that a property is absent.
5. **Attribution stays visible.** Every Product page identifies Open Food Facts as the source and links to applicable data and image licensing information.
6. **Lookup works without translation.** A translation failure falls back to Original Text instead of failing the Product page.
7. **Privacy by omission.** Barcode decoding happens on the device, and Life Goods does not build accounts, scan histories, or Barcode-level analytics.

## Accessibility & Inclusion

Khmer support is required before the public MVP. Fluent human review is required for interface terminology, navigation, explanations, disclaimers, and accessibility copy. Complete, sparse, multilingual, irregular, and data-rich Source Records must render intentionally on mobile without broken layouts or accidental raw-field dumps.

## Attribution

Every Product page displays a visible “Data from Open Food Facts” link. A global data-and-licenses notice covers the [Open Food Facts reuse terms](https://world.openfoodfacts.org/data), including the database, database contents, and image licenses.
