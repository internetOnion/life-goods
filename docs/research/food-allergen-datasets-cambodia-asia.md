# Food allergen data for ingredient checking in Cambodia and Asia

Date: 2026-09-08

## Executive summary

No complete, authoritative, openly licensed, production-ready dataset was found that maps packaged-food ingredient names to allergen groups, and none was found with adequate Khmer coverage.

Cambodia-specific evidence is especially limited. A systematic Asian review reported no Cambodian food-allergy publications through December 2012, and a 2024 Asia-Pacific review still did not identify a Cambodian prevalence study. The only Cambodia-specific number found was a small consumer survey about shopping considerations; it did not identify allergens and was not a clinical prevalence study. Therefore, a Cambodia-specific ranking cannot currently be defended from public evidence.

For an interim regional model, the strongest Southeast Asian evidence supports prioritizing:

1. crustaceans, especially shrimp, prawn, and crab;
2. fish;
3. egg and milk, particularly for young children;
4. wheat;
5. peanut and the individually named tree nuts;
6. soy;
7. molluscs as a group separate from crustaceans; and
8. sesame as a Codex priority allergen, while noting that Cambodia/SEA prevalence evidence is thin.

This is a prioritization for data coverage, not a population prevalence estimate or a safety ranking. Mango, buckwheat, walnut and pine nut, chickpea and other legumes, edible insects or ant eggs, bird's nest, and galacto-oligosaccharides have regional relevance but should be tracked as extensions rather than silently merged into the core groups.

The best practical solution is a curated, versioned knowledge base assembled from:

- the current Codex labelling standard for the category policy;
- the Open Food Facts allergen taxonomy for initial allergen expressions;
- the Open Food Facts ingredient taxonomy and FoodOn for ingredient names, synonyms, hierarchy, and identifiers;
- WHO/IUIS, FAD, and AllergenOnline for scientific validation of allergenic source organisms and proteins; and
- locally collected Khmer package-label terms reviewed by Cambodian language and food-allergy experts.

Open Food Facts contains real ingredient-to-group expressions such as whey, casein, cheese, and soy lecithin under allergen entries; it is not merely a translation list. However, its mapping is neither complete nor sufficiently explicit about evidence, jurisdiction, exemptions, or ambiguity to be the sole production authority.

## Scope and interpretation

The target question is: **Does this ingredient belong to an allergen group?** This requires three distinct layers:

1. a policy vocabulary defining allergen groups;
2. an ingredient vocabulary defining names, synonyms, parents, and identifiers; and
3. explicit, evidence-backed relationships between ingredients and allergen groups.

These layers should not be collapsed. A scientific relationship, a mandatory labelling obligation, and a clinical risk judgment are different facts.

Evidence types are also not interchangeable:

- skin-prick or serum IgE sensitization is not the same as clinical food allergy;
- self-reported allergy usually overestimates challenge-confirmed allergy;
- anaphylaxis registries describe severe cases, not population prevalence;
- referral-clinic samples are not population samples;
- wheat allergy is not the same condition as coeliac disease or non-coeliac gluten sensitivity; and
- “shellfish” should be represented as at least crustaceans and molluscs, because regulations and clinical patterns distinguish them.

## Step 1: Evidence on relevant allergens

### Cambodia-specific evidence

No public Cambodia population survey, oral-food-challenge study, clinical registry, or downloadable participant-level dataset was found that can rank specific food allergens.

