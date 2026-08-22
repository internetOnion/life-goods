---
status: accepted
---

# ADR 0003: Mobile Web and Telegram Mini App Architecture

## Context
Telegram is the single most pervasive messaging and daily digital utility platform in Cambodia across all demographics. Requiring app store downloads introduces unnecessary friction and storage barriers. Building two separate codebases (standalone app vs. Telegram bot) would duplicate effort and maintenance.

## Decision
We build a unified, responsive **Mobile Web Application** designed to operate simultaneously as:
1. A standalone Web Client accessed via mobile browser / QR codes.
2. A **Telegram Mini App (TMA)** embedded seamlessly inside Telegram with native Telegram WebApp SDK support for haptic feedback and user context.

Both targets share identical backend REST APIs, camera scanning capabilities, state management, and UI components.

The MVP requires internet access in both targets. Offline launch and Offline Market Mode are deferred.

## Consequences
- UI layout must be strictly mobile-first with safe-area insets tailored for both standalone mobile browsers and Telegram WebApp viewports.
- Telegram-specific features (e.g. Telegram haptics, theme synchronization) will be activated progressively when `window.Telegram?.WebApp` is detected.
