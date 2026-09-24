---
status: accepted
---

# Telegram Mini App as a second entry point

Many Khmer-speaking Shoppers reach services through Telegram rather than the open web. A Telegram
bot whose **Main Mini App** is enabled appears in the Apps tab of Telegram search, so Shoppers can
find Life Goods where they already are. The question is how to add that entry point without a
second product, and without giving Telegram identity a way into the product boundary.

Three alternatives were considered:

1. **A separate Telegram build or bundle.** This doubles release and QA work and lets the two
   experiences drift apart.
2. **A bot server that validates `initData` and personalises the experience.** This needs a bot
   token on the backend and receives a Telegram user identity. Accounts, personalisation and
   Shopper-level data are outside the product boundary.
3. **Always loading Telegram's SDK.** This adds a third-party script to every ordinary web visit.

## Decision

The production web app **is** the Mini App: one build, one URL. The bot has a Main Mini App
pointing at the production origin and runs no server.

- Telegram's SDK (`https://telegram.org/js/telegram-web-app.js`) is loaded **only** when Telegram
  launched the page (`tgWebApp*` launch parameters, remembered for the session). On the ordinary
  web nothing is loaded.
- Only two values are read, and only on the device: the Telegram interface **language code**
  (English starts in English; everything else starts in Khmer, and a saved choice always wins),
  and a `startapp` value that matches a Barcode (8–14 digits), which opens that Product.
  `initData`, user identity and any other launch data are **never** sent to the backend, logged
  or stored. After the SDK has read the launch parameters, they are removed from the address bar.
- The Mini App uses Telegram's back button, disables swipe-to-close while scrolling, matches
  Telegram's header and background colours, and opens other sites with `openLink`.
- The edge CSP allows `script-src https://telegram.org` and
  `frame-ancestors 'self' https://web.telegram.org` (Telegram Web embeds Mini Apps in an iframe).
  `X-Frame-Options: DENY` is removed because it cannot allow a single site; `frame-ancestors`
  still blocks every other embedder.
- No Telegram Stars payments. Being *featured* in the Mini App Store requires them; being found
  in search does not.

## Consequences

- Live camera scanning is unreliable inside Telegram's in-app browsers on some devices. Telegram's
  native scanner reads QR codes only, not EAN/UPC Barcodes. Reading a Barcode from a photo and
  typed entry remain the fallbacks, and device testing inside Telegram is part of release QA.
- Telegram's script runs inside the Mini App with the page's privileges. This is accepted
  because it only loads when Telegram itself is the host.
- The bot is created and configured by an operator in @BotFather. No bot token is stored in this
  repository or on the backend.
