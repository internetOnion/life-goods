---
version: 1
slug: "frontend-src-features-package-match-homepage-tsx"
primary_target: "frontend/src/features/package-match/HomePage.tsx"
related_targets:
    [
        "frontend/src/features/package-match/OpenFoodFactsResult.tsx",
        "frontend/src/features/package-match/EvidenceSnapshot.tsx",
        "frontend/src/features/package-match/PackageMatchResultPage.tsx",
        "frontend/src/features/search/SearchPage.tsx",
        "frontend/src/features/learn/LearnPage.tsx",
        "frontend/src/features/allergies/AllergiesPage.tsx",
        "frontend/src/features/history/HistoryPage.tsx",
        "frontend/src/ui/AppShell.tsx",
        "frontend/src/ui/OpenLabelMark.tsx",
        "frontend/src/ui/ContextualSheet.tsx",
    ]
---

# Open Label whole-app redesign

- Mode: Operate. Scope: all shopper-facing routes; Home/Scan is the primary surface.
- Audience/job: Khmer-first shopper using a phone in a Cambodian store; scan or search a sealed package and understand declared evidence, uncertainty, and source without a score or verdict.
- Chosen direction: Yuka-like image-led speed plus Apple Health-like neutral evidence and privacy discipline. LifeGoods name stays; the coconut identity is replaced by the Open Label mark.
- Approved composition: `.impeccable/mocks/open-label-scan-a.png`. Carry forward the identity-led header, dominant camera permission surface, one Search escape hatch, and five-tab navigation. Do not literalize generated English copy, device proportions, or the comp's oversized controls.
- Memorable moment: two offset label sheets resolve into one readable mark while the camera aperture opens; motion is a single state transition, not decoration.
- Constraints: Khmer-first, WCAG 2.2 AA, 44px targets, product evidence never uses a red/green judgment, missing evidence remains unknown, and all package/source privacy boundaries remain intact.

## Composition and implementation inventory

| Visible ingredient        | Commitment                                                                     | Medium                                  |
| ------------------------- | ------------------------------------------------------------------------------ | --------------------------------------- |
| Open Label identity       | Two offset label sheets, one mango leaf/fold, bold LifeGoods wordmark          | Semantic SVG + text                     |
| Scan header               | Compact identity left, 44px language action right                              | HTML/CSS/SVG                            |
| Camera permission surface | Dominant field, precise corner brackets, privacy statement, one primary action | HTML/CSS/video/SVG                      |
| Search escape hatch       | One full-width row below camera with search + barcode cues                     | React Router link + icons               |
| Five-tab navigation       | History, Learn, Scan, Search, Concerns; Scan centered and dominant             | HTML/CSS/Phosphor icons                 |
| Product result hero       | Large real package image beside name, brand, quantity, identifier              | Existing sourced raster + semantic HTML |
| Evidence snapshot         | Three neutral rows: declared concerns, evidence gaps, source/review            | Semantic definition list + icons        |
| Evidence detail           | Full-width sections with one-pixel dividers and source disclosures             | Semantic HTML/details                   |
| Desktop adaptation        | Left navigation rail; two-column result layout                                 | Responsive CSS                          |

## Sampled palette contract

- Ground `#FAFAF7`; surface `#F2F4F6`; ink `#17181A`; muted ink `#6F747B`; rule `#D9DDE2`.
- Interaction indigo `#3658D4`, pressed indigo `#2945AA`, soft indigo `#EDF0FF`.
- Identity/Scan mango `#F2B84B`; never used as package evidence severity.
- Operational error `#A33A3A`; never used as a Product judgment.

## Component grammar

- Bold fixed-size sans hierarchy with Khmer-safe line height; no fluid display scaling.
- Flat warm paper, one-pixel rules, 12–16px control/media radii, no nested cards, no gradients or glass.
- Product photography provides most content color. Brand color marks actions/current location only.
- Mobile bottom navigation becomes a compact left rail at desktop widths.
