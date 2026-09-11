# Life Goods

A Khmer-first context for presenting Open Food Facts product information to people shopping in Cambodia. Life Goods localizes the experience while keeping source data, generated translation, and missing information distinct.

## People and products

**Shopper**:
A Khmer-speaking person using Life Goods to understand packaged-food information while shopping in Cambodia.
_Avoid_: User account, contributor, verifier

**Product**:
The packaged food item a Shopper scans or searches for. Life Goods presents information about a Product but does not own or verify its catalog record.
_Avoid_: Source Record, verified item, Life Goods catalog entry

## Lookup

**Barcode**:
A recognized retail identifier used as the lookup key for a Product. It does not prove authenticity, source-data accuracy, or physical-package identity.
_Avoid_: Product ID, verification code

**Product Lookup**:
A request to find a Source Record for a Barcode in the selected Dataset Snapshot.
_Avoid_: Package Match, verification, identification proof

**Product Search**:
A request to find possible Products matching a Barcode, name, or brand in the selected Dataset Snapshot.
_Avoid_: Live search, external query, catalog search

## Source data

**Source Record**:
An Open Food Facts document that describes a Product. It may be incomplete, inconsistent, multilingual, outdated, or incorrect.
_Avoid_: Product, verified record, Life Goods record

**Dataset Snapshot**:
A dated, immutable export of Open Food Facts Source Records selected for Product Lookup. Selection makes it available to Life Goods but does not verify or synchronize it.
_Avoid_: Live Open Food Facts, current truth, owned catalog

**Source Attribution**:
A visible identification of Open Food Facts as the origin of a Source Record, image, or Source Assessment, including applicable source and licensing links.
_Avoid_: Life Goods endorsement, hidden legal notice

**Source Assessment**:
A score, classification, or interpretation supplied or computed by Open Food Facts. Life Goods may translate and present it but does not verify, recalculate, or adopt it as its own judgment.
_Avoid_: Life Goods score, verified assessment, purchase verdict

**Source Data Unavailable**:
The state in which a field is absent from the Source Record. It says nothing about whether the Product has or lacks the corresponding property.
_Avoid_: None, absent, safe, does not contain

## Language

**Original Text**:
Text retained from the Source Record in its source language and wording.
_Avoid_: Verified label text, normalized translation

**Khmer Translation**:
Machine-generated Khmer text derived from Original Text for display. It is presentation content, not source data or verified label wording.
_Avoid_: Original Text, reviewed source data, assessment input
