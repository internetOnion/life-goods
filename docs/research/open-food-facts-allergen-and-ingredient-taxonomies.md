# Open Food Facts allergen and ingredient taxonomies

Research date: 2026-09-08

## Summary

The two URLs are not product datasets. They are human-maintained source files for two Open Food Facts multilingual taxonomies:

- `allergens.txt` is primarily a compact normalization vocabulary for allergen and trace declarations. Its entries group many label expressions under broad canonical IDs.
- `food/ingredients.txt` is a much larger ingredient vocabulary and directed acyclic graph (DAG). It supplies names, synonyms, parent relationships, analysis properties, and links to external food datasets.

Open Food Facts compiles these text sources into JSON and internal lookup structures used to normalize product fields and parse ingredient text. The raw files are useful for review and contribution, but the generated JSON is easier and safer to consume programmatically. The current runtime `ingredients` taxonomy is broader than `food/ingredients.txt` because the build also merges additives, additive classes, minerals, vitamins, nucleotides, and other nutritional substances. [Taxonomy overview](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/taxonomies/README.md), [build implementation](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Tags.pm)

## Shared text format

Entries are separated by blank lines. Comments begin with `#`. A simplified entry looks like this:

```text
< en:oil and fat
< en:soybean product
en:soya oil, soybean oil, soy oil
fr:huile de soja
allergens:en: en:soybeans
vegan:en: yes
wikidata:en: Q210742
```

The parser gives the lines these meanings:

| Form | Meaning |
| --- | --- |
| `en: preferred name, synonym, ...` | A localized preferred display name followed by direct synonyms. The first ordinary language row in a block determines the canonical ID. Other language rows in the block are translations of the same concept. |
| `< en:parent name` | A direct parent. Repeated parent rows create multiple inheritance, so this is a DAG rather than necessarily a tree. |
| `property:en: value` | Open-ended, language-qualified metadata attached to the current entry, such as `description`, `wikidata`, `vegan`, or `allergens`. |
| `stopwords:en: ...` | Words or phrases removed during normalization and matching. These are global parsing rules, not entries. |
| `synonyms:en: ...` | Global substitution-only synonyms used to expand matching; they do not create taxonomy nodes. |

Canonical IDs are generated rather than assigned as opaque identifiers. The parser normalizes the first preferred name in a block—lowercasing it and converting separators to hyphens, with language-specific accent rules—then prefixes the source language, for example `en:soybeans`. The first row can be non-English, so the ingredient taxonomy also contains IDs such as `fr:fructose-de-ble`. These IDs are useful Open Food Facts keys, but they should not be assumed immutable if a canonical label or block ordering changes. The official API schema describes canonical taxonomy tags as a language prefix plus normalized canonical name. [Parser and identifier rules](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Tags.pm), [canonical tag schema](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/ref/schemas/tags/taxonomy_tag_entry.yaml)

The compiler emits several representations:

- `*.json` contains canonical IDs, localized names, hierarchy, and properties, but omits direct synonyms and Wikipedia content.
- `*.full.json` adds direct multilingual synonyms and Wikipedia content.
- `*.extended.json` adds normalized and generated synonym expansions intended for matching.

This is not CSV: commas delimit synonyms, escaped commas are supported, blank lines are structural, and property values are not governed by one fixed tabular schema. A CSV-style parser will lose information. [Compiler source](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Tags.pm)

## `allergens.txt`

### What it contains

The current source has 27 canonical entries and no parent relationships: it is flat even though the taxonomy system supports a DAG. The entries are:

- `en:none`;
- 14 broad entries: gluten, crustaceans, eggs, fish, peanuts, soybeans, milk, nuts, celery, mustard, sesame seeds, sulphur dioxide and sulphites, lupin, and molluscs; and
- 12 entries with only English and Japanese names: red caviar, orange, kiwi, banana, peach, apple, beef, pork, chicken, yamaimo, gelatin, and matsutake.

