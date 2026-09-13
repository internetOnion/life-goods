---
name: Life Goods
description: "The Source Reader: calm Barcode-to-attributed-source understanding."
colors:
    amber-mark: "#b86a1a"
    amber-action: "#995613"
    amber-action-deep: "#7b440d"
    amber-ink: "#5a320b"
    amber-soft: "#f3e8dd"
    blue-attribution: "#315072"
    blue-soft: "#e3e8ee"
    slate-canvas: "#f3f5f6"
    white-sheet: "#ffffff"
    slate-ink: "#131519"
    slate-strong: "#303843"
    slate-body: "#404c5b"
    slate-muted: "#526073"
    slate-border: "#c6cfdd"
    slate-soft: "#e3e7ed"
    destructive: "#b03232"
    destructive-soft: "#f7f2f2"
typography:
    display:
        fontFamily: "Plus Jakarta Sans, Noto Sans Khmer, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        fontSize: "clamp(1.75rem, 7vw, 2.5rem)"
        fontWeight: 800
        lineHeight: 1.12
        letterSpacing: "-0.035em"
    headline:
        fontFamily: "Plus Jakarta Sans, Noto Sans Khmer, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        fontSize: "1.5rem"
        fontWeight: 800
        lineHeight: 1.25
        letterSpacing: "-0.02em"
    title:
        fontFamily: "Plus Jakarta Sans, Noto Sans Khmer, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        fontSize: "1.25rem"
        fontWeight: 800
        lineHeight: 1.25
        letterSpacing: "-0.02em"
    body:
        fontFamily: "Plus Jakarta Sans, Noto Sans Khmer, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        fontSize: "1rem"
        fontWeight: 400
        lineHeight: 1.6
        letterSpacing: "normal"
    label:
        fontFamily: "Plus Jakarta Sans, Noto Sans Khmer, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        fontSize: "0.875rem"
        fontWeight: 800
        lineHeight: 1.5
        letterSpacing: "normal"
    identifier:
        fontFamily: "JetBrains Mono, ui-monospace, SF Mono, Cascadia Code, Segoe UI Mono, monospace"
        fontSize: "0.875rem"
        fontWeight: 400
        lineHeight: 1.5
        letterSpacing: "0.04em"
rounded:
    focus: "0.5rem"
    control: "0.75rem"
    surface: "1rem"
    aperture: "1.5rem"
    pill: "9999px"
spacing:
    xs: "0.5rem"
    sm: "0.75rem"
    md: "1rem"
    lg: "1.25rem"
    xl: "1.5rem"
    section: "2.5rem"
components:
    glass-navigation:
        backgroundColor: "rgba(255, 255, 255, 0.88)"
        rounded: "{rounded.pill}"
        padding: "0.25rem"
        height: "60px"
    button-glass-primary:
        backgroundColor: "rgba(123, 68, 13, 0.96)"
        textColor: "{colors.white-sheet}"
        rounded: "{rounded.pill}"
        height: "44px"
    button-glass-neutral:
        backgroundColor: "rgba(255, 255, 255, 0.88)"
        textColor: "{colors.slate-strong}"
        rounded: "{rounded.pill}"
        height: "44px"
    button-primary:
        backgroundColor: "{colors.amber-action}"
        textColor: "{colors.white-sheet}"
        typography: "{typography.label}"
        rounded: "{rounded.control}"
        padding: "0.5rem 1rem"
        height: "44px"
    button-primary-hover:
        backgroundColor: "{colors.amber-action-deep}"
        textColor: "{colors.white-sheet}"
    button-outline:
        backgroundColor: "{colors.white-sheet}"
        textColor: "{colors.slate-ink}"
        typography: "{typography.label}"
        rounded: "{rounded.control}"
        padding: "0.5rem 1rem"
        height: "44px"
    button-ghost:
        backgroundColor: "transparent"
        textColor: "{colors.slate-muted}"
        typography: "{typography.label}"
        rounded: "{rounded.control}"
        padding: "0.5rem 1rem"
        height: "44px"
    input-barcode:
        backgroundColor: "{colors.white-sheet}"
        textColor: "{colors.slate-ink}"
        typography: "{typography.identifier}"
        rounded: "{rounded.control}"
        padding: "0.5rem 0.875rem"
        height: "48px"
    nav-active:
        backgroundColor: "{colors.amber-soft}"
        textColor: "{colors.amber-ink}"
        typography: "{typography.label}"
        rounded: "{rounded.control}"
        padding: "0.625rem"
        height: "44px"
    chip-neutral:
        backgroundColor: "{colors.slate-soft}"
        textColor: "{colors.slate-body}"
        rounded: "{rounded.pill}"
        padding: "0.25rem 0.75rem"
    source-sheet:
        backgroundColor: "{colors.white-sheet}"
        textColor: "{colors.slate-ink}"
        padding: "1.25rem"
    camera-aperture:
        backgroundColor: "{colors.slate-ink}"
        textColor: "{colors.white-sheet}"
        rounded: "{rounded.aperture}"
        padding: "1.5rem"