- A 2013 systematic review of food allergy in Asia explicitly included Cambodia in its search and found no Cambodian publications through December 2012. [Lee et al., *Asia Pacific Allergy*](https://pmc.ncbi.nlm.nih.gov/articles/PMC3563019/)
- A 2024 review of food allergy in the Asia-Pacific region still did not identify a Cambodia prevalence study and emphasized the scarcity and heterogeneity of regional evidence. [Leung et al., *Pediatric Allergy and Immunology*](https://onlinelibrary.wiley.com/doi/10.1111/pai.14211)
- A 2018 Cambodian Institute for Research and Rural Development and Consumers International survey interviewed 152 shoppers; 4 respondents, or 2.63%, said that food allergy affecting themselves or family members influenced purchasing. It did not identify allergen groups, verify diagnoses, or estimate clinical prevalence. [Cambodia food-standards consumer survey](https://www.cird.org.kh/images/Food%20Standards%20Consumer%20Survey%20Report-CI-June%202018.pdf)

Cambodia does have general food-labelling infrastructure. Prakas No. 1045 ISC/CS 001-2000 requires ingredient labelling, but the official summary examined here does not enumerate a Cambodia-specific allergen list. The Cambodian consumer-protection authority mentions allergenic substances as an example of label information. These sources should not be treated as proof that a particular foreign allergen list or exemption regime is legally applicable in Cambodia. [Cambodia National Trade Repository](https://cambodiantr.gov.kh/en/document/?title=prakas-no-1045-isc-cs001-2000-labeling-of-food-product), [CCF consumer FAQ](https://www.ccfdg.gov.kh/faq/)

**Conclusion for Cambodia:** use a clearly labelled Southeast Asian proxy for initial coverage, then validate it through local clinical expertise and Cambodian package-label sampling. Do not publish a “most common allergens in Cambodia” ranking from the currently available public evidence.

### Southeast Asian evidence

| Geography and study | Design | Main findings | Production interpretation |
| --- | --- | --- | --- |
| Northern Thailand preschool surveys, 2010 and 2019 | Population surveys of children aged 3–7; questionnaire followed by skin-prick/specific-IgE testing and oral food challenge; 452 and 561 children | Current parent report fell from 9.3% to 5.5%; challenge-confirmed allergy was 1.1% and 0.9%. In 2019 reports, milk was 47%, shrimp 33%, and egg 18%. The five challenge-confirmed cases involved tilapia, shrimp, giant river prawn, milk, and wheat. Shrimp led confirmed cases across the two waves. | Strong SEA signal for crustaceans; fish, milk, egg, and wheat also need coverage. Aggregate article data only. [Study](https://www.worldallergyorganizationjournal.org/article/S1939-4551%2821%2900087-9/fulltext) |
| Bangkok allergy clinic, 2011–2015 | Referral sample of 2,678 allergic patients; sensitization testing and a small oral-challenge subset | Crab was the most frequent sensitization overall. Under age one, egg white was 23.8% and wheat 22.2%; after age ten, shrimp was 25%. Only 29 of 111 oral challenges were positive. | Useful for age and trigger hypotheses, not prevalence. [PDF](https://apjai-journal.org/wp-content/uploads/2022/05/10_AP-210119-0475.pdf) |
| Vietnam preschool children | Survey of 8,620 children aged 2–6 | Of 580 reported cases, crustaceans accounted for 330, or 56.9%, followed by fish, molluscs, beef, milk, and egg. | Large sample but self-reported; supports crustacean priority and separate fish/mollusc categories. [PubMed](https://pubmed.ncbi.nlm.nih.gov/30793379/) |
| Singapore and Philippines schoolchildren | Symptom-history survey of 23,425 children | Convincing shellfish allergy estimates were 1.19% for Singapore ages 4–6, 5.23% for Singapore ages 14–16, and 5.12% in the Philippines. Peanut estimates were 0.43–0.64%, and tree nuts 0.28–0.33%. | Strong regional shellfish signal; symptom history is not challenge confirmation. [PubMed](https://pubmed.ncbi.nlm.nih.gov/20624649/) |
| Malaysian infant cohort | Cohort of 314 infants | Sensitization was highest for beef, peanut, egg, soy, and milk. Allergy defined by immediate symptoms plus specific IgE was 3.2% for egg, 1.0% for milk, 0.6% for wheat, and 0.3% for soy; no oral food challenge was performed. | Supports child-specific egg/milk coverage; sensitization figures should not be used as allergy prevalence. [PDF](https://rcastoragev2.blob.core.windows.net/45660e805a2a2937b1eca7ac0dc9a531/PMC7468944.pdf) |
| Thai adult allergy clinic | Referral sample of 174 adults | Among 150 identified triggers, shellfish accounted for 68%, wheat 28.7%, fruits/vegetables 10%, peanut 4%, soy and fish 2.7% each, and milk 1.3%. | Supports shellfish and wheat prioritization for adults, with substantial referral bias. [PDF](https://apjai-journal.org/wp-content/uploads/2023/07/AP-210223-1548.pdf) |

### Broader Asian evidence

| Geography and study | Design | Main findings | Production interpretation |
| --- | --- | --- | --- |
| Asia-Pacific Research Network for Anaphylaxis, 2019–2022 | 721 pediatric food-anaphylaxis episodes from Thailand, Singapore, Hong Kong, and Qingdao | Under age three, egg accounted for 38% and milk 27%; ages 4–6, tree nuts accounted for 31%; ages 7–11 and 12–17, shellfish accounted for 37% and 44%. | Excellent severity and age-pattern evidence, but not population prevalence. [Study](https://onlinelibrary.wiley.com/doi/full/10.1111/all.16098) |
| Korean anaphylaxis registry | 558 anaphylaxis cases | Among 284 child food cases: egg 25.4%, milk 18%, walnut 9.5%, wheat 8.1%, peanut 4.9%. Among 63 adult food cases: shrimp 22.2%, wheat 19%, crab 6.3%. | Supports child/adult differences and explicit walnut, shrimp, crab, and wheat coverage. [Study](https://www.worldallergyorganizationjournal.org/article/S1939-4551%2820%2930352-5/fulltext) |
| Chongqing infants | 477 infants with challenge-based assessment | Challenge-proven food allergy was 3.8% overall: egg 2.5% and milk 1.3%. | Supports egg and milk as early-childhood priorities. [PubMed](https://pubmed.ncbi.nlm.nih.gov/21265885/) |
| China systematic review and meta-analysis | Heterogeneous studies across China | Pooled estimates reported mango 1.9%, shrimp 1.5%, egg 1.4%, milk 1.3%, and crab 1.3%. | Useful extension signal, especially mango, but heterogeneity limits direct transfer to Cambodia. [PubMed](https://pubmed.ncbi.nlm.nih.gov/37641218/) |

Older and regional syntheses consistently describe shellfish as a leading allergen among older children and adults in several Asian populations, with egg and milk prominent among young children and wheat prominent in Japan, Korea, and some Thai samples. [Asian review](https://pmc.ncbi.nlm.nih.gov/articles/PMC3563019/), [FAO food-allergy guide for Asia](https://openknowledge.fao.org/3/cb4138en/cb4138en.pdf)

### Interim coverage set

Until Cambodia-specific data exists, a package-scanning system should maximize recall for this regional coverage set while keeping the evidence scope visible:

| Priority | Group | Rationale |
| --- | --- | --- |
| 1 | Crustaceans | Repeated SEA population, clinic, and anaphylaxis signals; cover shrimp, prawn, crab, lobster, crayfish, krill. |
| 2 | Fish | Reported across Thailand and Vietnam and included in the Codex global list. |
| 3 | Egg | Prominent in infants and young children across Asian studies. |
| 4 | Milk | Prominent in infants and young children; broad derivative vocabulary is needed. |
| 5 | Wheat | Important in Thai, Korean, Japanese, and child data; represent wheat allergy separately from gluten-related conditions. |
| 6 | Peanut | Lower prevalence than shellfish in several SEA studies but important for severity and included by Codex. |
| 7 | Named tree nuts | Keep individual nuts as subgroups or source ingredients rather than a single uninspectable bucket. |
| 8 | Soy | Evidence is less prominent in SEA clinical allergy than in Western labelling lists, but it remains a relevant regional candidate and common derivative source. |
| 9 | Molluscs | Separate from crustaceans; cover squid, octopus, cuttlefish, clam, oyster, mussel, scallop, and snail. |
| 10 | Sesame | Included in the current Codex global priority list; limited Cambodia/SEA prevalence data should be stated rather than interpreted as absence. |

Rye and barley belong in the Codex gluten-containing-cereal policy vocabulary. Oats are listed by Codex as a regional or national candidate rather than in its global mandatory group. Sulphites are a thresholded additive disclosure issue, not an ingredient-source group like milk or crustaceans.

## Step 2: Structured allergen-classification datasets

### Comparison

| Dataset | Source and access | Format | License | Fields and coverage | Production suitability |
| --- | --- | --- | --- | --- | --- |
| General Standard for the Labelling of Pre-packaged Foods, CXS 1-1985, last modified 2026 | [Codex standards register](https://www.fao.org/fao-who-codexalimentarius/codex-texts/standards/en/) and [current PDF](https://www.fao.org/fao-who-codexalimentarius/sh-proxy/es/?lnk=1&url=https%253A%252F%252Fworkspace.fao.org%252Fsites%252Fcodex%252FStandards%252FCXS%2B1-1985%252FCXS_001e.pdf) | PDF | CC BY-NC 4.0 shown in the current PDF | Normative specified names, global mandatory groups, regional/national candidates, sulphite threshold, and derivative-exemption provision | Best international source for category policy, but not machine-readable. The non-commercial restriction needs legal review for commercial redistribution. Transcribe into a controlled internal vocabulary with exact provision/version provenance. |
| FSA Food Alerts allergen code list | UK Food Standards Agency: [code-list browser](https://data.food.gov.uk/codes/alerts/def/allergen?showStatus=valid), [API reference](https://data.food.gov.uk/food-alerts/ui/reference), [JSON](https://data.food.gov.uk/food-alerts/def/allergens.json), [CSV](https://data.food.gov.uk/food-alerts/def/allergens.csv) | JSON-LD/JSON, CSV, RDF/XML, Turtle through API/content negotiation | [Open Government Licence 3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/) | URI, notation, preferred/alternative labels, descriptions, risk statements, related food types, scheme, and status. Fifteen operational concepts including celery, crustaceans, egg, fish, gluten, lupin, milk, molluscs, mustard, nuts, oats marked gluten-free, peanuts, sesame, soya, and sulphites | Strong machine-readable identifier vocabulary, but UK-specific, the API is beta, and entries are marked experimental. Pin snapshots and do not treat it as Cambodian law or an ingredient map. |
| Open Food Facts allergen taxonomy | [Raw taxonomy](https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/taxonomies/allergens.txt), [compiled JSON](https://static.openfoodfacts.org/data/taxonomies/allergens.full.json), [taxonomy documentation](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/taxonomies/README.md) | Source text; compiled JSON | Open Food Facts database/API data is offered under ODbL, individual database contents under DbCL; repository code is AGPL-3.0. Confirm the precise licence applicable to a redistributed standalone taxonomy. [Reuse terms](https://openfoodfacts.github.io/openfoodfacts-server/api/) | Allergen group IDs, multilingual preferred labels and synonyms, parent relationships, and many direct ingredient expressions under groups | Best public bootstrap for lexical ingredient-to-allergen matching. Not complete, no Khmer entries were found in the current allergen taxonomy, and it lacks adequate evidence, exemption, confidence, and jurisdiction semantics. Not sufficient alone for a high-stakes production decision. |
| FAD, Food Allergen Database, 2026 | [Peer-reviewed description](https://academic.oup.com/database/article/doi/10.1093/database/baag028/8695670), [web server](http://babylone.ulb.ac.be/faddatabase/) | Configurable CSV download and web interface | No clear database redistribution licence was found in the paper or interface; permission must be clarified | 1,168 food allergen proteins and isoallergens; allergen name, common and scientific source names, UniProt/NCBI identifiers, enzyme classification, structural superfamily, allergenic tissue, structures, and epitopes | Valuable for scientific source/protein validation. It is not a packaged-ingredient vocabulary or regulatory group map, and licence uncertainty blocks unreviewed production redistribution. |
| WHO/IUIS Allergen Nomenclature | [Official search](https://allergen.org/) | Searchable web database | No clear bulk-data reuse licence or official bulk CSV/API was found | Accepted allergen name, species/common/scientific source, biochemical name, molecular mass, route, and nomenclature dates | Authoritative scientific nomenclature; use as a validation reference. Not a bulk ingredient-to-group dataset. |
| AllergenOnline v24 | [Database home](https://www.allergenonline.org/), [browse interface](https://www.allergenonline.org/databasebrowse.shtml) | Search/browse interface, sequence search, downloadable report/PDF | Freely accessible; no clear redistribution licence was found | Species, common name, IUIS name, protein type/group, allergenicity, sequence length, accession, GI, and version; 2,372 sequences in 986 taxonomic-protein groups as of 2026-01-26 | Strong annual expert-reviewed sequence reference for biotechnology/protein checks. Not a bulk ingredient lexicon or regulatory group mapping. |
| Food Allergen and Traceability Ontology (FATO) | [Project and RDF/XML](https://gmparg.github.io/FATO/) | OWL/RDF/XML | CC BY 4.0 | Ontology classes and relationships for allergen management, provenance, traceability, and food products | Useful as a semantic modelling reference, but it does not supply a complete ingredient-to-allergen mapping. |
| LanguaL thesaurus | [Downloads](https://www.langual.org/langual_downloads.asp) | Tab-delimited and XML | Copyrighted; reuse conditions should be checked | Hierarchical food-description facets, including a food-allergen labelling facet | Structured but old releases and reuse constraints make it a weak primary choice. It does not provide the needed comprehensive mapping. |

### Recommended category authority

The current Codex standard should define the international baseline. Section 4.2.1.4 identifies these globally mandatory specified sources:

- wheat (*Triticum* species), rye (*Secale* species), barley (*Hordeum* species), and products thereof;
- crustacea;
- egg;
- fish;
- peanut;
- milk;
- sesame; and
- the individually named tree nuts almond, cashew, hazelnut, pecan, pistachio, and walnut.

Section 4.2.1.5 identifies regional or national candidates: buckwheat, celery, oats (*Avena* species), lupin, mustard, soy, Brazil nut, macadamia nut, and pine nut. Section 4.2.1.7 covers sulphites at 10 mg/kg or above. The standard permits competent regional or national authorities to exempt derivatives after risk assessment.

This 2026 Codex structure should replace assumptions based on older “Big 8” lists. It also shows why a dataset needs policy scope and version fields rather than one timeless boolean `is_allergen` value.

## Step 3: Ingredient vocabularies and ingredient-to-allergen mappings

### Open Food Facts allergen and ingredient taxonomies

Open Food Facts is the closest public source to the requested operational mapping.

The allergen taxonomy has explicit group entries and direct ingredient expressions. Examples in the current source include:

- milk: milk, lactose, whey, dairy, butter, buttermilk, cream, yogurt, cheese, milk powder, and milk protein terms;
- soybeans: soy flour, soy lecithin, soy protein isolate, and soy oil terms; and
- gluten: wheat, flour, barley, malt, and related terms.

The separate [ingredient taxonomy source](https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/taxonomies/food/ingredients.txt) and [compiled ingredient JSON](https://static.openfoodfacts.org/data/taxonomies/ingredients.full.json) form a large directed acyclic graph. Entries can contain:

- canonical and multilingual names;
- synonyms;
- parent ingredient relationships;
- Open Food Facts identifiers; and
- external identifiers such as Wikidata, USDA FoodData Central, and CIQUAL on some entries.

Examples include whey as a child of dairy, cheddar as a child of cheese, and derivative subtypes beneath broader ingredients. Khmer names exist sparsely in the ingredient taxonomy, but no `km:` labels were found in the current allergen taxonomy. Coverage and encoding quality require review.

Open Food Facts also warns that ingredient analysis may be imperfect for some languages. [Ingredient-analysis documentation](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/docs/api/tutorials/get-ingredient-related-analysis.md)

**Assessment:** suitable for seeding candidates and powering a reviewed lexicon; unsuitable as the only production authority. Its taxonomy should be snapshotted, hashed, tested, and layered under project-owned review metadata rather than queried live for a safety-sensitive classification.

### FoodOn

[FoodOn](https://github.com/FoodOntology/foodon) is a CC BY 4.0 food ontology available as [OWL](http://purl.obolibrary.org/obo/foodon.owl), with a [synonym table](https://github.com/FoodOntology/foodon/blob/master/foodon-synonyms.tsv).

It provides stable identifiers, labels, synonyms, class hierarchy, taxonomic/anatomical origins, and processing relationships. It is a strong complementary ingredient vocabulary and identifier system. It does not provide a complete regulatory `ingredient -> allergen group` edge set, and its labels are predominantly English.

**Assessment:** suitable as a production vocabulary dependency if its version is pinned and imported with provenance; not sufficient as the relationship authority.

### Product and ingredient-string corpora

These sources can provide real packaged-food strings and validation examples, but not ground-truth ingredient relationships:

- [USDA FoodData Central downloads](https://fdc.nal.usda.gov/download-datasets/) provide CSV and JSON datasets, and the [API](https://fdc.nal.usda.gov/api-guide/) is public-domain/CC0. Branded-food records include food description, brand, GTIN/UPC, and manufacturer-supplied ingredient text. Coverage is largely United States and New Zealand.
- Open Food Facts bulk/API data contains product ingredient text, `ingredients_tags`, and `allergens_tags` under its database reuse terms.
- The FSA Food Alerts API provides recall examples associated with allergen codes.

These sources are useful as parsing and regression-test corpora. Product co-occurrence must not automatically create an ingredient-to-allergen edge: a product may contain several ingredients, a precautionary “may contain” statement, or an incorrect/missing label.

### Scientific validation sources

WHO/IUIS, FAD, and AllergenOnline connect allergenic proteins to source organisms and standardized identifiers. They are valuable when deciding whether a source food or derived ingredient is biologically connected to an allergen. They do not answer labelling obligations, derivative exemptions, residual protein, or the exact language found on a package.

## Step 4: Gap analysis and proposed solution

### What is missing

No source examined simultaneously provides:

- an internationally defensible and jurisdiction-versioned category policy;
- comprehensive packaged-food ingredient names and parent relationships;
- explicit, reviewed ingredient-to-allergen relationships;
- derivative and exemption semantics;
- confidence and provenance per relationship;
- multilingual aliases with adequate Khmer coverage; and
- a licence clearly permitting the whole assembled dataset's intended production use.

The important gap is therefore not just translation. It is the explicit relationship layer and its evidence.

### Recommended source roles

| Role | Recommended source | Why |
| --- | --- | --- |
| Allergen categories | Codex CXS 1-1985 (2026), represented exactly with global versus regional/national status | International food-labelling authority; captures current group names, scope, threshold, and policy structure |
| Machine-readable category IDs | Project-owned stable IDs, cross-walked to the FSA codes where applicable | Avoids making UK policy the global ontology while reusing good linked-data identifiers |
| Ingredient names, synonyms, and hierarchy | Open Food Facts ingredient taxonomy plus FoodOn | Broad packaged-food vocabulary plus stable ontology identifiers and parent relationships |
| Initial ingredient-to-group edges | Open Food Facts allergen taxonomy | Contains actual ingredient expressions and derivatives, making it the most useful public bootstrap |
| Scientific source/protein validation | WHO/IUIS, FAD, and AllergenOnline | Expert-curated organism, protein, nomenclature, and sequence evidence |
| Real package strings and QA corpus | Cambodian labels collected with permission, plus Open Food Facts and FoodData Central | Exercises normalization and compound-ingredient parsing; not relationship truth |
| Khmer names and spelling variants | Local package corpus plus fluent Khmer reviewer and clinical/domain reviewer | Public taxonomy coverage is inadequate; transliteration alone is not reliable |

### Relationship-generation workflow

1. **Freeze the policy scope.** Import the exact Codex edition into project-owned group IDs. Store whether each group is globally mandatory, a regional/national candidate, or thresholded. Add Cambodian legal applicability only after review by a qualified local authority or lawyer.
2. **Import versioned vocabularies.** Snapshot Open Food Facts and FoodOn, retain upstream IDs, source versions, hashes, and licences, and never silently overwrite reviewed local records during updates.
3. **Seed candidate edges.** Convert direct expressions in the Open Food Facts allergen taxonomy into unapproved candidate edges. Add obvious hierarchy-derived candidates such as `cheddar -> cheese -> milk`, `whey -> dairy -> milk`, and `shrimp -> crustacean`.
4. **Validate the source relationship.** Use scientific references to confirm source organism or protein relationships. Record whether the link means `source_food`, `derived_from`, `contains`, or merely `possible_source`.
5. **Review labelling relevance separately.** Determine jurisdiction, date, residual-protein/exemption conditions, and whether the classification is a labelling rule or only a biological relationship.
6. **Curate ambiguity and false positives.** Maintain explicit negative or context rules. Examples include coconut milk not belonging to the milk allergen group, cocoa butter not being dairy butter, and “albumin” needing context. Keep crustaceans separate from molluscs and do not treat “gluten” as identical to wheat allergy.
7. **Curate Khmer aliases.** Extract exact package terms, retain Original Text, associate language/script, and require a fluent reviewer. Do not generate production synonyms only by machine translation.
8. **Test against real labels.** Preserve ingredient-list, “contains,” and “may contain” sections separately. Include compound ingredients, punctuation, E-numbers, negation, “flavour” ambiguity, and OCR errors in a regression corpus.
9. **Return evidence, not a safety verdict.** A match should expose the normalized ingredient, group, relationship, source, confidence/review status, and policy scope. Unknown or Source Data Unavailable must remain unknown rather than become “allergen-free.”

### Cases requiring explicit policy

- `soy lecithin`, highly refined soy oil, highly refined peanut oil, lactose, fish gelatin, and other derivatives may have different labelling treatment by jurisdiction and processing/residual-protein condition.
- “Tree nuts” should retain named source ingredients. Coconut should not automatically inherit that group.
- `milk` inside “coconut milk” or “oat milk” is a lexical token, not evidence of dairy.
- `wheat` may participate in a wheat-allergy classification and a gluten-containing-cereal labelling classification, but those are not interchangeable diagnoses.
- `natural flavour`, `spices`, and similar collective names should be unresolved unless the label or a trusted Source Record gives composition.
- Precautionary statements such as “may contain” represent possible cross-contact and must not be mixed with ingredient membership.

### Proposed normalized schema

```sql
allergen_groups(
  group_id,
  specified_name,
  basis,
  codex_status,
  jurisdiction,
  source_id,
  valid_from,
  valid_to
)

ingredients(
  ingredient_id,
  canonical_name,
  parent_ingredient_id,
  off_id,
  foodon_id,
  wikidata_id,
  scientific_name
)

ingredient_aliases(
  alias_id,
  ingredient_id,
  language,
  script,
  alias,
  normalized_alias,
  source_id,
  review_status
)

ingredient_allergen_edges(
  ingredient_id,
  group_id,
  relationship_type,
  jurisdiction,
  evidence_grade,
  source_id,
  review_status,
  reviewed_by,
  reviewed_at,
  valid_from,
  valid_to
)

negative_match_rules(
  phrase,
  blocked_group_id,
  context_rule,
  reason,
  source_id,
  review_status
)

sources(
  source_id,
  title,
  url,
  version,
  retrieved_at,
  licence,
  content_hash
)
```

Recommended `relationship_type` values are `source_food`, `derived_from`, `contains`, `possible_source`, and `exempted_derivative`. Avoid a single boolean because it cannot represent uncertainty, legal scope, or derivative conditions.

For interchange, export denormalized CSV rows such as:

```csv
ingredient_name,normalized_name,language,allergen_group,parent_ingredient,relationship_type,jurisdiction,evidence_grade,review_status,source_id
cheddar cheese,cheddar cheese,en,milk,cheese,derived_from,international,reviewed,approved,OFF_INGREDIENTS_PLUS_REVIEW
whey,whey,en,milk,milk,derived_from,international,reviewed,approved,OFF_ALLERGENS_PLUS_REVIEW
almond,almond,en,tree_nut:almond,almond,source_food,international,authoritative,approved,CODEX_2026
shrimp,shrimp,en,crustaceans,shrimp,source_food,international,authoritative,approved,CODEX_2026
soy lecithin,soy lecithin,en,soy,soybean,derived_from,unspecified,candidate,needs_jurisdiction_review,OFF_ALLERGENS
```

Aliases should be exported in a separate table rather than a semicolon-delimited cell so that each spelling has its own language, source, and review status.

## Production recommendation

Use the public sources as a curated supply chain, not as a single live lookup dependency:

1. adopt Codex 2026 as the explicit international baseline and record that it is not automatically Cambodian law;
2. create stable project-owned group IDs and a versioned source register;
3. import Open Food Facts and FoodOn into a review workspace;
4. generate but do not auto-approve mapping candidates;
5. require expert review for all group edges and jurisdiction/exemption claims;
6. build Khmer coverage from real Cambodian labels with traceable human review;
7. expose match evidence and uncertainty to the caller; and
8. publish versioned, reproducible CSV/JSON snapshots with licence attribution and change logs.

Because Life Goods currently defines itself as a read-only presentation layer over a static Open Food Facts Dataset Snapshot and explicitly excludes allergen-free or safety verdicts, implementing this knowledge base or displaying new allergen judgments would require an accepted product/specification change. Research and offline evaluation can proceed without presenting the output as a Life Goods assessment.

## Source list

### Standards and public authorities

- [Codex standards register](https://www.fao.org/fao-who-codexalimentarius/codex-texts/standards/en/)
- [Codex CXS 1-1985 current PDF](https://www.fao.org/fao-who-codexalimentarius/sh-proxy/es/?lnk=1&url=https%253A%252F%252Fworkspace.fao.org%252Fsites%252Fcodex%252FStandards%252FCXS%2B1-1985%252FCXS_001e.pdf)
- [WHO: Risk assessment of food allergens, Part 1](https://www.who.int/publications/i/item/9789240042391)
- [FAO food-allergen scientific advice](https://www.fao.org/food-safety/scientific-advice/food-allergens/en)
- [FAO food-allergy guide for Asia](https://openknowledge.fao.org/3/cb4138en/cb4138en.pdf)
- [Cambodia National Trade Repository: Prakas No. 1045](https://cambodiantr.gov.kh/en/document/?title=prakas-no-1045-isc-cs001-2000-labeling-of-food-product)
- [Cambodia CCF consumer FAQ](https://www.ccfdg.gov.kh/faq/)
- [FSA allergen code-list browser](https://data.food.gov.uk/codes/alerts/def/allergen?showStatus=valid)
- [FSA Food Alerts API reference](https://data.food.gov.uk/food-alerts/ui/reference)

### Epidemiology and clinical evidence

- [Lee et al. 2013, food allergy in Asia](https://pmc.ncbi.nlm.nih.gov/articles/PMC3563019/)
- [Leung et al. 2024, Asia-Pacific review](https://onlinelibrary.wiley.com/doi/10.1111/pai.14211)
- [Cambodia 2018 consumer survey](https://www.cird.org.kh/images/Food%20Standards%20Consumer%20Survey%20Report-CI-June%202018.pdf)
- [Northern Thailand preschool surveys](https://www.worldallergyorganizationjournal.org/article/S1939-4551%2821%2900087-9/fulltext)
- [Bangkok allergy-clinic study](https://apjai-journal.org/wp-content/uploads/2022/05/10_AP-210119-0475.pdf)
- [Vietnam preschool study](https://pubmed.ncbi.nlm.nih.gov/30793379/)
- [Singapore and Philippines schoolchild study](https://pubmed.ncbi.nlm.nih.gov/20624649/)
- [Malaysia infant cohort](https://rcastoragev2.blob.core.windows.net/45660e805a2a2937b1eca7ac0dc9a531/PMC7468944.pdf)
- [Thai adult clinic study](https://apjai-journal.org/wp-content/uploads/2023/07/AP-210223-1548.pdf)
- [Asia-Pacific pediatric anaphylaxis registry](https://onlinelibrary.wiley.com/doi/full/10.1111/all.16098)
- [Korean anaphylaxis registry](https://www.worldallergyorganizationjournal.org/article/S1939-4551%2820%2930352-5/fulltext)
- [Chongqing infant study](https://pubmed.ncbi.nlm.nih.gov/21265885/)
- [China systematic review and meta-analysis](https://pubmed.ncbi.nlm.nih.gov/37641218/)

### Machine-readable vocabularies and databases

- [Open Food Facts allergen taxonomy source](https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/taxonomies/allergens.txt)
- [Open Food Facts allergen taxonomy JSON](https://static.openfoodfacts.org/data/taxonomies/allergens.full.json)
- [Open Food Facts ingredient taxonomy source](https://raw.githubusercontent.com/openfoodfacts/openfoodfacts-server/main/taxonomies/food/ingredients.txt)
- [Open Food Facts ingredient taxonomy JSON](https://static.openfoodfacts.org/data/taxonomies/ingredients.full.json)
- [Open Food Facts taxonomy documentation](https://github.com/openfoodfacts/openfoodfacts-server/blob/main/taxonomies/README.md)
- [FoodOn repository](https://github.com/FoodOntology/foodon)
- [FoodOn OWL](http://purl.obolibrary.org/obo/foodon.owl)
- [FoodOn synonym table](https://github.com/FoodOntology/foodon/blob/master/foodon-synonyms.tsv)
- [FAD paper](https://academic.oup.com/database/article/doi/10.1093/database/baag028/8695670)
- [WHO/IUIS allergen nomenclature](https://allergen.org/)
- [AllergenOnline](https://www.allergenonline.org/)
- [FATO](https://gmparg.github.io/FATO/)
- [USDA FoodData Central downloads](https://fdc.nal.usda.gov/download-datasets/)