Most of its value is lexical normalization. For example, the `en:milk` block includes expressions such as lactose, whey, dairy, butter, cream, yogurt, cheese, milk powder, and milk protein as synonyms of the same broad allergen ID. Likewise, almond, hazelnut, walnut, cashew, pecan, pistachio, macadamia, and other expressions are synonyms under `en:nuts`, not child nodes with their own identities. Nine entries have Wikidata properties. [Pinned allergen source](https://github.com/openfoodfacts/openfoodfacts-server/blob/777c29358e2346be7fa61890cd37303967b44823/taxonomies/allergens.txt), [compiled full JSON](https://static.openfoodfacts.org/data/taxonomies/allergens.full.json)

### How Open Food Facts uses it

Open Food Facts uses this taxonomy to canonicalize user-entered `allergens` and `traces`, construct language-specific matching expressions, parse declarations in ingredient text, and produce fields such as `allergens_tags`, `traces_tags`, and allergen-highlighted ingredient text. The server build treats `traces` as a copy of the allergen taxonomy. [Ingredient processing](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Ingredients.pm), [product ingredient schema](https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_ingredients/), [taxonomy build implementation](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Tags.pm)

The `en:none` entry is only a canonical value for inputs such as “none” or “without allergens.” It is not proof that a Product is allergen-free. The source also embeds assumptions that can be jurisdiction- and threshold-dependent; for example, comments around sulphites discuss a 10 ppm threshold and whether additive names should match. This makes the file a parser vocabulary, not a regulatory or clinical authority. [Pinned allergen source](https://github.com/openfoodfacts/openfoodfacts-server/blob/777c29358e2346be7fa61890cd37303967b44823/taxonomies/allergens.txt)

### Current point-in-time statistics

These figures were computed from the bytes served by the supplied `main` URL on 2026-09-08 and verified against the latest commit touching that path:

| Measure | Value |
| --- | ---: |
| Raw lines | 585 |
| Raw bytes | 75,121 |
| SHA-256 | `6de0efa719eb65bc32d007989fa8710d19a5fa5549362efc9669e9a8b67a17fc` |
| Canonical entries in generated full JSON | 27 |
| Direct parent edges | 0 |
| Language keys in generated names | 38 |
| Direct synonym strings in generated full JSON, including preferred forms | 4,859 |
| Wikidata mappings | 9 |
| Khmer (`km`) names | 0 |

The latest path commit at capture time was [`777c293`](https://github.com/openfoodfacts/openfoodfacts-server/commit/777c29358e2346be7fa61890cd37303967b44823), dated 2026-09-07. The raw file contains `nl_be:` rows, but the generated JSON does not contain an `nl_be` language key because the current compiler recognizes two-character language codes. This is an example of why generated output should be checked rather than assuming every raw row is active. [Generated allergen JSON](https://static.openfoodfacts.org/data/taxonomies/allergens.full.json), [compiler source](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Tags.pm)

## `food/ingredients.txt`

### What it contains

This file is an ingredient ontology-like vocabulary, not a collection of ingredient lists from individual Products. The current raw source contains 5,605 label-bearing definition blocks and 6,070 direct-parent rows. Of those blocks, 5,342 have a parent, 263 have no parent, 711 have multiple parents, and the maximum is three direct parents. Those counts describe the raw file; build-time merging and canonicalization can change the runtime node set.

The header documents important property families:

- `allergens` links an ingredient to a canonical value from `allergens.txt`;
- `nova`, `vegan`, `vegetarian`, and `from_palm_oil` support Open Food Facts ingredient analyses;
- `density_g_per_ml` and unit-weight properties support quantity estimation;
- `description`, `comment`, `wikidata`, `wikipedia`, and scientific/species fields add explanatory or linked data; and
- CIQUAL, USDA NDB/FoodData Central, IFCT, Eurocode, Agribalyse, and Ecobalyse properties connect some entries to external classifications or calculations.

Properties are sparse. They are not columns populated for every ingredient, and some are explicitly documented as proxies rather than exact matches. [Pinned ingredient source and header](https://github.com/openfoodfacts/openfoodfacts-server/blob/7f6ca3180f4b999f0258e8ce70eaccef3dd241c5/taxonomies/food/ingredients.txt)

### Relationship to the allergen taxonomy

There are 74 direct `allergens:en:` property rows in the current raw ingredient file, referencing 13 allergen IDs: celery, crustaceans, eggs, fish, gluten, lupin, milk, molluscs, mustard, nuts, peanuts, sesame seeds, and soybeans. Examples include soy lecithin to `en:soybeans`, fish gelatin to `en:fish`, celery salt to `en:celery`, and peanut oil to `en:peanuts`.

This is a genuine cross-taxonomy link, and the server can inherit the property through ingredient parents. When canonicalizing an allergen expression, it first tries the allergen taxonomy; if that fails, it tries the ingredient taxonomy and its inherited `allergens:en` property. That function currently supports only one allergen for a single ingredient: if a property contains several values, it warns and uses the first. [Ingredient-to-allergen canonicalization](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Tags.pm#L4570-L4628)

This does not turn the combination into a complete safety model. The relationship has no required fields for jurisdiction, concentration, exemption, evidence, confidence, or effective date. Parent-property inheritance can also be subtle in a multi-parent DAG; the parser source itself warns that its general inherited-property algorithm may not behave as expected where branches rejoin. [Property inheritance implementation](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Tags.pm)

### Runtime build is larger than this file

For food, Open Food Facts constructs the runtime `ingredients` taxonomy by concatenating, in order, additive classes, additives, minerals, vitamins, nucleotides, other nutritional substances, and finally `food/ingredients.txt`. Therefore:

- the raw source has 5,605 definition blocks;
- the current official `ingredients.full.json` has 6,455 canonical nodes; and
- consumers that import only the supplied raw file will not reproduce Open Food Facts runtime recognition.

The compiler also derives all-parent and child lookups and adds parents to `ingredients_tags`. [Build implementation](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Tags.pm), [ingredient tag computation](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/lib/ProductOpener/Ingredients.pm), [compiled ingredients full JSON](https://static.openfoodfacts.org/data/taxonomies/ingredients.full.json)

### Current point-in-time statistics

These figures were computed from the bytes served by the supplied `main` URL on 2026-09-08 and verified against the latest commit touching that path:

| Measure | Raw `food/ingredients.txt` | Generated runtime `ingredients.full.json` |
| --- | ---: | ---: |
| Lines | 98,373 | n/a (minified JSON) |
| Bytes | 2,753,273 | 6,571,364 |
| SHA-256 of raw file | `35dbb13ca71707be38730cf189fc831298f63d8574330cf9cd8b6d49ba4c7f8a` | not recorded |
| Definition blocks / canonical nodes | 5,605 | 6,455 |
| Direct parent rows / edges | 6,070 | 6,306 |
| Root blocks / nodes | 263 | 884 |
| Entries with direct `allergens` property | 74 | 74 |
| Distinct two-character name-language codes | 192 | 192 |
| Khmer (`km`) label rows / nodes | 30 | 35 |
| Property rows / distinct property names | 11,120 / 105 | generated object properties vary |

The latest path commit at capture time was [`7f6ca31`](https://github.com/openfoodfacts/openfoodfacts-server/commit/7f6ca3180f4b999f0258e8ce70eaccef3dd241c5), dated 2026-09-08. These values are volatile because `main` and the published generated files are updated independently.

Khmer coverage is both tiny and unreliable. The raw source has only 30 `km:` label rows, while the merged generated taxonomy has 35 Khmer-named nodes out of 6,455. Several raw values tagged `km` are visibly written in other scripts, including Arabic-derived and Kannada text. The taxonomy cannot serve as a trusted Khmer translation source without fluent review and data-quality validation. [Pinned ingredient source](https://github.com/openfoodfacts/openfoodfacts-server/blob/7f6ca3180f4b999f0258e8ce70eaccef3dd241c5/taxonomies/food/ingredients.txt)

## Maintenance and provenance

The files are maintained collaboratively in the `openfoodfacts-server` repository. Open Food Facts also provides a Taxonomy Editor for searching, navigating, translating, and finding structural gaps. A repository linter validates taxonomy changes. Builds hash the parser version plus all source files, reuse local or GitHub-hosted cached artifacts when possible, and regenerate result text and the three JSON variants when inputs change. [Taxonomy Editor](https://github.com/openfoodfacts/taxonomy-editor), [taxonomy linter](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/scripts/taxonomies/lint_taxonomy.pl), [build cache documentation](https://openfoodfacts.github.io/documentation/docs/Product-Opener/dev/explain-taxonomy-build-cache/)

Provenance is mixed. The taxonomy is community-curated by Open Food Facts, while individual ingredient properties point to upstream sources such as Wikidata, Wikipedia, CIQUAL, USDA, FAO density data, IFCT, Agribalyse, and Ecobalyse. A linked identifier does not establish that the mapping is current, exact, complete, or reviewed for Life Goods' use case.

Licensing needs care. The `openfoodfacts-server` repository declares AGPL-3.0 for the server software, while Open Food Facts states that its database is under ODbL and individual database contents are under DbCL. The taxonomy files have no file-specific license header that resolves which regime governs redistribution of a standalone taxonomy extract. Preserve exact source attribution and commit/hash provenance, follow the Open Food Facts reuse terms for data use, and ask `reuse@openfoodfacts.org` if standalone redistribution or creation of a derived taxonomy database is planned. This is a licensing caution, not legal advice. [Server repository](https://github.com/openfoodfacts/openfoodfacts-server), [official API and reuse notice](https://openfoodfacts.github.io/openfoodfacts-server/api/)

Open Food Facts explicitly warns that its voluntarily supplied data is not assured to be accurate, complete, or reliable. Its ingredient-analysis documentation also describes language-dependent parsing limitations. Taxonomy matches must therefore be treated as source-derived normalization or analysis, not verified facts. [Official API introduction](https://openfoodfacts.github.io/openfoodfacts-server/api/), [ingredient-analysis documentation](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/tutorials/get-ingredient-related-analysis.md)

OCR adds a separate uncertainty boundary before taxonomy matching. Open Food Facts says that incorrect OCR or ordinary text typos can leave ingredients unrecognized, asks applications to present OCR output for human review, and evaluates its own spell-correction model by balancing correction recall against false positives. A downstream dataset should therefore preserve the Original Text and matched span, allow multiple candidates, and keep unmatched or ambiguous text unknown instead of silently correcting it. [OCR and ingredient-analysis flow](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/tutorials/get-ingredient-related-analysis.md), [Robotoff ingredient spellcheck](https://openfoodfacts.github.io/robotoff/references/ingredients-spellcheck/)

## Implications for Life Goods

1. **Snapshot the taxonomies with the Dataset Snapshot.** Record the raw commit SHA, retrieval time, SHA-256, compiler/build version, and hashes of generated artifacts. Do not read `main` or the live static JSON at request time.
2. **Keep source/runtime versions compatible.** A Product Dataset Snapshot may have been processed using an older taxonomy. Applying today's taxonomy to historical `ingredients_tags` or `allergens_tags` can change names, parents, and matches without the Source Record changing.
3. **Prefer generated artifacts for runtime lookup.** They reflect Open Food Facts' parsing and merged ingredient inputs. Preserve the raw files alongside them for auditability. Validate that the static generated artifact was built from the pinned sources before activation.
4. **Do not recompute source truth silently.** Present Source Record `allergens_tags`, `traces_tags`, and ingredient analyses as Open Food Facts source data or Source Assessments. If Life Goods later derives new fields with a pinned taxonomy, label them separately with their method and version.
5. **Missing remains unknown.** No taxonomy match, no `allergens` property, or `en:none` must never become an allergen-free, health, safety, Halal, legal, or purchase verdict.
6. **Do not use taxonomy Khmer as the public translation layer.** Allergen Khmer coverage is absent; ingredient Khmer coverage is sparse and includes obvious script errors. The specified on-demand Khmer Translation plus accessible Original Text remains necessary.
7. **Treat IDs as provider identifiers, not permanent domain keys.** Store the canonical Open Food Facts ID together with the taxonomy version and retain external identifiers only as attributed cross-references.

These constraints align with Life Goods' role as a read-only presentation layer: the taxonomies can improve display and navigation, but they do not verify the Source Record or transfer Open Food Facts' judgments to Life Goods.
