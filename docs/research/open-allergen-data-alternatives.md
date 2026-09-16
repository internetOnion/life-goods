# Open alternatives to FARE for allergen mapping

Research date: 2026-09-08

## Conclusion

No single open dataset is a complete, authoritative replacement for FARE's editorial pages and a production ingredient-to-allergen mapping table. The strongest legal and technical starting point is a combination:

1. Use the UK Food Standards Agency allergen code list for a machine-readable government category hierarchy.
2. Use Open Food Facts for the broadest existing ingredient-to-allergen mapping seeds and multilingual label terminology.
3. Use FoodOn for stable ingredient identifiers, parent relationships, and synonyms.
4. Use Wikidata only as supplementary multilingual and scientific-identifier enrichment.
5. Model the result with typed relationships and manually review every production mapping, especially derivatives and exemptions.

If Open Food Facts data is incorporated into a derived database, its ODbL attribution and share-alike obligations must be planned from the beginning. A team that needs a more permissively licensed final database should curate the mappings independently from government and CC BY/CC0 sources rather than copying a substantial portion of Open Food Facts.

This is a practical licensing assessment, not legal advice.

## Source comparison

| Source | Machine-readable formats | License | Category definitions | Ingredient names and synonyms | Actual ingredient -> allergen mappings | Recommended use |
| --- | --- | --- | --- | --- | --- | --- |
| [Open Food Facts](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/) | JSON taxonomies, API JSON, CSV/JSONL exports, raw taxonomy text | Database: ODbL 1.0; individual contents: DbCL 1.0; Product Opener source: AGPL-3.0 | Yes | Yes, multilingual | Yes, explicit `allergens:en:` properties exist on ingredient records | Best mapping seed; requires attribution, ODbL planning, and quality review |
| [UK Food Standards Agency allergen codes](https://data.food.gov.uk/food-alerts/def/allergens.html?_sort=label) | CSV, JSON, RDF, XML | [Open Government Licence 3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) | Yes, with identifiers and broader/narrower links | A limited number of examples and alternative labels | Partial only; for example almond -> nuts and barley -> gluten | Government category backbone, not an exhaustive mapping table |
| [FoodOn](https://github.com/FoodOntology/foodon) | OWL/RDF and [synonyms TSV](https://raw.githubusercontent.com/FoodOntology/foodon/master/foodon-synonyms.tsv) | [CC BY 4.0](https://raw.githubusercontent.com/FoodOntology/foodon/master/LICENSE.txt) | Food hierarchies and definitions, but not a regulatory allergen list | Yes, with stable FoodOn IDs | No comprehensive turnkey mapping | Ingredient vocabulary, parents, scientific grounding, and identifiers |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Licensing) | SPARQL results, JSON/RDF dumps | CC0 for structured data | Community-contributed | Multilingual labels, aliases, taxonomy links, and identifiers | Incomplete and inconsistent | Optional enrichment; never sole production authority |
| [FATO](https://gmparg.github.io/FATO/) | RDF/XML and Turtle | CC BY 4.0 | Defines an allergen-management ontology | Defines ingredient concepts and relations | No large populated mapping dataset | Useful schema reference, not source rows |

## Why Open Food Facts is the closest match

The Open Food Facts ingredient taxonomy contains explicit allergen properties rather than only translations. Examples in the official taxonomy include peanut oil mapped to peanuts, sesame oil mapped to sesame, celery flavouring mapped to celery, and soy protein mapped to soybeans. Its separate allergen taxonomy also groups ingredient expressions such as milk, whey, butter, cream, yoghurt, and cheese under milk.

Primary files:

- [Compiled allergens JSON](https://static.openfoodfacts.org/data/taxonomies/allergens.full.json)
- [Compiled ingredients JSON](https://static.openfoodfacts.org/data/taxonomies/ingredients.full.json)
- [Raw allergen taxonomy](https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/taxonomies/allergens.txt)
- [Raw ingredient taxonomy](https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/taxonomies/food/ingredients.txt)
- [Product ingredient and allergen schema](https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_ingredients/)

Limitations:

- It is community-maintained rather than a clinical or regulatory authority.
- Some entries mix allergy, intolerance, labeling rules, and ordinary parent-child relations.
- Derivatives such as refined oils need jurisdiction-aware exemption handling.
- Missing data is unknown, not evidence that an ingredient or product is allergen-free.
- The allergen taxonomy currently has no Khmer (`km:`) entries. The much larger ingredient taxonomy has some Khmer labels, but coverage and correctness require fluent human review.
- Open Food Facts documents its database as ODbL/DbCL, while the raw taxonomy source lives in its AGPL-licensed server repository. For a redistributed standalone taxonomy, retain exact provenance and ask `reuse@openfoodfacts.org` if the applicable licensing path is unclear.

## Government category sources for Asian scope

The FSA list is structurally useful but reflects UK rules. For an Asian extension, Japan's Consumer Affairs Agency is a strong official source: its allergen-labelling material identifies shrimp, crab, walnut, wheat, buckwheat, egg, dairy products, and peanut as mandatory specified ingredients, with additional recommended items such as soybean, sesame, fish species, almonds, cashew, and macadamia.

- [Japan CAA allergen-labelling page](https://www.caa.go.jp/en/policy/food_labeling/)
- [Japan CAA allergen-labelling PDF](https://www.caa.go.jp/en/policy/food_labeling/pdf/food_labelling_cms203_200410_01.pdf)
- [Government of Japan Public Data License](https://www.digital.go.jp/en/resources/open_data/public_data_license_v1.0)

The CAA material is authoritative for Japanese labeling scope but is a PDF, not a ready ingredient mapping dataset. Confirm the terms applied to each CAA resource and preserve attribution.

## Recommended build

Create separate tables rather than one ambiguous synonym list:

### `allergen_groups`

Use project-owned stable IDs and store the jurisdiction and evidence source.

```csv
allergen_group_id,preferred_name,jurisdiction,authority,source_url,source_version
milk,milk,asia_research,project_curated,URL,DATE
buckwheat,buckwheat,japan,Japan CAA,URL,DATE
```

### `ingredients`

Use FoodOn and Open Food Facts identifiers where available, with aliases stored per language.

```csv
ingredient_id,preferred_name,parent_ingredient_id,language,external_ids,source_url
```

### `ingredient_allergen_relations`

Do not reduce every relationship to a boolean. Record what is known and why.

```csv
ingredient_id,allergen_group_id,relationship,status,jurisdiction,evidence_source,reviewed_by,reviewed_at
```

Suggested `relationship` values include `source_food`, `derived_from`, `contains`, `species_member`, `possible_source`, and `exempted_derivative`. Suggested `status` values include `confirmed`, `candidate`, `rejected`, and `unknown`.

Maintain explicit negative matching rules such as `coconut milk` not meaning milk, `cocoa butter` not meaning milk, and `buckwheat` not meaning wheat. Keep label-declared ingredients, `contains` declarations, and precautionary `may contain` statements separate.

## Sources to avoid as production authorities

- Small Kaggle allergen datasets may have permissive labels such as CC0 but usually lack authoritative row-level provenance and nuanced relationship types.
- The public-domain `food-allergens-ch` package warns that some third-party source rights are unclear; its own README advises commercial/public users to check original restrictions.
- Protein databases and allergen nomenclature registries identify allergenic proteins but do not directly answer whether packaged-food ingredient strings such as `cheddar`, `whey`, or `prawn paste` belong to a label allergen group.

