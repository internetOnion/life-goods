---
target: the scan page
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-09-02T16-56-47Z
slug: src-features-scan-scanpage-tsx
---
# Design Critique: Scan Page (`src/features/scan/ScanPage.tsx`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|:-----:|-----------|
| 1 | Visibility of System Status | 3 | Timely camera state indicators ("Starting camera...", "Camera paused", ARIA live status); but zero sensory acquisition feedback (haptic pulse or sound chime) on successful scan. |
| 2 | Match Between System and Real World | 2 | False affordance: labeled "Search products..." with magnifying glass icon despite the backend only accepting numeric Barcodes. Lacks torch toggle for real-world Cambodian grocery store lighting. |
| 3 | User Control and Freedom | 3 | Clear pause/resume and camera switch controls. However, error states lack an immediate in-card escape hatch or direct inline manual entry trigger. |
| 4 | Consistency and Standards | 2 | Severe design token divergence: widespread hardcoded hex values instead of `DESIGN.md` tokens; unstyled fallback link; stranded translation keys (`enterBarcode`, `enterBarcodeHint`). |
| 5 | Error Prevention | 3 | Strong checksum modulo-10 and length validation in `identifier.ts`. But camera decode errors route abruptly to `/search` without inline correction guidance. |
| 6 | Recognition Rather Than Recall | 2 | Shopper must guess that "Search products..." actually expects an 8, 12, 13, or 14-digit retail barcode; no format examples (e.g. `885...`) or barcode glyphs shown on the home surface. |
| 7 | Flexibility and Efficiency of Use | 2 | Session persistence avoids repeated permission prompts. But lacks torch toggle, clipboard paste accelerator, or keyboard shortcut overrides. |
| 8 | Aesthetic and Minimalist Design | 3 | Viewfinder glass is restrained and atmospheric. But mid-page `BrandLockup` is extraneous visual noise cluttering the utility flow. |
| 9 | Help Users Recognize, Diagnose, and Recover from Errors | 2 | Diagnostic error strings are descriptive, but recovery is broken: permission failure suggests entering a barcode, yet provides no action link inside the error container. |
| 10 | Help and Documentation | 2 | Superb privacy documentation on consent screen. Zero scanning assistance or guidance for damaged, curved, or reflective packaging. |
| **Total** | | **24/40** | **Acceptable (60%)** — Solid technical engine, but significant interaction and craft debt. |

---

## Design Specificity Verdict

The Scan Page is partially grounded in Life Goods' "Source Reader" identity, highlighted by a standout signature camera aperture, but suffers from generic drift and domain mismatches in its secondary flows.

### LLM Assessment
The primary camera aperture (`bg-[#131519]` dark glass with warm amber reticles `#E7B583` and horizontal scan beam) feels bespoke and tactile—an authentic optical instrument. The privacy-first consent gate directly manifests Life Goods Product Principle 7 ("Privacy by omission"), clearly reassuring the shopper before hardware access is requested.

However, the screen loses its product specificity below the viewfinder:
1. **The E-Commerce Search Masquerade**: Presenting a generic `<Link to="/search">` with a magnifying glass and the placeholder `"Search products..."` dilutes the core domain concept. Life Goods is explicitly not an e-commerce catalog or grocery search engine; it is a Barcode-to-attributed-source lookup tool. Shoppers typing product names ("Mama Noodles", "Soy Milk") receive a jarring "Use digits only" error.
2. **Stranded Brand Lockup**: A centered `<BrandLockup />` floats awkwardly between the camera container and the search link, acting like an unanchored marketing badge on what should be a focused, distraction-free utility screen.
3. **Design Token Fragmentation**: The component relies on raw, hardcoded hex values (`#131519`, `#303843`, `#E7B583`, `#B86A1A`, `#995613`, etc.) alongside stock Tailwind utility classes rather than using the cohesive semantic tokens declared in `DESIGN.md`. Furthermore, `bg-[#B86A1A]` with white text yields a contrast ratio of only **4.15:1**, failing WCAG AA (minimum 4.5:1).