---

# Design System: Life Goods

## Overview

**Creative North Star: "The Source Reader"**

Life Goods is a calm, grounded reading tool for attributed source data, not a verdict dashboard. A cool slate canvas holds narrow white sheets of Open Food Facts information; amber exists only to move the Shopper forward, and blue exists only to name the source. Density is generous but ordered: one 36rem reading rail, dividers instead of boxes, monospaced identifiers wherever a machine value appears. The dark scanner aperture is the single moment of high drama, and it exists to make a privacy promise before it asks for the camera.

The interface is compact, mobile-first, and privacy-forward. It moves from one physical Barcode to Product identity and progressively disclosed Open Food Facts information without expanding into a lifestyle-app shell. Missing source data is never decorated, softened, or inferred: it reads exactly `Source Data Unavailable` — the interface's most important sentence.

**Key Characteristics:**

- Narrow, one-handed reading column on a cool slate canvas
- White source sheets carry the content; the canvas is only a field
- Amber action and blue Source Attribution
- Dark camera glass separated from reading surfaces
- Compact rounded controls and mono identifiers
- Dividers and disclosure instead of dashboard tiles

## Colors

The palette separates Life Goods action, external-source attribution, reading surfaces, and scanner material by role.

### Primary

- **Warm Amber Mark** (`colors.amber-mark`, #B86A1A): the brighter action used against dark camera glass, the scan laser, and section icon emphasis.
- **Grounded Amber Action** (`colors.amber-action`, #995613): primary controls, focus accents, and section icon tiles.
- **Deep Amber Action** (`colors.amber-action-deep`, #7B440D): hover and active states.
- **Amber Ink** (`colors.amber-ink`, #5A320B): high-contrast text on pale amber active navigation and action tiles.
- **Pale Amber Wash** (`colors.amber-soft`, #F3E8DD): active navigation, action tiles, and warm explanatory surfaces.

### Secondary

- **Attribution Blue** (`colors.blue-attribution`, #315072): Open Food Facts links, source context, and licensing actions.
- **Source Blue Wash** (`colors.blue-soft`, #E3E8EE): source and licensing icon fields where attribution needs a quiet background.

### Neutral

- **Cool Slate Canvas** (`colors.slate-canvas`, #F3F5F6): the application background and info-50 wash.
- **White Source Sheet** (`colors.white-sheet`, #FFFFFF): Product identity, the Product reading sheet, header, footer, fields, and outline controls.
- **Camera Ink** (`colors.slate-ink`, #131519): primary text and the scanner aperture — the shared value that makes the aperture feel native.
- **Raised Camera Slate** (`colors.slate-strong`, #303843): camera-state icon wells and dark secondary camera controls.
- **Body Slate** (`colors.slate-body`, #404C5B): source rows, neutral tags, and supporting text.
- **Muted Slate** (`colors.slate-muted`, #526073): supporting copy, metadata, and inactive navigation.
- **Slate Divider** (`colors.slate-border`, #C6CFDD): field strokes, section dividers, and table rules.
- **Soft Slate** (`colors.slate-soft`, #E3E7ED): chips, skeletons, and quiet hover fills.
- **Destructive Red** (`colors.destructive`, #B03232): error text; **Destructive Wash** (`colors.destructive-soft`, #F7F2F2): error containers without alarm-heavy saturation.

### Named Rules

**The White Sheet Rule.** Source data is read on white. The slate canvas is a field, never a data surface.

**The One Amber Rule.** Amber marks the action a Shopper can take next — primary buttons, section icons, the laser. Never body text, never decoration.

**The Blue Names the Source Rule.** Blue is reserved for Source Attribution, source context, and licensing links so external information never reads as a Life Goods claim.

**The Exact Absence Rule.** Missing source values render exactly `Source Data Unavailable`. No synonyms, no "none", no inference.

## Typography

**Display Font:** Plus Jakarta Sans (with Noto Sans Khmer and system sans-serif fallbacks)  
**Body Font:** Plus Jakarta Sans (with Noto Sans Khmer and system sans-serif fallbacks)  
**Label/Mono Font:** JetBrains Mono (with platform monospace fallbacks)

**Character:** Plus Jakarta Sans provides a compact, clear, contemporary reading voice with heavy headings rather than editorial ornament. Noto Sans Khmer is part of the primary stack, and JetBrains Mono makes Barcodes and measured values visibly machine-readable.

### Hierarchy

- **Display** (800, `clamp(1.75rem, 7vw, 2.5rem)`, 1.12, −0.035em): Product names and primary page headings; tightly tracked and allowed to wrap.
- **Headline** (800, `1.5rem`, 1.25): major content sections and privacy-critical scanner messages.
- **Title** (800, `1.25rem`, 1.25): section titles and compact state headings.
- **Body** (400–600, `1rem`, 1.6–1.75): source descriptions, Original Text, and explanations; always `wrap-anywhere`, never truncated.
- **Label** (700–800, `0.75–0.875rem`, uppercase for field labels, 0.06–0.08em): field names, Original Text language tags, navigation.
- **Identifier** (400, `0.875rem`, `0.04em`, tabular numerals): Barcodes, nutrition amounts, timestamps.

### Named Rules

**The Machine Value Rule.** Set Barcodes and numeric source values in the mono stack with tabular numerals; keep names and explanations in the sans stack.

**The Khmer Is Native Rule.** Noto Sans Khmer is a first-line script fallback, with normal letter spacing and relaxed heading line-height for Khmer text.

## Layout

One centered reading rail: maximum `36rem`, `1rem` mobile gutters widening to `1.5rem` at `sm`. Minimum viewport width is 320px; every layout must survive it. The sticky header is `4rem` high, and the Product section rail pins immediately beneath it. Product sections stack inside one white sheet separated by hairlines with `2.5rem` vertical padding. Detail rows use a `10rem` label column only when space supports it; nutrition reads as a labelled stacked list on phones and a right-aligned table from `sm`, with columns derived from supplied data only. Space above a heading is always larger than the space below it. Compare Products uses a two-step Product A → Product B capture control with `0.75rem` top and bottom separation on mobile, widening to `1rem` at `sm`; the current step carries amber emphasis and each step remains a 44px touch target. Comparison results render on their own page, led by Product identities and the comparison basis, with a clear return to edit either Product.

## Elevation & Depth

Flat by default; tonal layering and borders come before shadow. Source sheets and the scanner aperture retain their established elevation. Floating navigation and opt-in glass controls use a soft material lift with a restrained inset highlight.

### Shadow Vocabulary

- **Action Lift** (`0 8px 20px -14px rgba(90, 50, 11, 0.8)`): primary amber buttons.
- **Source Sheet Lift** (`0 14px 38px -28px rgba(19, 21, 25, 0.55)` / `0.42` on the body sheet): Product identity and reading sheets.
- **Camera Aperture Lift** (`0 16px 40px -24px rgba(19, 21, 25, 0.8)`): the scanner aperture only.

### Named Rules

**The Felt Shadow Rule.** If a shadow's edge is visible, it is too strong. Sheets separate by contrast, not by drop.

## Shapes

Ordinary controls and alerts use compact `0.75rem` corners. Glass action controls and floating navigation use full pills. Icon wells, image fields, source callouts, and action tiles use `1rem`. The scanner aperture uses `1.5rem`. Borders are quiet one-pixel slate rules; long Product information stays in open divider rows. Focus is a 2–3px amber ring with offset.

## Iconography & Illustration

Iconography and illustration in Life Goods serve as quiet, rapid visual anchors for the Shopper. They guide one-handed mobile reading and clarify physical food attributes without becoming decorative clutter or introducing misleading metaphors.

### Library Freedom & Selection

Life Goods is **not** dogmatically restricted to Phosphor Icons (`@phosphor-icons/react`). Teams and agents may draw from any high-quality icon set (such as Phosphor, Lucide, Tabler, Radix) or build bespoke SVG components, provided every visual meets the semantic and aesthetic standards below.

### Semantic Fidelity First

Every icon and illustration must directly and truthfully represent the exact real-world concept, food component, data state, or action it depicts.

- **Never substitute an unrelated symbol** due to library limitations (for example, never use a coffee bean for soybean, a carrot for celery, a 3x3 app-launcher grid for sesame, a generic tree for tree nuts, a hardware hex nut for peanuts, or an abstract hypnotic swirl for mollusks).
- **No misplaced metaphors**: Never use commercial or transaction iconography (such as cashier receipts or shopping carts) for read-only Product information or nutrition tables.
- **Accurate representation**: When representing allergens, ingredients, or food categories, the graphic must reflect the recognizable botanical, culinary, or biological structure of the item. When a standard icon library lacks an accurate symbol, implement a bespoke, semantically faithful vector SVG.

### Vibe-Coded & Non-Generic Aesthetic

Visuals must never feel generic, bland, sterile, or like off-the-shelf corporate template art. Every icon and illustration must feel **vibe-coded**—deliberately crafted, tactile, and harmonious with the "Source Reader" visual identity:

- **Stroke & Geometry:** Optical line-weights should sit consistently between 1.5px and 2px (or bold/heavy equivalents when matching display typography), featuring rounded endpoints and soft joins that mirror the `0.75rem` / `1rem` corner radiuses of the interface.
- **Color Roles:** Icons inherit deliberate semantic color roles:
    - _Warm Amber_ (`amber-mark` / `amber-action`) for forward Shopper actions, camera viewfinder laser/brackets, and primary section emphasis.
    - _Attribution Blue_ (`blue-attribution` / `blue-soft`) for Open Food Facts provenance and licensing iconography.
    - _Body Slate_ (`slate-body` / `slate-muted`) for neutral metadata, dietary attributes, and quiet secondary indicators.
    - _Error Red_ (`destructive`) strictly for validation and hardware failures.
- **Tactile Wells:** Section and category icons sit inside quiet `1rem` rounded wells (`bg-primary-100 text-primary-700` or `bg-neutral-100 text-neutral-700`) rather than floating unanchored.

### Purposeful Illustrations

Illustrations (for empty states, educational guides, camera consent, and missing-data notices) must be purposeful, minimal, and grounded in physical packaged goods, camera apertures, barcodes, and calm reading surfaces.

- Strictly avoid generic tech flat illustration ("corporate Memphis") or cartoonish characters.
- Keep illustrations grounded in reality: real package contours, authentic barcode geometries, clean optical lenses, and calm paper sheets.

### Named Rules

**The Semantic Fidelity Rule.** An icon or illustration must directly and unambiguously communicate the real-world concept, ingredient, or action it signifies. Mismatched substitutions are prohibited.

**The Vibe-Coded Character Rule.** Visual symbols must feel intentionally crafted, tactile, and stylistically harmonious with the Life Goods palette and geometry—never generic, sterile, or disconnected from the product context.

## Components

### Buttons

- **Glass rollout:** opt-in glass controls apply throughout Compare Products only. Other pages retain existing button defaults. Shared primary navigation uses glass wherever it is visible.
- **Glass material:** neutral white at 88% opacity; primary deep amber at 96% opacity with white text. Use a 20px backdrop blur, 1.35 saturation, a white highlight edge, and `0 14px 40px -20px rgba(19,21,25,0.4)` lift. Selected controls use pale amber with deep amber text. Preserve semantic states and existing focus rings.
- **Accessibility:** minimum 44px targets; disable motion for reduced-motion preferences. Unsupported blur and reduced-transparency preferences use opaque white/amber. Do not stack backdrop blur inside an already blurred control group. Keep photo thumbnails rectangular and content, fields, and nutrition results opaque.

- **Shape:** compact rounded controls (`0.75rem`), minimum `44px` target, active `0.98` scale.
- **Primary:** grounded amber with white extra-bold text and `0.5rem 1rem` padding; camera actions use the brighter amber mark on glass.
- **Hover / Focus:** deepen amber through #7B440D → #5A320B; two-pixel amber ring with canvas offset; transitions complete in `150ms`.
- **Outline:** white with slate border; hover strengthens border and quiet slate fill.
- **Ghost:** transparent with muted slate text; hover introduces soft slate fill.

### Chips

- **Style:** full-pill soft slate fills with muted slate semibold text, `0.25rem 0.75rem` padding.
- **State:** chips present source-provided categories, labels, and additives only — never mixed-meaning packaging data, and never selectable verdict badges.

### Cards / Containers

- **Corner Style:** white Product source sheets are square-edged; contained callouts and icon fields use `1rem`.
- **Background:** white for source sheets, slate canvas for the field, pale blue for source context, pale amber for Life Goods actions.
- **Shadow Strategy:** per the Source Sheet Lift vocabulary; ordinary callouts stay flat.
- **Border:** one-pixel slate dividers inside dense source content instead of boxing every row.
- **Internal Padding:** `1.25rem` on mobile, `1.5rem` where the rail permits.

### Inputs / Fields

- **Style:** `48px` high, white, one-pixel slate border, `0.75rem` corners.
- **Focus:** amber border with a soft three-pixel amber-tint ring.
- **Error / Disabled:** errors use a destructive wash with `role="alert"` text; disabled fields retain structure at half opacity.
- **Barcode Entry:** mono stack, tabular numerals, modest positive tracking.

### Navigation

A centered floating glass capsule holds Learn, Scan, Compare, and Concerns, with 20px icons and 12px labels. It is at most 20rem (320px) wide and normally 60px tall, keeps at least 1rem side gutters, and sits 1rem above the bottom safe area. Each destination is at least 50px high; the active destination has a compact pale amber pill and deep amber text. Reserve 5.75rem plus the safe area below page content. Existing visibility rules remain: hidden on Search and during the active Compare workflow, visible on the Compare landing screen. Compare's Back/Next dock uses the same material. Product section navigation and other page controls retain their existing styling.

### Scanner Aperture (signature)

A single dark glass surface (#131519) with `1.5rem` corners, a restrained slate ring, and centered privacy copy before camera access. Warm amber corner brackets and the laser (#E7B583/#E19447) mark the scan frame; a green pulse (#82B96E) signals readiness; a gradient-black dock holds circular pause/switch controls. All states (consent, starting, paused, error, scanning) keep the privacy copy first, and reduced-motion preferences suppress animation.

### Source Attribution Panel

A pale blue wash (info-50), dark blue informational iconography, divider rows, and explicit blue links to Open Food Facts and licensing. It explains provenance without adopting source data as Life Goods-owned content — the only tinted panel on the reading sheet.

## Do's and Don'ts

### Do:

- **Do** keep every route inside the narrow source rail and preserve comfortable one-handed targets.
- **Do** apply `wrap-anywhere` to all source text and mono identifiers; long taxonomy strings wrap, never overflow.
- **Do** group packaging by meaning (Original Text, recycling instructions, materials, shapes, recycling, components) with normalized, deduplicated values.
- **Do** derive nutrition table columns from supplied data only; stack them on phones.
- **Do** place Barcodes and measured values in mono with tabular numerals.
- **Do** choose icons and illustrations that accurately represent the semantic meaning of the underlying data, ingredient, action, or state.
- **Do** use any icon library or bespoke SVG that maintains the vibe-coded, tactile Life Goods design language and optical harmony.

### Don't:

- **Don't** turn Source Assessments into dominant score tiles, traffic-light verdicts, or purchase recommendations; keep the attribution sentence directly under the section heading.
- **Don't** render missing data as "—", "none", "N/A", or a friendlier phrase; only `Source Data Unavailable`.
- **Don't** use blue for ordinary Life Goods actions or amber to imply source-data quality; success/error/warning appear only in status.
- **Don't** round and shadow every content block, and never use shadows stronger than the sheet vocabulary.
- **Don't** force horizontal scrolling for data; the 320px viewport is the floor.
- **Don't** upload, retain, or visually imply capture of camera frames beyond the local scanner aperture.
- **Don't** force an icon library choice or generic placeholder that compromises semantic meaning (e.g., using a coffee bean for soybean, a carrot for celery, or a receipt for nutrition facts).
- **Don't** use sterile, bland, or corporate-style stock illustrations and generic icons that lack visual character.
