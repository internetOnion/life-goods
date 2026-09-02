---
name: LifeGoods
description: Khmer-first packaged-food label guidance with evidence and visible uncertainty.
colors:
  brand: "#8a4b16"
  brand-dark: "#6e350c"
  brand-hover: "#562908"
  brand-soft: "#f7ede0"
  page: "#fafaf8"
  surface: "#f4f4f5"
  surface-strong: "#e4e4e7"
  ink: "#111111"
  muted-ink: "#66666a"
  line: "#e4e4e7"
  input: "#a1a1aa"
  ring: "#8a4b16"
  destructive: "#b91c1c"
  mango: "#b86a1a"
  mango-soft: "#fcf4e8"
typography:
  display:
    fontFamily: '"Noto Sans Khmer", "Khmer OS System", Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: "1.75rem"
    fontWeight: 900
    lineHeight: 1.7
    letterSpacing: "-0.02em"
  headline:
    fontFamily: '"Noto Sans Khmer", "Khmer OS System", Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: "1.5rem"
    fontWeight: 900
    lineHeight: 1.7
    letterSpacing: "-0.02em"
  title:
    fontFamily: '"Noto Sans Khmer", "Khmer OS System", Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.65
  body:
    fontFamily: '"Noto Sans Khmer", "Khmer OS System", Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: '"Noto Sans Khmer", "Khmer OS System", Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "0.05em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.brand-dark}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "{colors.brand-hover}"
---

# Design System: LifeGoods

## Overview

**Creative North Star: "Open Label"**

LifeGoods is a calm, evidence-forward shopping utility for Cambodian shoppers evaluating sealed packaged foods and beverages. Its central metaphor—Open Label—is represented by layered package-label sheets that reveal underlying label facts while keeping original source evidence in plain view. The design communicates clarity and rigor without adopting the promotional aesthetics of wellness marketing or clinical alarmism.

The visual atmosphere rests on a warm-white paper ground (`#fafaf8`), crisp charcoal black typography (`#111111`), rich palm sugar caramel interaction accents (`#8a4b16`), and golden palm sugar identity accents (`#b86a1a`) reserved for the Open Label mark and scanner action. Depth is established through tonal shifts and crisp one-pixel rules rather than decorative shadow cards. The entire experience is Khmer-first, pairing generous line heights with unclipped script rendering while keeping original package languages (Khmer, English, Vietnamese, Chinese, Thai) intact.

**Key Characteristics:**
- **Evidence Before Reassurance:** Missing fields are explicitly "Unavailable" rather than assumed safe or absent; community data is clearly attributed.
- **Khmer-First Hierarchy:** System sans typography tuned for complex Khmer ascenders and descenders with minimum 1.65 line heights.
- **Flat Paper Aesthetic:** Clean warm-white background, pale functional containers, and crisp 1px borders without heavy skeuomorphic shadows or glassmorphism.
- **Strict Color Semantics:** Palm sugar guides navigation and actions; golden palm sugar identifies brand and scan; crimson signals validation/error; green is never used to imply product health or purchase approval.

## Colors

The LifeGoods palette pairs warm paper neutrals with authentic Cambodian palm sugar (ស្ករត្នោត) interaction and identity accents, supported by crisp black and white foundations.

### Primary (Palm Sugar)
- **Interaction Palm Sugar** (`#8a4b16`): Interactive focus rings, active badges, evidence lines, and secondary action highlights.
- **Pressed Palm Sugar** (`#6e350c`): Primary button fills, active navigation highlights, and interactive links.
- **Palm Sugar Hover** (`#562908`): Hover state for interactive primary actions.
- **Soft Palm Sugar Wash** (`#f7ede0`): Subdued container backgrounds for active tabs, selected icon wells, and focus callouts.

### Secondary (Golden Palm Sugar)
- **Identity & Scan Golden Palm Sugar** (`#b86a1a`): Warm golden accent used exclusively for the Open Label folded corner mark and the prominent mobile Scan button.
- **Soft Golden Palm Sugar Wash** (`#fcf4e8`): Background for the Open Label back sheet and the camera privacy icon container.

### Tertiary
- **Validation Crimson** (`#b91c1c`): Form validation errors and hardware failure notices. Always paired with text labels and explanatory copy.