### Deterministic Scan
The automated CLI detector (`detect.mjs`) scanned `ScanPage.tsx` and all supporting feature files (`barcodeScanner.ts`, `identifier.ts`, `translations.ts`), returning **0 automated findings** (clean exit code 0). 

- **Potential Rule Triggers Analyzed**:
  - `pulsing-dot` (`motion-safe:animate-pulse` on line 413): **False positive if flagged.** This indicator signals an active 30fps hardware video stream processing frames in real-time, which is genuine sensor activity rather than decorative SaaS liveness simulation.
  - `dark-glow` (`shadow-[0_0_10px_rgba(225,148,71,0.9)]` on the scan laser, line 431): **False positive if flagged.** The glow realistically simulates an optical scanner beam, reinforcing system status.
- **Detector-LLM Synthesis**: The detector confirmed clean structural markup, lack of generic anti-patterns (no generic gradients, empty states, or nested cards), and proper heading hierarchy (2.0:1 scale). However, the manual design review caught what regex rules cannot: semantic mismatch in copy ("Search products..." vs barcode lookup), WCAG AA color contrast deficits on custom buttons, and missing physical hardware controls (torch/flashlight).

### Visual Overlays
Browser automation tools are unavailable in this environment session; live server injection and visual browser overlays were cleanly skipped.

---

## Overall Impression

A technically sophisticated, privacy-forward scanner engine wrapped in an atmospheric aperture, let down by a misleading "search" fallback, lack of sensory feedback on scan, and token inconsistencies that weaken its physical craft.

---

## What's Working

1. **Privacy-First Consent Architecture**:
   The consent screen (`StateConsent`) treats on-device processing and zero image retention as a core brand promise rather than legal fine print. It builds immediate shopper trust before requesting camera access.
2. **Robust Multi-Tier Hardware Adapter**:
   `barcodeScanner.ts` implements a resilient 4-stage camera constraint fallback, automatic native `BarcodeDetector` with ZXing fallback, background tab pause listeners, and session persistence to avoid repetitive permission fatigue.
3. **Atmospheric Signature Aperture**:
   The dark glass viewfinder (`#131519`), tactile amber corner brackets, and responsive ready indicators give the scanner an intentional, optical-instrument feel that honors the "Source Reader" aesthetic.

---

## Priority Issues

### [P1] False Affordance & Semantic Mismatch: "Search products..." vs Barcode Lookup
- **Why it matters**: Life Goods is not a retail store or product catalog. When shoppers see a magnifying glass with "Search products...", they instinctively type names like "Mama noodles" or "Soy milk" and are rejected with "Use digits only." This creates immediate friction and confusion.
- **Fix**: Redesign the fallback to explicitly state `"Enter Barcode digits instead"` with a Barcode icon, monospace formatting, and length guidance (`8, 12, 13, or 14 digits`), leveraging the existing orphaned translations `enterBarcode` and `enterBarcodeHint`.
- **Suggested Command**: `$impeccable clarify`

### [P1] Missing Sensory Scan Feedback (Acquisition Blindspot)
- **Why it matters**: Shoppers scan items one-handed in busy aisles. An immediate, silent jump to `/products/:id` feels like an accidental tap or page glitch. Users need physical and auditory reassurance that the barcode was acquired.
- **Fix**: Add a 180ms acquisition latch: flash the reticle in green (`#82B96E`), trigger a haptic pulse (`navigator.vibrate?.([40, 60, 40])`), announce "Barcode detected" via ARIA live region, and then navigate.
- **Suggested Command**: `$impeccable delight`

### [P2] Missing Low-Light Torch / Flashlight Affordance
- **Why it matters**: Cambodian grocery stores, night markets, and minimarts frequently suffer from uneven or dim lighting, while glossy packaging creates glare that blinds the camera.
- **Fix**: Check `track.getCapabilities().torch` upon stream startup. When available, display a tactile Torch toggle in the viewfinder control dock alongside Pause and Switch Camera.
- **Suggested Command**: `$impeccable adapt`

