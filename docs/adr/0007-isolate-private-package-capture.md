---
status: accepted
---

# Isolate private Package Capture from catalog ingestion

Open Food Facts coverage is too sparse to remove photo extraction from the shopper journey, but turning every shopper photo into public catalog evidence creates consent, safety, and moderation risk. The MVP processes Package Capture in an isolated ephemeral store, retains media only for active processing and encrypted recovery for at most 24 hours, and prohibits its use for catalog growth, training, analytics, or manual review. The durable catalog grows through a separate project-owned evidence workflow until contribution is deliberately designed in a later version.