### Neutral (Black & White Ground)
- **Warm Paper Ground** (`#fafaf8`): Base page background providing a warm, legible ground.
- **Pale Surface** (`#f4f4f5`): Viewfinder inactive areas, disabled containers, and secondary element backing.
- **Quiet Surface Strong** (`#e4e4e7`): Secondary buttons, subtle dividers, and inactive control fills.
- **Charcoal Black Ink** (`#111111`): Primary body text, headings, and prominent icons.
- **Muted Ink** (`#66666a`): Secondary labels, timestamps, and metadata meeting WCAG 2.2 AA contrast standards.
- **Divider Rule** (`#e4e4e7`): One-pixel borders separating content sections and list rows.
- **Input Border** (`#a1a1aa`): Default border for form controls and text fields.

### Named Rules
**The Color Neutrality Rule.** Color never communicates a health rating, safety verdict, allergen absence, or purchase recommendation. Green is never used as an endorsement.
**The Palm Sugar Scarcity Rule.** Golden Palm Sugar (`#b86a1a`) is strictly reserved for the Open Label brand mark and the primary Scan action. It is never used as an indicator of evidence severity or product status.

## Typography

**Display & Headline Font:** `"Noto Sans Khmer", "Khmer OS System", Inter, ui-sans-serif, system-ui, sans-serif`
**Body Font:** `"Noto Sans Khmer", "Khmer OS System", Inter, ui-sans-serif, system-ui, sans-serif`
**Label / Code Font:** `"Noto Sans Khmer", "Khmer OS System", Inter, ui-sans-serif, system-ui, sans-serif`

**Character:** A modern, highly legible system sans pairing that provides native Khmer glyph shaping and reliable cross-platform fallback across iOS, Android, and web.

### Hierarchy
- **Display** (Bold 900, 1.75rem / 28px, line-height 1.7, tracking -0.02em): Major screen titles and result headings.
- **Headline** (Bold 900, 1.5rem / 24px, line-height 1.7, tracking -0.02em): Feature section headers and dialog titles.
- **Title** (Bold 700, 1.125rem / 18px, line-height 1.65): Card titles, group labels, and modal headings.
- **Body** (Regular 400, 1rem / 16px, line-height 1.65): Primary readable text, evidence descriptions, and transcriptions (bounded to 65–75 characters per line on desktop).
- **Label** (Bold 700, 0.75rem / 12px, line-height 1.35, tracking 0.05em): Uppercase metadata tags, category badges, and navigation labels.

### Named Rules
**The Khmer Line-Height Rule.** Khmer text requires a minimum line height of 1.65 for body and 1.7 for headings to avoid clipping subscript consonants and diacritics.
**The No-Truncation Rule.** Consequential product names, ingredient declarations, provenance notes, and uncertainty statements must wrap fully rather than truncate with ellipsis.

## Layout

LifeGoods uses a mobile-first responsive architecture designed for one-handed store usage while scaling cleanly to tablets and desktops.

- **Content Bounding:** Mobile layouts stretch to full viewport width with standard padding (`16px` to `24px`). Desktop views bound the reading column to `48rem` (768px) centered on screen, or expand with a dedicated left navigation rail on wide displays (`lg` breakpoint ≥ 1024px).
- **Header Structure:** Home features a top utility header containing the `<BrandLockup />` on the left and a 44px circular language switch with country flag icons (Cambodia / United Kingdom) on the right.
- **Navigation Model:**
  - **Mobile:** Fixed bottom navigation bar with 5 destinations: History, Learn, Scan (centered, elevated mango circular button), Search, Concerns.
  - **Desktop:** Fixed left rail (`28` width / 112px) with the compact BrandLockup at top and 5 vertically stacked navigation links.
  - **Focused Result Routes:** Hide the primary navigation to maximize vertical reading area and expose a prominent `<ResultBackButton />`.
- **Touch Targets:** All interactive controls maintain a strict minimum bounding box of 44×44 CSS pixels.

## Elevation & Depth

Surfaces are flat by default. Visual hierarchy is established through contrasting background tones (`#fafaf7` vs `#f2f4f6`), crisp one-pixel border lines (`#d9dde2`), and whitespace.