### [P2] Hardcoded Hex Values & WCAG AA Contrast Violation
- **Why it matters**: `ScanPage.tsx` bypasses the design tokens established in `DESIGN.md`. Furthermore, using `#B86A1A` with white text yields only **4.15:1** contrast, failing WCAG AA requirements (4.5:1 minimum).
- **Fix**: Migrate raw hex values to semantic theme tokens (`bg-slate-ink`, `border-slate-strong`). Switch button background to `amber-action` (`#995613`), which achieves >5.5:1 contrast against white text.
- **Suggested Command**: `$impeccable colorize`

### [P2] Stranded Brand Lockup & Broken Page Composition
- **Why it matters**: Floating `<BrandLockup />` midway down the screen pushes the manual entry action toward the bottom edge, interfering with thumb reach and cluttering the utility flow.
- **Fix**: Remove the mid-page `BrandLockup`. Brand identity is already established in the top header; keep the scan utility viewport compact and focused.
- **Suggested Command**: `$impeccable distill`

---

## Persona Red Flags

### 1. Casey (Distracted Mobile User)
*Context: One-handed shopping in a Phnom Penh supermarket, holding a basket, fluorescent glare.*
- **Red Flag 1 (Glare Blindspot)**: Pointing at reflective crinkly snack packaging produces glare streaks; scanner struggles without a fill torch or framing tips ("Tilt packaging slightly").
- **Red Flag 2 (Misleading Fallback)**: Taps "Search products...", types "Calbee", and gets an error demanding digits. Has to put down basket to search for tiny printed numbers.
- **Red Flag 3 (Palm Misfire)**: Bottom-right camera switch button sits in the fleshy zone of the palm when holding a phone one-handed.

### 2. Sam (Accessibility-Dependent User)
*Context: Screen reader (VoiceOver), keyboard-only navigation, low vision.*
- **Red Flag 1 (Silent Capture Cut)**: Viewfinder acquires barcode and silently switches routes, disorienting the screen reader cursor without an audio or haptic cue.
- **Red Flag 2 (Error Dead End)**: In camera denial state, focus lands on a disabled "Try camera again" button with no link to manual barcode entry inside the error card.
- **Red Flag 3 (Low Button Contrast)**: White text on `#B86A1A` fails WCAG AA (4.15:1), making the primary call to action difficult to distinguish.

### 3. Sreymom (Bilingual Shopper in Phnom Penh)
*Context: Scanning imported Thai/Japanese packaged goods; concerned about mobile data usage.*
- **Red Flag 1 (English Hardcoded Strings)**: Scan interface relies strictly on English keys, missing Khmer translations for technical terms like "browser session" and "camera frames".
- **Red Flag 2 (Data Usage Anxiety)**: Hesitates to start camera because there is no explicit visual badge in Khmer reassuring her that video processing happens 100% locally and consumes no mobile data.

---

## Minor Observations

- The animated scan laser cycles continuously, even when camera processing is suspended or waiting on focus.
- The `ScanCorner` SVG hardcodes `strokeWidth="3.5"` and `#E7B583` stroke instead of utilizing icon tokens.
- Switching cameras (`switchCamera`) causes a momentary black flicker without a crossfade or visual flip transition.
- Translation dictionary in `translations.ts` already defines `enterBarcode` and `enterBarcodeHint`, which were bypassed during implementation.

---

## Questions to Consider

1. **Tactile Hardware vs Catalog**: *What if manual entry was presented as a dedicated numeric keypad or slide-up tray with immediate barcode checksum validation, rather than an external route to a "Search" page?*
2. **Sensory Confirmation**: *Could we introduce an unmistakable tactile "beep & buzz" signature upon barcode acquisition that gives shoppers immediate physical certainty without looking at the screen?*
3. **Khmer Localization First**: *How will the camera aperture's vertical proportions adapt when Khmer script (which requires ~20% more line height) replaces the English privacy and error explanations?*
