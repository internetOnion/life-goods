---
name: LifeGoods
description: Khmer-first packaged-food label guidance with evidence and visible uncertainty.
---

# Design System: LifeGoods

## 1. Creative direction

**North star: “The Coconut Lens.”**

LifeGoods is a calm, camera-first shopping utility. It uses the familiar structure of a barcode scanner while being unusually honest about capability and evidence: an unavailable camera looks unavailable, community data looks unreviewed, and missing fields look unknown rather than reassuring.

The visual world is white, charcoal, pale botanical neutrals, and restrained coconut green. Crisp one-pixel rules and open space create structure without decorative card stacks. The experience is Khmer-first, with generous Khmer line height and original package languages kept visible.

The coconut is the product’s identity motif. Home uses a compact horizontal coconut-and-wordmark lockup between the camera surface and unified search entry; it is brand identity, not evidence or a favorable Product signal. The supplied Open Food Facts screens and the approved `.impeccable/mocks/home-camera-b-approved.png` comp are structural references, not sources for scoring, verdict language, or branding.

## 2. Color tokens

The implemented palette lives in `frontend/src/styles.css` as OKLCH tokens. The shadcn semantic tokens map to these roles:

- **Brand** — `oklch(0.47 0.115 157)`: identity accent.
- **Brand dark** — `oklch(0.36 0.09 157)`: primary actions, active navigation, focus, and source links.
- **Brand hover** — `oklch(0.31 0.08 157)`: interactive hover only.
- **Brand soft** — `oklch(0.94 0.025 157)`: selected icon wells and quiet disclosure surfaces.
- **Page / background** — `oklch(0.992 0.002 160)`: near-white app background.
- **Surface / muted** — `oklch(0.965 0.008 160)`: viewfinder and grouped source surfaces.
- **Surface strong / secondary** — `oklch(0.925 0.014 160)`: disabled and secondary control distinction.
- **Ink / foreground** — `oklch(0.235 0.018 165)`: primary text and icon color.
- **Muted foreground** — `oklch(0.43 0.018 165)`: secondary text that still meets the contrast target.
- **Line / border** — `oklch(0.84 0.012 160)`: separators and quiet boundaries.
- **Error / destructive** — `oklch(0.44 0.17 28)`: validation and temporary failure support, always paired with text.

### Color rules

- Green never means safe, healthy, allergen-free, Halal, authentic, compliant, or recommended.
- Active and error states include labels, shape, weight, or icons; color is never the only cue.
- Brand green remains a small accent rather than a full-screen wellness treatment.
- No gradients, glass effects, traffic-light nutrition colors, or green-check reassurance.

## 3. Typography

The UI uses one system stack: `"Noto Sans Khmer", "Khmer OS System", Inter, ui-sans-serif, system-ui, sans-serif`. This avoids a branded Latin face that weakens the Khmer hierarchy and keeps loading fast on modest devices.

- Khmer body copy uses a `1.65` base line height.
- Khmer screen and result headings use a `1.7` line height so stacked glyphs do not clip.
- Major headings use fluid sizing and restrained negative tracking; body copy does not use tightened tracking.
- Evidence prose stays near 65–75 characters per line on wide screens.
- Metadata remains readable body text, never tiny uppercase labeling.

Components expand for real Khmer copy. Consequential labels, source state, and evidence are not truncated. Browser checks cover 320, 360, and 393px widths.

## 4. Layout and elevation

The shell is mobile-first and bounded to a 48rem content column on desktop. The global shell is headerless: no persistent logo, wordmark, or replacement top bar competes with the shopping task. Home uses one dominant pale viewfinder, an inline LifeGoods lockup, a compact active-language flag above a unified search entry, and a fixed four-item bottom navigation. Search owns manual identifier, Product-name, and brand entry while Home remains camera-first; Search keeps the bottom navigation visible with Home marked active and adds only a local back/title row. Result routes hide both the language switch and bottom navigation and expose a visible localized back action.

LifeGoods is flat by default. Depth comes from tonal layers, one-pixel rules, and spacing. Rounded corners are restrained and functional; shadows are reserved for temporary overlays. Do not nest evidence in repetitive cards.

Safe-area insets are applied to fixed navigation and result bottoms. The primary barcode action remains visible at a 320×568 viewport, while supporting guidance can scroll.

## 5. Components and states

### App shell