### Shadow Vocabulary
- **Scan Button Elevation** (`box-shadow: 0 5px 18px rgba(23,24,26,0.18)`): Used exclusively on the mobile bottom navigation's central elevated Scan button to emphasize its primary action role.
- **Camera Scrim** (`box-shadow: 0 0 0 999px rgba(0,0,0,0.5)`): Functional scan-frame mask focusing attention on the viewfinder area.
- **Dropdown / Overlay** (`box-shadow: 0 4px 16px rgba(0,0,0,0.08)`): Used for context sheets and floating menus.

### Named Rules
**The Flat-By-Default Rule.** Content containers, evidence panels, and search results rest flush against the page ground. Depth is communicated via 1px border rules and subtle surface fills rather than card drop shadows.

## Shapes

The geometric vocabulary balances clean rounded rectangles with precise structural lines.

- **Controls & Buttons:** 12px (`rounded-xl`) for primary buttons and inputs; 9999px (`rounded-full`) for circular action buttons, chips, and language toggles.
- **Containers & Viewfinder:** 16px to 24px (`rounded-2xl` to `rounded-3xl`) for camera viewports, permission cards, and modal sheets.
- **Borders:** Consistent 1px solid stroke (`#e4e4e7`) on cards, inputs, and dividers.
- **Open Label Motif:** Layered geometric label sheets with a 4px corner radius and a 45-degree folded golden palm sugar top-right flap.

## Components

### Buttons
- **Primary Action:** Solid background (`#6e350c`), white text, 12px radius, min 44px height, bold font. Hover shifts to `#562908`.
- **Outline / Secondary:** 1px border (`#e4e4e7`), background `#fafaf8`, foreground `#111111`. Hover shifts to `#f4f4f5`.
- **Scan Action:** Circular 52×52px golden palm sugar button (`#b86a1a`) with dark icon and 4px page-colored boundary ring on mobile navigation.

### Open Label Brand Lockup
- **Mark:** Custom SVG depicting two offset label sheets with folded golden palm sugar corner and palm sugar evidence lines.
- **Typography:** Uppercase "OPEN LABEL" tracker tag in `#6e350c` paired with bold "LifeGoods" wordmark in `#111111`.

### Camera Scanner & Privacy Consent Card
- **Consent State:** Displayed before camera access. Features a soft golden palm sugar lock icon container, clear explanation of on-device processing and 24-hour retention policy, and an explicit "Start scanning" button.
- **Active Viewfinder:** Full-bleed video feed with responsive aspect ratio, dark gradient overlay, pause button, and camera rotate button.
- **Search Escape Hatch:** Prominent full-width button below the viewfinder providing an immediate transition to text and barcode search.

### Search Field & Results
- **Search Input:** 56px height, 16px radius, clear button, magnifier icon, active focus ring in `#8a4b16`.
- **Result Row:** 2-column layout with 76×96px package image preview, product name, quantity, origin, and unreviewed status notice.

### Navigation
- **5-Tab Navigation:** History (`ClockCounterClockwiseIcon`), Learn (`BookOpenTextIcon`), Scan (`ScanIcon`), Search (`MagnifyingGlassIcon`), Concerns (`ListChecksIcon`).
- **Active State:** Tinted icon well (`#f7ede0`) and bold label; Scan button uses golden palm sugar circle (`#b86a1a`).

## Do's and Don'ts

### Do:
- **Do** preserve field-level provenance, source attribution, and original language text alongside Khmer translations.
- **Do** explicitly mark missing or unreviewed data as "Unavailable from Open Food Facts" rather than "None".
- **Do** keep touch targets at or above 44×44 CSS pixels across all viewports.
- **Do** test layouts with real multi-line Khmer script to ensure line heights and wrapping behave cleanly.
- **Do** provide immediate fallback to manual search on camera hesitation or permission refusal.

### Don't:
- **Don't** use green, traffic-light badges, or checkmarks to imply that a product is safe, healthy, or approved.
- **Don't** use health scores, wellness purity marketing, or universal product ratings.
- **Don't** collapse incomplete, missing, or contradictory evidence into a reassuring negative finding.
- **Don't** apply heavy drop shadows, card stacking, glassmorphism, or gradient backgrounds.
- **Don't** truncate product names, ingredients, or uncertainty disclosures.
