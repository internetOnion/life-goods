---
target: Package Capture journey and demo result
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
timestamp: 2026-08-27T09-33-03Z
slug: nd-src-features-package-capture-capturejourney-tsx
---
# Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|------:|-----------|
| 1 | Visibility of System Status | 3/4 | Progress, camera status, and recovery states are clear, though demo processing is manually advanced. |
| 2 | Match System / Real World | 3/4 | The photo sequence feels natural, but technical terms remain unexplained in Khmer. |
| 3 | User Control and Freedom | 3/4 | Back, exit, retake, edit, skip, and retry are present. |
| 4 | Consistency and Standards | 3/4 | Controls are consistent, with some tension between the result header and the intended result hierarchy. |
| 5 | Error Prevention | 3/4 | Required photos are gated, shutter readiness is guarded, and ingredients are clearly optional. |
| 6 | Recognition Rather Than Recall | 3/4 | Step labels, progress, text buttons, and contextual hints help users act without remembering prior instructions. |
| 7 | Flexibility and Efficiency | 2/4 | Linear capture and the disabled barcode alternative limit speed for repeat shoppers. |
| 8 | Aesthetic and Minimalist Design | 2/4 | The calm visual system works, but caveats, privacy copy, and decorative motifs compete in later states. |
| 9 | Error Recovery | 3/4 | Camera failures and partial/expired states have actionable recovery. |
| 10 | Help and Documentation | 2/4 | Inline hints help, but evidence terminology and photo-quality expectations are under-explained. |
| **Total** |  | **27/40** | **Acceptable; significant improvements needed** |

## Design Specificity Verdict

The surface is medium-high in specificity but unfinished. Khmer-first copy, private Package Capture language, explicit uncertainty, and evidence-oriented stages make it recognizably LifeGoods. The capture shell still resembles a generic camera wizard, and the repeated palm motif, disabled barcode mode, and repeated demo/privacy caveats dilute the product character.

The deterministic detector found 0 findings (`[]`) on the Package Capture target. Browser inspection found no horizontal overflow at desktop or mobile widths. The only concrete visual issue was mobile Khmer header density: navigation controls grew unusually tall (up to roughly 115×95px), pushing the primary content down. The browser overlay could not be injected because the mutable preflight rejected `document.title` mutation; no reliable user-visible overlay is available.

## Overall Impression

The operational journey is thoughtful and trustworthy: it guides a shopper through front, back, optional ingredients, and review without pretending that demo data is real. The biggest opportunity is to make the completion state feel like an honest, useful endpoint rather than a successful capture followed by a disclaimer-heavy dead end.

## What's Working

1. Evidence honesty is unusually strong: the UI distinguishes demo structure, unavailable data, and actual interpretation.
2. Operational scaffolding is clear: staged capture, progress, readiness feedback, retake/edit controls, and an explicit ingredient skip.
3. Accessibility fundamentals are solid: focusable headings, labeled actions, large touch targets, responsive Khmer line-height, and image-failure placeholders.

## Priority Issues

### [P1] “Complete” promises more than the result delivers

The completed state says “Demo capture complete,” then leads with “No package label was interpreted.” That creates an emotional anticlimax and makes the primary next action unclear.

Fix: rename the state to “No result yet — demo only” (and Khmer equivalent), make the uncertainty statement the main heading, use one clear “Capture next product” CTA, and remove or collapse the repeated future-service footer on this state.

Suggested command: `$impeccable clarify` or `$impeccable distill`

### [P1] Khmer-first comprehension breaks on consequential terminology

Terms such as “Evidence,” “Evidence Uncertainty,” “Shopper Guidance,” and “Package Capture” remain technical or untranslated in consequential states.

Fix: lead with plain Khmer wording, then provide the exact glossary term as a secondary parenthetical or expandable explanation. Keep the distinction between unreadable evidence, missing evidence, and no conclusion explicit.

Suggested command: `$impeccable clarify`

### [P1] Mobile Khmer headers become vertically heavy

On a 393px viewport, Khmer navigation labels wrap into tall controls, including a Back control around 115×95px. This delays the capture/result content and makes the header feel like a stack of competing actions.

Fix: give Back and Exit compact icon-plus-label treatments with a controlled max width, or use icon-only controls with localized accessible names and a visible tooltip/help affordance. Keep the language switch centered without letting neighboring labels expand the row.

Suggested command: `$impeccable adapt`

### [P1] Camera framing does not teach photo quality

The camera stage provides a generic rectangle but no package-specific cue for label boundaries, glare, skew, or minimum legibility. A shopper can complete the step with an unusable photo and only discover the problem later.

Fix: add subtle front/back/ingredient framing guides and one short, non-promissory quality cue per step. Preserve the current privacy and uncertainty language.

Suggested command: `$impeccable harden`

### [P2] Follow-up close-up loses its relationship to the journey

The close-up state replaces the four-step progress indicator with only “Requested follow-up photo,” so users cannot tell whether it is a retake, an extra step, or a restart.

Fix: label it “Follow-up for Step 3 of 4,” explain why it was requested, and keep a compact visual relationship to the original ingredient step.

Suggested command: `$impeccable clarify`

## Persona Red Flags

- **Jordan, first-timer:** Technical evidence terminology and “Demo capture complete” followed by no result create uncertainty about what was accomplished.
- **Sam, accessibility-dependent:** Focus is moved to headings with a prominent outline; tab panels expose only a dash, so the unavailable-state meaning depends on surrounding copy.
- **Casey, distracted mobile shopper:** The review state asks for several separate decisions, and a reload clears all photos, forcing a full restart after interruption.

## Minor Observations

- The disabled “Scan barcode / Soon” control looks like a selectable mode even though it cannot act; a quieter capability note may be clearer.
- Privacy copy appears in review, close-up, and result states. Keep one concise disclosure at the decision point and progressively disclose future-retention detail.
- Result progress labels describe “review photos” after the photos have already been discarded, which may confuse users about what is actually happening.
- The palm motif is distinctive but should remain restrained so it supports, rather than substitutes for, a stronger product-specific identity.

## Questions to Consider

- What if the completion state clearly said “No result yet” and made the next capture the only primary action?
- Can a shopper understand “Evidence” entirely from the Khmer copy without knowing the product glossary?
- What is the smallest camera framing cue that would materially reduce unreadable photos?
- Should the language switch persist on result screens, or should result controls be reduced to Back, Exit, and the next action?
