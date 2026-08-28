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

- Camera permission is requested automatically when the first capture step opens; once granted, the live preview stays camera-first on later capture steps and retakes.
- Denying permission shows recovery and never opens a file picker.
- The rear camera is preferred and the preview is correctly oriented.
- Front-package and back-package photos can each be captured, previewed, and retaken.
- Continuing from Front opens the Back camera without an extra Open-camera tap.
- Ingredients can be skipped in one tap; review marks them Not provided and offers Add/Retake.
- Leaving a camera step turns off the device camera indicator.
- Backgrounding the browser or interrupting the stream shows a recoverable stopped-camera state.
- Reloading clears photos and returns to the first missing step.
- Browser Back moves through review, ingredients, back, and front steps predictably.
- Navigating away from capture clears previews; returning to Package Capture shows no old photos.
- The 320×568 viewport keeps the main action usable without horizontal scrolling.
- Khmer labels wrap without clipping or overlapping controls.
- The capture journey has no bottom navigation, exit control, language control, or barcode/capture toggle.
- The review screen says that photos are not sent, saved, or analyzed.
- Continuing from review destroys local previews before the queued demo state appears.
- Every result state shows the localized demo notice and no state advances on a timer.
- The completed result shows Product name and Brand plus Information, Ingredients, and Nutrition tabs; every value is a dash with the no-extraction explanation.
- Capture next product clears the previous identifier; retry and close-up recovery keep same-product context.
- A partial result requests only a targeted ingredient close-up, preserves safe entry context, and discards the close-up before the next simulated result.

Record the device, operating-system version, browser or Telegram version, locale, result, and any defect in the issue review notes.
