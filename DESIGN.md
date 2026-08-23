---
name: LifeGoods
description: Khmer-first packaged-food label guidance with evidence and visible uncertainty.
---

<!-- SEED: re-run $impeccable document once there's code to capture the actual tokens and components. -->

# Design System: LifeGoods

## 1. Overview

**Creative North Star: "The Lotus Lens"**

LifeGoods is a calm mobile lens through which package evidence becomes understandable one layer at a time. Its interface should feel fresh and approachable without performing wellness. Familiar scan, search, result, and navigation patterns disappear into the shopping task; the lotus supplies a distinctive identity at selected moments rather than decorating every surface.

The system is Khmer-first, evidence-forward, and restrained. It gives candidate identity and consequential declared concerns immediate hierarchy, keeps uncertainty nearby, and makes source inspection progressively available. Responsive motion lasts 150–250ms and communicates state or feedback only; reduced-motion alternatives are mandatory and decorative page choreography is prohibited.

The existing LifeGoods Figma file is an evolving structural reference, not a finished specification or exact token source. Its visible inventory includes English and Khmer pages; barcode-entry and camera-scan home states; search; Learn; session history; allergy or preference views; reviewed and external result variants; unknown or no-match states; and recovery concepts. Preserve useful flow ideas while revisiting result hierarchy, card density, bottom navigation, uncertainty prominence, and verdict-like language.

**Key Characteristics:**

- Mobile-first and anonymous by default.
- Friendly enough to guide, rigorous enough to show doubt.
- Khmer-readable with original package languages preserved.
- Neutral surfaces with a restrained lotus identity.
- Progressive evidence disclosure rather than a universal judgment.
- Familiar controls, consistent states, and fast feedback on modest devices.

## 2. Colors

The palette uses neutral, highly legible surfaces and a restrained lotus green whose exact value will be resolved during implementation and contrast testing.

### Primary

- **Lotus Green** (`[to be resolved during implementation]`): Reserved for brand identity, primary actions, current selection, and focus. It must not turn an entire result into positive reassurance.

### Secondary

- **Supporting Accent** (`[to be resolved during implementation]`): A visually distinct accent may support links or source-oriented details only when the role cannot be carried by Lotus Green or a semantic color.

### Neutral

- **Background** (`[to be resolved during implementation]`): A true neutral light background suitable for Cambodian retail environments and mobile screens; avoid cream, paper, or lifestyle-wellness tinting.
- **Surface** (`[to be resolved during implementation]`): A subtle neutral layer for grouped evidence, controls, and temporary panels.
- **Ink** (`[to be resolved during implementation]`): The primary text color, targeting at least 7:1 contrast against the background where practical.
- **Muted Ink** (`[to be resolved during implementation]`): Secondary text that still meets WCAG 2.2 AA and remains readable in Khmer.

### Named Rules

**The Restrained Lotus Rule.** Lotus Green occupies no more than roughly 10% of a typical screen. Its rarity preserves its identity and prevents generic wellness styling.

**The Meaning Before Hue Rule.** Concern, uncertainty, error, success, and source roles are semantically separate. Every state uses text and, where helpful, an icon in addition to color.

**The No Green Reassurance Rule.** Green never means that a Product is safe, healthy, allergen-free, Halal, compliant, authentic, or recommended for purchase.

## 3. Typography

**Display Font:** Warm humanist sans with strong Khmer and Latin support (`[font family to be selected during implementation]`)

**Body Font:** The same warm humanist sans direction (`[font family to be selected during implementation]`)

**Character:** Clear, open, and approachable without becoming playful. A single coherent product-UI voice should carry headings, controls, evidence, and explanatory content across Khmer and English.

### Hierarchy

- **Display:** Reserved for rare product-level moments; never used for dense results or standard navigation.
- **Headline:** Clear screen and result-section titles with enough Khmer line height for stacked glyphs.
- **Title:** Package identity, declared-concern headings, and evidence-group labels.
- **Body:** Primary guidance and explanations, with comfortable Khmer line height and prose limited to approximately 65–75 characters per line where relevant.
- **Label:** Controls, metadata, source state, and timestamps; never compressed into tiny uppercase text or low-contrast gray.

### Named Rules

**The Khmer-First Fit Rule.** Components expand for real Khmer copy. Do not truncate consequential labels, tighten letter spacing to force a fit, or validate layouts with English placeholders alone.

**The Original-Stays-Visible Rule.** Interface locale may change, but original package wording and its language remain accessible beside the Khmer presentation.

## 4. Elevation

LifeGoods is flat by default. Depth comes from neutral tonal layering, spacing, and hierarchy rather than decorative shadows or nested cards. Shadows are reserved for temporary overlays or a control that meaningfully rises above the current task; they never combine with a decorative one-pixel border and wide blur.

### Named Rules

**The Evidence Is the Structure Rule.** Group content by evidence relationship and reading order, not by wrapping every field in another card.

**The Temporary Elevation Rule.** A surface may cast a restrained shadow only while it is temporarily above other content, such as a menu, sheet, or dialog.

## 6. Do's and Don'ts

### Do:

- **Do** keep Khmer labels readable without truncation and test them on representative mobile viewports.
- **Do** present package identity, Critical Declared Concerns, Evidence Uncertainty, Khmer label summary, and source access in that order.
- **Do** reveal source, review status, observation or retrieval time, and uncertainty progressively without hiding them.
- **Do** use the lotus sparingly as an identity and guidance motif.
- **Do** preserve familiar scan, search, result, recovery, and navigation affordances.
- **Do** keep allergy evidence, Halal Ingredient Assessment, Seal Observation, and certificate status visibly separate.
- **Do** keep history session-only, preferences local, and Package Capture visibly private.
- **Do** provide visible focus, 44 by 44 CSS-pixel touch targets, non-color state cues, and reduced-motion alternatives.

### Don't:

- **Don't** use **AG1-style wellness marketing**: promotional green lifestyle branding, purity language, decorative ingredient reassurance, or implied health outcomes.
- **Don't** present universal health scores, purchase verdicts, traffic-light judgments, green-check reassurance, or conclusions that a Product is safe, healthy, allergen-free, Halal, legal, compliant, or authentic.
- **Don't** preserve the rough Figma frame named **"No halal"** as a verdict. Replace it with separate ingredient evidence, Seal Observation, certificate status, and explicit uncertainty.
- **Don't** use a Khmer translation—especially an unreviewed one—as the sole basis of a consequential assessment.
- **Don't** build nested card stacks, identical card grids, decorative gradients, glassmorphism, oversized card rounding, side-stripe accents, or inconsistent component styles.
- **Don't** use decorative motion, orchestrated page-load sequences, bounce, or elastic easing in the product journey.
- **Don't** let missing, stale, conflicting, unreadable, or unreviewed evidence look like a negative finding or a reassuring absence.
