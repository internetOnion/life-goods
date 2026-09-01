# Life Goods

Life Goods is a Khmer-first product-information experience for people shopping in Cambodia. It makes Open Food Facts data easier to access and understand without creating a separate food catalog or verification system.

## Audience

The first audience is Khmer-speaking people using a mobile phone while shopping in Cambodia. The product remains accessible elsewhere, but Cambodia determines the initial language, device, connectivity, and usability priorities.

## Purpose

A shopper scans a packaged-food barcode and receives a readable presentation of the available Open Food Facts record. Search is a fallback when scanning is unavailable or unsuccessful.

Life Goods initially presents the breadth of consumer-facing data available on Open Food Facts, including product identity, images, ingredients, nutrition, Source Assessments, environmental and packaging information, other product details, and source history. The information hierarchy will be refined after representative records have been explored in the interface.

## Product sequence

1. **Backend exploration:** expose a raw Source Record from the static local Dataset Snapshot through an experimental Life Goods API.
2. **English prototype:** build and refine a mobile information architecture against complete, sparse, multilingual, and irregular Source Records.
3. **Contract refinement:** replace the exploratory payload with a stable product-page contract. Search may proceed in parallel when it can reuse stable lookup foundations.
4. **Khmer public MVP:** localize the interface, add on-demand Khmer Translation with Original Text available per field, and complete fluent-human review of interface terminology and explanations.

English is a development milestone, not the final product identity. Khmer support is required before the public MVP.

## Product principles

1. **Source breadth before hierarchy.** First learn which Open Food Facts data is useful; then refine how it is prioritized.
2. **Localization without ownership.** Life Goods translates and redesigns the experience but does not present source data as its own catalog.
3. **Original meaning remains accessible.** Khmer Translation never replaces Original Text and is always identified as machine-generated.
4. **Missing means unknown.** An absent field is Source Data Unavailable, not evidence that a property is absent.
5. **Attribution stays visible.** Every Product page identifies Open Food Facts as the source and links to applicable data and image licensing information.
6. **Lookup works without translation.** A translation failure falls back to Original Text instead of failing the Product page.
7. **Privacy by omission.** Barcode decoding happens on the device. The backend receives only the Barcode and does not build accounts, scan histories, or barcode-level analytics.

## Source and interpretation boundary

Life Goods may display Open Food Facts Source Assessments such as Nutri-Score, NOVA, Green-Score, and nutrient-level classifications. These remain explicitly attributed Open Food Facts calculations; Life Goods does not verify or adopt them as its own judgments.

Life Goods does not declare a Product healthy, safe, allergen-free, Halal, authentic, legally compliant, or suitable for purchase. It does not infer a reassuring conclusion from missing or incomplete source data.

## MVP constraints

- Mobile-first progressive web application
- Anonymous use with no accounts or server-side history
- On-device Barcode decoding; no camera frame or package-photo upload
- One static, locally hosted Open Food Facts Dataset Snapshot
- Read-only product experience with no contributions, corrections, or moderation
- On-demand Khmer Translation after the English prototype is refined
- Original Text available per translated field
- Human Khmer review for interface language, navigation, explanations, disclaimers, and accessibility copy
- Privacy-preserving aggregate metrics only: lookup volume, found rate, latency, cache performance, and errors

## Not in the MVP

- A Life Goods-owned Product catalog
- User contributions or Open Food Facts editing
- Product, package, claim, or source verification
- Package-photo capture, OCR, or image retention
- Accounts, saved Products, persistent scan history, or personalization
- Safety, health, dietary, certification, authenticity, legal, or purchase verdicts
- Live Open Food Facts API fallback
- Automatic Dataset Snapshot updates
- A required relational database

## Attribution

Every Product page will display a visible “Data from Open Food Facts” link. A global data-and-licenses notice will cover the [Open Food Facts reuse terms](https://world.openfoodfacts.org/data), including the database, database contents, and image licenses.
