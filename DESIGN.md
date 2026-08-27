---
name: LifeGoods
description: Khmer-first packaged-food label guidance with evidence and visible uncertainty.
---

# Design System: LifeGoods

## 1. Creative direction

**North star: “The Coconut Lens.”**

LifeGoods is a calm, camera-first shopping utility. It uses the familiar structure of a barcode scanner while being unusually honest about capability and evidence: an unavailable camera looks unavailable, community data looks unreviewed, and missing fields look unknown rather than reassuring.

The visual world is white, charcoal, pale botanical neutrals, and restrained coconut green. Crisp one-pixel rules and open space create structure without decorative card stacks. The experience is Khmer-first, with generous Khmer line height and original package languages kept visible.

The coconut is the product’s identity motif. The current shell intentionally renders no temporary logo or wordmark; final coconut artwork remains future brand work rather than a placeholder in the shopping task. The supplied Open Food Facts screens and the approved `.impeccable/mocks/home-camera-b-approved.png` comp are structural references, not sources for scoring, verdict language, or branding.

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

The shell is mobile-first and bounded to a 48rem content column on desktop. It is headerless: no logo, wordmark, or replacement top bar competes with the shopping task. Home uses one dominant pale viewfinder, a compact active-language flag aligned directly above the barcode submit column, an attached barcode form, and a fixed four-item bottom navigation. Result routes hide both the language switch and bottom navigation and expose a visible localized back action.

LifeGoods is flat by default. Depth comes from tonal layers, one-pixel rules, and spacing. Rounded corners are restrained and functional; shadows are reserved for temporary overlays. Do not nest evidence in repetitive cards.

Safe-area insets are applied to fixed navigation and result bottoms. The primary barcode action remains visible at a 320×568 viewport, while supporting guidance can scroll.

## 5. Components and states

### App shell

- Top: no branded header, logo, wordmark, or persistent language control.
- Home only: one circular flag button shows the active interface language—Cambodia in Khmer mode and the United Kingdom in English mode—and its accessible name states the destination language action.
- The flag occupies its own utility row between the camera placeholder and barcode form, centered over the form’s submit column without overlay positioning.
- Bottom: Home, Learn, History, and Allergies with Phosphor icons, text, and non-color active treatment.

### Camera scanner

- The viewfinder is idle until the shopper explicitly selects “Start camera”; permission is never requested on page load.
- Starting shows a pending state, then an environment-facing live video preview with a clear scan frame, concise guidance, and a visible stop action.
- Valid camera results use the same identifier normalization and Package Match route as manual entry. The stream stops before navigation and duplicate detections are ignored.
- Permission, missing-device, busy-device, unsupported-browser, invalid-code, and delayed-detection states remain explicit and keep manual barcode entry available.
- Camera frames are decoded locally and are not uploaded or retained. Streams stop on success, manual submission, route changes, visibility loss, and unmount.

### Barcode control

- Label, hint, visible focus, field-associated validation, and a 44px minimum action.
- Spaces and hyphens are accepted, then the normalized identifier drives the URL.
- Loading moves to the result route; duplicate requests are prevented by route/query state.

### Open Food Facts result

- Identity leads: reference image, localized name, alternate names, brand, quantity, and identifier.
- A prominent disclosure states that the community data is not reviewed by LifeGoods.
- Ingredients, allergens, traces, nutrition, packaging languages, and countries remain separate evidence groups.
- Missing fields say “Unavailable from Open Food Facts,” never “none.”
- Keyboard-accessible disclosures expose language, source field, source URL, and retrieval metadata.
- Source attribution, licenses, freshness, revision, and record link close the reading order.
- No score, positive/negative grouping, purchase verdict, or safety conclusion.

### Journey states

Invalid input remains local to the form. Loading, confirmed no-match, temporary failure, OFF match, and unsupported non-OFF candidates are distinct states with live announcements and focused outcome headings. Retry and back navigation preserve the normalized identifier.

## 6. Interaction and accessibility

- Target WCAG 2.2 AA with visible `:focus-visible` outlines and at least 44×44 CSS-pixel targets.
- Motion is limited to brief state feedback; `prefers-reduced-motion` reduces animations and transitions to effectively zero.
- Image failures become labeled placeholders with no broken-image icon from the browser.
- Interface locale changes do not refetch data or clear the current identifier.
- Home keyboard order follows the language flag, field hint, barcode input, submit action, then navigation; result outcomes receive focus after asynchronous completion.

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
