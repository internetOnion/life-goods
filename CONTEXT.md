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

**Unmatched Barcode**:
A Barcode that has no Source Record in the selected Dataset Snapshot. It says nothing about whether the Product exists, and it is not a field-level Source Data Unavailable state.
_Avoid_: Source Data Unavailable, unknown product, invalid Barcode, not a real product

## Nutrition Labels

**Nutrition Labels**:
The section where a Shopper reads one Product's label or compares two Products' nutrition labels, from their own photos.
_Avoid_: Label check, verification, scanner

**Read This Label**:
A reading of the printed text and nutrition values from a Shopper's photos of one Product's package, separate from Product Lookup, Product Search, and Source Record data.
_Avoid_: Product Lookup, verification, package match, Source Record

**Label Reading**:
The result of Read This Label for one Product. It is Photo Evidence, not a Source Record or Original Text.
_Avoid_: Source Record, Product information, verified label, transcription

**Compare Nutrition**:
A comparison of the nutrition values printed on two Products' labels, read from photos, separate from Product Lookup, Product Search, and Source Record data. It compares nutrition labels only, not Products as a whole.
_Avoid_: Compare Products, product comparison, photo verification, package match, overall winner, Life Goods score

**Printed Text**:
Text transcribed as printed from a Shopper's label photos, such as ingredients or storage instructions. It is Photo Evidence, not Original Text.
_Avoid_: Original Text, source text, label data

**Printed Allergen Statement**:
Allergen wording printed on a label, such as "Contains" or "May contain", read verbatim as Photo Evidence. When a Label Reading has no statement, that is not evidence that the Product lacks an allergen.
_Avoid_: allergen-free, allergen declaration, verified allergens

**Khmer Rendering**:
Machine-generated Khmer text derived from Printed Text, shown within a Label Reading. It is not Khmer Translation, is not stored, and is not verified label wording.
_Avoid_: Khmer Translation, Original Text, reviewed translation

**Photo Evidence**:
Text and values extracted from a Shopper's label photos for Read This Label or Compare Nutrition. It is not a Source Record or Original Text.
_Avoid_: Source Record, Original Text, verified label

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
_Avoid_: None, absent, safe, does not contain, Unmatched Barcode

## Language

**Original Text**:
Text retained from the Source Record in its source language and wording.
_Avoid_: Verified label text, normalized translation

**Khmer Translation**:
Machine-generated Khmer text derived from Original Text for display. It is presentation content, not source data or verified label wording.
_Avoid_: Original Text, reviewed source data, assessment input