- Top: no persistent branded header, logo, wordmark, or language control in the global shell. Focused pages may expose their own local title and back action.
- Home identity: the centered horizontal coconut-and-LifeGoods lockup sits between the viewfinder and search entry without becoming a header or link.
- Home only: one circular flag button shows the active interface language—Cambodia in Khmer mode and the United Kingdom in English mode—and its accessible name states the destination language action.
- The flag occupies its own utility row between the camera placeholder and search entry without overlay positioning.
- Bottom: Home, Learn, History, and Allergies with Phosphor icons, text, and non-color active treatment. The navigation remains on Home and Search, with Search assigning Home the active/current-page state; focused result routes remove it.

### Camera scanner

- The viewfinder automatically requests camera access and starts scanning on page load; once granted, the camera remains continuously active on the home screen.
- Starting shows a pending state, then an environment-facing live video preview with a clear scan frame and concise guidance.
- Valid camera results use the same identifier normalization and Package Match route as Search barcode entry. The stream stops before navigation and duplicate detections are ignored.
- A circular, icon-only “Switch to camera” control sits inside the lower-right scanner area during starting and scanning states. Its localized action remains available as the accessible name. It is intentionally inert and excluded from sequential keyboard focus in this version, and is omitted from camera-error states so it cannot compete with retry.
- Permission, missing-device, busy-device, unsupported-browser, invalid-code, and delayed-detection states remain explicit and keep Product search available with retry actions.
- Camera frames are decoded locally and are not uploaded or retained. Streams stop on success, opening Search, route changes, visibility loss, and unmount.

### Unified Product search

- Home exposes an accessible link styled as a search field; `/search` owns exact barcode, Product-name, and brand entry.
- Search provides a localized label, auto-focus, clear control, visible focus, field-associated barcode validation, and 44px minimum actions.
- Text search starts after two characters and a 300ms debounce. The URL query is replaced rather than pushed for each keystroke, and stale requests are cancelled.
- Complete barcode-shaped input is normalized locally. Valid identifiers open the Package Match route; invalid identifiers remain on Search with explicit validation.
- Up to five deduplicated recent terms are kept in `sessionStorage` only after a result is opened. Before typing, Search shows recents without implying a popularity ranking.
- Search results are full-width rows showing source Product name, quantity, declared manufacturing place, and a reference image or explicit placeholder. Brand is searchable but is not displayed.
- One concise disclosure above results identifies Open Food Facts community data as unreviewed. Missing source fields remain unknown rather than negative Claims.
- When a Package Match result was opened from Search, Search remains the inert background and the search query is restored on dismissal. Scan and direct result routes retain Home as the background.

### Open Food Facts result

- Identity leads: reference image, localized name, alternate names, brand, quantity, and identifier.
- A prominent disclosure states that the community data is not reviewed by LifeGoods.
- Ingredients, allergens, traces, nutrition, packaging languages, and countries remain separate evidence groups.
- Missing fields say “Unavailable from Open Food Facts,” never “none.”
- Keyboard-accessible disclosures expose language, source field, source URL, and retrieval metadata.
- Source attribution, licenses, freshness, revision, and record link close the reading order.
- No score, positive/negative grouping, purchase verdict, or safety conclusion.

### Journey states

Invalid input remains local to Search. Initial recents, short-query guidance, loading skeletons, search results, no matches, temporary failure, rate limiting, pagination, OFF match, and unsupported non-OFF candidates are distinct states with live announcements and focused outcome headings. Retry and back navigation preserve the normalized identifier or search query.

## 6. Interaction and accessibility

- Target WCAG 2.2 AA with visible `:focus-visible` outlines and at least 44×44 CSS-pixel targets.
- Motion is limited to brief state feedback; `prefers-reduced-motion` reduces animations and transitions to effectively zero.
- Image failures become labeled placeholders with no broken-image icon from the browser.
- Interface locale changes do not refetch data or clear the current identifier or query.
- Home keyboard order follows the language flag, search entry, then navigation. Search keyboard order follows back, query field, clear action when present, results or recents, then navigation; result outcomes receive focus after asynchronous completion.

## 7. Do and don’t

### Do

- Preserve field-level provenance and original-language evidence.
- Keep uncertainty adjacent to the affected evidence and pair failures with recovery.
- Use familiar scanning and navigation patterns with precise capability copy.
- Verify representative Khmer viewports and both mobile and desktop layouts.

### Don’t

- Do not use wellness marketing, purity language, universal health scores, or “Excellent/Bad” labels.
- Do not collapse absent, stale, external, or unreviewed evidence into a negative finding or reassuring absence.
- Do not mix allergen evidence, Halal Ingredient Assessment, Seal Observation, and certificate status.
- Do not add decorative page choreography, bounce, elastic easing, nested card grids, or oversized rounded surfaces.
- Do not treat `TreePalmIcon` as final coconut artwork.
