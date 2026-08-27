# Package Capture physical-device check

Automated browser tests cannot fully reproduce camera permission, stream interruption, image orientation, or Telegram WebView behavior. Complete this checklist before issue #52 is accepted.

## Setup

1. Run `VITE_MVP_DEMO_MODE=true pnpm dev:https` from the repository root.
2. Open the HTTPS development address from the device and accept the local development certificate if required.
3. Test the English and Khmer interfaces with a real sealed food or non-alcoholic beverage package.

## Devices

- Android Chrome on a representative low- or mid-range phone.
- iOS Safari on a supported iPhone.
- Telegram WebView on Android and iOS when the local site is reachable from Telegram.

## Checks

- Camera permission appears only after **Open camera** is pressed.
- Denying permission shows recovery and never opens a file picker.
- The rear camera is preferred and the preview is correctly oriented.
- Front-package and ingredient-panel photos can each be captured, previewed, and retaken.
- Leaving a camera step turns off the device camera indicator.
- Backgrounding the browser or interrupting the stream shows a recoverable stopped-camera state.
- Reloading clears photos and returns to the first missing step.
- Browser Back moves through review, ingredients, and front steps predictably.
- Exit clears previews and returns Home; returning to Package Capture shows no old photos.
- The 320×568 viewport keeps the main action usable without horizontal scrolling.
- Khmer labels wrap without clipping or overlapping controls.
- The review screen says that photos are not sent, saved, or analyzed.
- Continuing from review destroys local previews before the queued demo state appears.
- Every result state shows the localized demo notice and no state advances on a timer.

Record the device, operating-system version, browser or Telegram version, locale, result, and any defect in the issue review notes.
