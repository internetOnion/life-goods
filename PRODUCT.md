# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

LifeGoods primarily serves Khmer-speaking shoppers evaluating sealed packaged food or non-alcoholic beverages before purchase in Cambodia. The primary shopper uses a mobile phone in a store or market, may be under time pressure, may have an inconsistent connection, and should not need an account or technical knowledge.

Allergy-conscious and Halal-conscious shoppers share this journey. They need declared concerns, incomplete evidence, ingredient-source ambiguity, Seal Observation, and certificate status kept visibly separate. Optional preference profiles may prioritize relevant guidance but must never hide other critical concerns or uncertainty.

## Product Purpose

LifeGoods helps a shopper scan a barcode or photograph a package and receive Khmer-first Shopper Guidance grounded in readable label evidence. It prioritizes candidate package identity, Critical Declared Concerns, Evidence Uncertainty, a Khmer label summary, and inspectable source evidence.

Success means shoppers can understand what the package declares, what the evidence supports, and what remains uncertain without mistaking the interface for a purchase recommendation. LifeGoods never declares a Product safe, healthy, allergen-free, Halal, legally compliant, or authentic.

## Positioning

LifeGoods is an evidence-scoped package-label guide for Cambodian shoppers. Its distinguishing mechanism is to keep original package evidence, Khmer explanation, provenance, review state, and uncertainty visibly connected instead of compressing them into a universal score or verdict.

Open Food Facts and other external records remain attributed external evidence. Internally reviewed Claims remain distinguishable from community data, and a barcode or reference image produces a Package Match candidate rather than proof that the shopper holds the same Package Revision.

## Operating Context

- The primary journey occurs on a mobile device while a shopper is handling a physical package in a Cambodian store or market.
- The online MVP is delivered as a responsive Web Client and Telegram Mini App; offline operation is deferred.
- A shopper may scan a barcode, enter an identifier manually, search the catalog, or use private Package Capture when current label evidence is missing.
- Package Capture media remains private to the active session, is retained only for processing and encrypted retry or recovery for at most 24 hours, and never becomes catalog or training data.
- Original package languages remain available alongside Khmer presentation. Relevant source languages include Khmer, English, Vietnamese, Simplified Chinese, and Thai.

## Capabilities and Constraints

- The MVP supports sealed retail packaged foods and non-alcoholic packaged beverages offered for sale in Cambodia.
- Alcohol, supplements, infant formula and specialized nutrition, medicines, restaurant or fresh food, and unlabeled products are outside the MVP boundary.
- Product identity, label facts, translations, assessments, and source evidence remain separate layers with field-level provenance.
- Missing, stale, conflicting, unreadable, external-only, or unreviewed evidence must remain explicit and must not become a negative Claim or reassuring absence.
- Allergen, Halal Ingredient, additive, date, Seal Observation, certificate, compliance, and authenticity concepts remain semantically separate.
- The product must not provide universal health scores, traffic-light purchase judgments, automatic green-check reassurance, or safety, health, allergen-free, Halal, legal, compliance, authenticity, or purchase verdicts.
- No shopper account is required. Preferences remain local, scan history remains session-only, and analytics exclude raw photos, precise location, dietary preferences, and persistent identity.

## Brand Commitments

LifeGoods is calm, credible, practical, fresh, approachable, and food-forward. It behaves like a friendly guide: concise during the shopping task, explanatory when asked, and precise whenever evidence is incomplete or consequential.

The coconut is the primary LifeGoods identity motif and replaces the lotus in future brand and interface work. It represents approachable food context, guidance, and information becoming understandable—not purity, safety, certification, healthfulness, or a favorable Product judgment. Green is the primary brand color, but green must never independently communicate that a Product is safe, healthy, acceptable, certified, or recommended.

“Healthy” describes the desired fresh and energetic character of the experience only. It does not authorize health claims, product scoring, “Excellent” or “Bad” labels, positive-versus-negative nutrition verdicts, or decorative reassurance.

The supplied mobile references are binding tonal and structural inspiration for a direct, image-led, highly legible shopping utility. They are not templates to copy, and their scoring systems, verdict language, color-coded judgments, branding, and product conclusions are excluded from LifeGoods.

LifeGoods must not resemble promotional wellness marketing built around purity language, aspirational health outcomes, or imagery that makes weak evidence feel conclusive.

## Evidence on Hand

- The repository specifications, domain glossary, data model, ADRs, user stories, and research documents are the authoritative evidence for product behavior and terminology.
- The existing Figma concept remains an evolving structural reference rather than an exact visual specification.
- The following user-supplied mobile screenshots are visual references for future design work:
  - `C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-b8c7f600-c459-463b-a1ca-51c2a1465aa0.png`
  - `C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-44a48a6d-ee36-4c00-aaf6-ba04d8d9a169.png`
  - `C:/Users/Lenovo/AppData/Local/Temp/codex-clipboard-99d064af-cbc5-4be2-91ad-a74e997ae465.png`
- No final coconut artwork, detailed palette, type system, or component language has been approved. Those remain decisions for subsequent visual-world and implementation work.

## Product Principles

1. **Evidence before reassurance.** Show what was declared, where it came from, how it was reviewed, and what remains unknown before offering interpretation.
2. **Khmer comprehension before information density.** Make consequential Khmer wording readable and scannable while preserving original package languages and source meaning.
3. **Scan first; disclose detail progressively.** Keep the primary mobile journey focused, then reveal source inspection and Learn More content without taking the shopper out of context.
4. **Fresh utility without health theatre.** Use the coconut identity and food-forward character to make the product approachable without turning visual freshness into a health or purchase claim.
5. **Uncertainty stays prominent and actionable.** Missing, stale, conflicting, unreadable, or unreviewed evidence must never disappear behind a confident treatment; pair it with the appropriate recovery action.

## Accessibility & Inclusion

Target WCAG 2.2 AA and test the complete primary journey in Khmer as well as English. Use touch targets of at least 44 by 44 CSS pixels, visible keyboard focus, sufficient text and non-text contrast, and meaning that never depends on color alone.

Khmer readability requires generous line height, tested glyph rendering, layouts that tolerate longer labels without truncation, and validation on representative low- and mid-range Android devices, Telegram WebView, and supported iOS Safari devices. Motion must respect reduced-motion preferences, and the online MVP must explain connectivity, camera, and device failures without stranding the shopper.
