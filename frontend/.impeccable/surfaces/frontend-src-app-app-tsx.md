---
version: 1
slug: "frontend-src-app-app-tsx"
primary_target: "frontend/src/app/App.tsx"
related_targets:
    [
        "frontend/src/features/scan/ScanPage.tsx",
        "frontend/src/features/search/BarcodeEntryPage.tsx",
        "frontend/src/features/product/ProductPage.tsx",
        "frontend/src/features/data-and-licenses/DataAndLicensesPage.tsx",
    ]
---

# Surface Brief: Core Shopper Journey (/, /search, /products/:barcode, /data-and-licenses)

## Scope and mode

- Mode: Operate. The Shopper completes one task: turn a physical Barcode into attributed source information.
- Surfaces: Scan (home), Barcode entry, Product reading page, Data and licenses.

## Audience, job, actions, proof, constraints

- Audience: a Shopper holding one packaged Product, possibly with a Khmer-first reading context (prototype copy is English; Khmer text must render correctly wherever the source supplies it).
- Job: scan or type a Barcode, recognize the Product, read what Open Food Facts actually recorded.
- Actions: start/pause/switch the camera, type a Barcode, follow section anchors, open source links.
- Proof: visible attribution, Original Text with language tags, mono identifiers, exact `Source Data Unavailable` for absent values.
- Constraints: PRODUCT.md boundaries are binding. No verification, inference, safety/Halal/allergen verdicts, or reassuring missing-data claims. Camera frames decode on-device; only the Barcode reaches the backend. No Barcode-level or Shopper-level analytics.

## Direction and memorable moment

- Shared main navigation: floating glass capsule across all routes where navigation is visible, with Learn/Scan/Compare/Concerns labels, amber selected pills, safe-area spacing, and reserved content clearance. Search and active Compare continue to hide it. Compare Products is a primary navigation destination rather than a Scan-page entry.
- Glass controls rollout: Compare Products action controls only; other pages retain existing buttons. White reading sheets and form fields remain opaque. Use opt-in shared material styles, 44px targets, opaque fallbacks, reduced motion, and no nested backdrop blur.

- Direction: "The Source Reader" — narrow white source sheets on slate canvas, amber action, blue attribution, mono machine values (see DESIGN.md).
- Memorable moment: the dark privacy-explicit scanner aperture; the privacy promise is the first thing the camera surface says.

## Unresolved decisions

- Khmer-language UI copy is deferred to a later localization pass; the type system and layout are already Khmer-ready.
- Product page section order is Overview → Assessments → Ingredients → Nutrition → Packaging → Source; revisit only if Shopper research says otherwise.
