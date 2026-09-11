# Assessment of FARE's common-allergen ingredient lists

**Research date:** 2026-09-08  
**Primary page:** [FARE Common Allergens](https://www.foodallergy.org/living-food-allergies/food-allergy-essentials/common-allergens)

## Bottom line

FARE's pages are useful **human-readable seed material** for an English ingredient-to-allergen mapping. They do more than translate allergen names: each supported allergen page includes an avoidance list containing ingredient names, aliases, derivatives, species, and example foods. The pages also contain valuable counterexamples and qualifications.

They are **not a production dataset**:

- the lists are editorial HTML, not a downloadable CSV, JSON, RDF file, database dump, or documented API;
- the entries have no stable identifiers, explicit row-level sources, language tags, parent identifiers, relationship types, confidence values, version history, or machine-readable jurisdiction metadata;
- definite ingredients, possible sources, cross-contact settings, and negative examples are presented in prose and separate page sections rather than as typed records;
- the guidance is primarily for the United States and cites U.S. prevalence and U.S. labeling rules, so it cannot establish what is common in Asia or what Cambodian law requires;
- FARE does not publish these pages under an open-data license. Its [Terms of Use](https://www.foodallergy.org/terms-use) say that FARE provides copyright-permission guidelines on request and directs permission requests to `permissions@foodallergy.org`.

Recommendation: use the pages to identify candidate English terms, ambiguity rules, and test cases. Do not bulk copy or scrape their lists into a redistributed production dataset unless FARE grants suitable permission. Each candidate relationship should be independently verified against sources with appropriate reuse rights and reviewed for the target jurisdiction.

## What the site covers

FARE presents the United States' nine major food allergens: milk, egg, peanut, tree nuts, soy, wheat, fish, shellfish, and sesame. The parent page says those nine cause the majority of reactions, while its subpages repeatedly describe U.S. prevalence and federal label requirements ([parent page](https://www.foodallergy.org/living-food-allergies/food-allergy-essentials/common-allergens); [FARE About Us](https://www.foodallergy.org/about-us)).

For the eight groups selected from the Asian prevalence research, FARE provides dedicated pages for seven. It does not provide a dedicated buckwheat-allergy page or buckwheat ingredient list.

| Target group | Direct FARE page | Ingredient-like entries? | Reaction information? | Assessment |
| --- | --- | --- | --- | --- |
| Milk | [Milk Allergy](https://www.foodallergy.org/living-food-allergy/food-allergy-essentials/common-allergens/milk) | Yes | Yes, at group level | Strong English seed list with useful negatives and exceptions |
| Egg | [Egg Allergy](https://www.foodallergy.org/living-food-allergy/food-allergy-essentials/common-allergens/egg) | Yes | Yes, at group level | Strong English seed list |
| Peanut | [Peanut Allergy](https://www.foodallergy.org/living-food-allergy/food-allergy-essentials/common-allergens/peanut) | Yes | Yes, at group level | Strong seed list, but oil-processing distinctions must be retained |
| Wheat | [Wheat Allergy](https://www.foodallergy.org/living-food-allergies/food-allergy-essentials/common-allergens/wheat) | Yes | Yes, at group level | Strong seed list; explicitly distinguishes wheat allergy from celiac disease |
| Tree nuts | [Tree Nut Allergy](https://www.foodallergy.org/living-food-allergies/food-allergy-essentials/common-allergens/tree-nut) | Yes | Yes, at group level | Useful but mixes biological foods, derivatives, prepared foods, and U.S. regulatory history |
| Crustaceans | [Shellfish Allergy](https://www.foodallergy.org/living-food-allergy/food-allergy-essentials/common-allergens/shellfish) | Yes | Yes, at group level | Useful if crustaceans and mollusks are modeled separately |
| Fish | [Fish Allergy](https://www.foodallergy.org/living-food-allergies/food-allergy-essentials/common-allergens/fish) | Yes | Yes, at group level | Useful species and product seed list |
| Buckwheat | None | No dedicated list | No dedicated profile | Coverage gap; the wheat page only says buckwheat is unrelated to wheat |

FARE's [Other Food Allergens](https://www.foodallergy.org/living-food-allergy/food-allergy-essentials/common-allergens/other-food-allergens) page does not fill the buckwheat gap. A separate older [FARE guide for travel to Japan](https://www.foodallergy.org/media/640/download) mentions buckwheat as a Japanese labeling allergen, but it is a travel guide rather than an ingredient-to-allergen dataset.

## Representative mapping material

The examples below are deliberately representative rather than complete reproductions of FARE's copyrighted lists.

### Milk

The [milk page](https://www.foodallergy.org/living-food-allergy/food-allergy-essentials/common-allergens/milk) provides direct candidate mappings such as:

- butter, buttermilk, cheese, cream, curds, ghee, and yogurt;
- casein, casein hydrolysate, caseinates, and rennet casein;
- lactalbumin, lactoferrin, lactoglobulin, milk protein hydrolysate, whey, and whey protein hydrolysate;
- multiple forms of milk, including condensed, dry, evaporated, powdered, skimmed, and milk solids.

It also supplies valuable negative or qualified examples. Cocoa butter, calcium lactate, lactic acid, sodium lactate, and several lactylates are listed as not containing milk protein, while lactic-acid starter culture is treated differently. These distinctions are exactly why substring matching such as `lact* -> milk` or `butter -> milk` is unsafe.

### Egg

The [egg page](https://www.foodallergy.org/living-food-allergy/food-allergy-essentials/common-allergens/egg) lists candidate egg mappings such as albumin/albumen, apovitellin, lysozyme, ovalbumin, ovomucoid, ovomucin, ovovitellin, mayonnaise, meringue, and forms of egg white or yolk.

It separately says egg is only *sometimes* found in foods or ingredients such as lecithin, pasta, marshmallows, and salad dressings. Those terms must not become unconditional `ingredient -> egg` mappings.

### Peanut

The [peanut page](https://www.foodallergy.org/living-food-allergy/food-allergy-essentials/common-allergens/peanut) gives candidate mappings and aliases including arachis oil, monkey nuts, peanut butter, peanut flour, and peanut protein hydrolysate.

The page distinguishes cold-pressed, expelled, or extruded peanut oils from highly refined peanut oil. It also treats lupin as a possible cross-reactive legume rather than a synonym or derivative of peanut. A production model therefore needs relationship and processing fields; flattening all these entries into `belongs_to=peanut` would misrepresent the source.

### Wheat

The [wheat page](https://www.foodallergy.org/living-food-allergies/food-allergy-essentials/common-allergens/wheat) supplies direct candidates including bulgur, couscous, durum, einkorn, emmer, farina, farro, freekeh, Kamut, semolina, seitan, spelt, triticale, vital wheat gluten, hydrolyzed wheat protein, wheat bran, and wheat germ.

The page explicitly says wheat allergy and celiac disease have different mechanisms. It also says buckwheat is not related to wheat. Accordingly:

- `wheat_allergy` should not be collapsed into a general `gluten` condition;
- `buckwheat` must never map to wheat because of its English name;
- ambiguous terms such as `flour`, `starch`, or `pasta` require composition or label context rather than unconditional mappings.

### Tree nuts

The [tree-nut page](https://www.foodallergy.org/living-food-allergies/food-allergy-essentials/common-allergens/tree-nut) lists individual nuts and aliases, including almond, Brazil nut, cashew, pecan, pistachio, walnut, filbert/hazelnut, macadamia/bush nut, and several pine-nut names. It also lists derived or prepared products such as nut butter, nut meal, nut milk, nut oil, nut paste, marzipan/almond paste, gianduja, and praline.

The page illustrates important modeling problems:

- a group record alone is insufficient because the individual species matters;
- foods such as pesto may contain a tree nut but are not intrinsically tree-nut ingredients in every recipe;
- the page includes coconut in its avoidance list while explaining that coconut is a drupe seed and was treated as a U.S. labeling tree nut only from October 2006 through December 2024;
- processing and protein content matter for oils and other derivatives.

Therefore, use the page as a source of candidates and edge cases, not as a flat canonical taxonomy.

### Crustaceans and mollusks

The [shellfish page](https://www.foodallergy.org/living-food-allergy/food-allergy-essentials/common-allergens/shellfish) explicitly separates:

- crustaceans: examples include crab, crawfish/crayfish, krill, lobster/langouste/langoustine, prawns, and shrimp/crevette;
- mollusks: examples include abalone, clams, cuttlefish, mussels, octopus, oysters, scallops, snails, squid/calamari, and whelk.

That distinction matches the need to model `crustaceans` separately. The page also notes that U.S. federal major-allergen disclosure covers crustacean shellfish, not mollusks. Entries such as fish stock, fish sauce, glucosamine, seafood flavoring, and surimi are presented as possible sources and cannot be promoted to definite crustacean mappings without product-specific evidence.

### Fish

The [fish page](https://www.foodallergy.org/living-food-allergies/food-allergy-essentials/common-allergens/fish) provides species candidates such as anchovy, catfish, cod, halibut, salmon, tilapia, trout, and tuna, plus derived-product candidates such as fish flavoring, fish gelatin, fish oil, and fish sticks.

It explicitly distinguishes finned fish from shellfish. Prepared foods and sauces listed as unexpected sources, such as Caesar dressing or Worcestershire sauce, are not reliable unconditional mappings.

### Buckwheat

The common-allergen collection does not provide a buckwheat-allergy page, aliases, derivatives, or a reaction profile. The wheat page's statement that buckwheat is unrelated to wheat is useful as a negative matching rule, but FARE cannot serve as the mapping source for the `buckwheat` group.

## What “reaction information” means on these pages

FARE does describe reactions for each covered allergen group, generally explaining that IgE recognition of proteins can trigger symptoms ranging from mild manifestations such as hives to severe anaphylaxis. The peanut, tree-nut, shellfish, and fish pages explicitly warn that reactions may be severe or life-threatening. The wheat page also distinguishes IgE-mediated wheat allergy symptoms from autoimmune celiac disease.

This is **group-level education**, not ingredient-level reaction data. The pages do not provide:

- a separate reaction record for each ingredient or derivative;
- reaction incidence, dose thresholds, severity probabilities, or population-stratified outcomes per term;
- a standardized symptom or reaction ontology;
- evidence grades or citations attached to individual ingredient mappings;
- enough data to predict how a particular person will react.

The material should therefore support explanatory text and review, not a rule such as `ingredient X causes reaction Y`.

## Structure and machine readability

The content is delivered as HTML pages with headings, prose, and bullet lists. That makes it technically parseable, but it is not a published machine-readable dataset. No CSV, JSON, Excel, RDF, database dump, or documented allergen-list API is linked from the common-allergen collection or its relevant subpages.

FARE also offers a [Tips for Avoiding Your Allergen](https://www.foodallergy.org/living-food-allergy/food-allergy-essentials/common-allergens/tips-avoiding-your-allergen) resource, but the download requires an account/login and is intended as consumer guidance. It does not solve the need for an openly licensed, structured dataset.

Editorial extraction would also lose semantics unless headings are modeled. At minimum, extracted candidates would need one of these types:

```text
contains_allergen
derived_from_allergen
species_member
alias
possible_source
cross_contact_context
cross_reactive_other_food
does_not_contain_allergen
jurisdictional_exemption_or_exception
```

## Authority and geographic scope

[FARE describes itself](https://www.foodallergy.org/about-us) as a U.S. nonprofit focused on food-allergy research, education, and advocacy, working on behalf of people in the United States. It is a reputable food-allergy education organization, but it is not a government regulator, a standards body, or an Asian public-health authority.

The common-allergen pages rely heavily on:

- U.S. prevalence figures;
- the U.S. Food Allergen Labeling and Consumer Protection Act;
- the U.S. FASTER Act;
- current U.S. FDA labeling guidance.

Consequences for this project:

- FARE is not evidence that these allergens are the most common in Asia or Cambodia;
- U.S. regulatory categories and exemptions must not be presented as Cambodian requirements;
- English ingredient terms and examples may still be useful internationally, but regional foods, Khmer spellings, transliterations, and Cambodian label conventions are absent.

## Copyright and production suitability

The site footer asserts copyright, and the [Terms of Use](https://www.foodallergy.org/terms-use) do not grant an open data or content license. Instead, the terms say FARE provides copyright-permission guidelines upon request and names an email address for permissions. The terms expressly permit text links subject to a linking policy, which is different from permission to copy and redistribute the lists.

| Use | Suitability |
| --- | --- |
| Read by researchers to discover candidate terms | Good |
| Cite or link as supporting consumer guidance | Good, with attribution and normal citation practice |
| Build manual QA examples and ambiguity tests | Good if expressed independently rather than reproducing the list |
| Copy the complete lists into an internal prototype | Rights should be confirmed first |
| Redistribute the lists in an open or commercial dataset | Not suitable without explicit permission or another legal basis |
| Use as the sole production mapping authority | Not suitable |
| Use to rank common allergens in Asia/Cambodia | Not suitable |

This is a source assessment, not legal advice. Before production ingestion or redistribution, obtain FARE's permission or replace each mapping with evidence from an appropriately licensed authoritative source.

### Can we copy the lists into our own dataset?

**Not safely as a straight extraction unless FARE gives permission.** The underlying relationships—such as “whey is derived from milk”—are factual, and U.S. copyright generally does not protect individual facts, names, or short phrases. However, FARE's particular explanatory wording may be protected, and its judgment in selecting and organizing a set of avoidance terms may qualify as protected compilation authorship. The U.S. Copyright Office says that copyright may protect an original selection, coordination, or arrangement of facts even though it does not protect the individual facts themselves ([Automated Databases](https://www.copyright.gov/register/tx-databases.html); [Circular 33](https://www.copyright.gov/circs/circ33.pdf)).

Renaming the columns, converting the bullets to CSV, or adding attribution would not by itself resolve that issue. FARE's terms do not publish an open reuse license; they direct prospective users to request Copyright Permission Guidelines from `permissions@foodallergy.org` ([FARE Terms of Use](https://www.foodallergy.org/terms-use)). Whether a particular extraction is non-infringing is a fact-specific legal question, and this assessment is **not legal advice**.

The practical boundary is:

| Planned use | Recommended decision |
| --- | --- |
| A small, access-controlled prototype used to test the data model | Reasonable only as temporary research material: keep it out of releases, label rows `unlicensed_candidate`, do not reproduce FARE prose, and replace or obtain permission before production. This is risk management, not a conclusion that copying is legally permitted. |
| A public Git repository, downloadable dataset, mobile/web application bundle, or API response | Do not reproduce FARE's curated lists without written permission covering redistribution. |
| A production system that uses the copied list internally but exposes only match results | Still request permission or independently rebuild the mappings. Commercial/internal use is not automatically allowed merely because the source webpage is public. |
| Independently researched factual mappings supported by open or public-domain sources | Preferred. Record the independent source for every row; do not use FARE's ordering, wording, section structure, or complete selection as the template. |

This means the team **can use FARE as a discovery checklist**, but should not call a copied extraction “our dataset.” A safer dataset should be assembled independently from reusable sources, with FARE retained only as a comparison and quality-assurance reference. The result should include independently chosen scope, identifiers, relationship types, exceptions, and provenance rather than mirroring FARE's lists.

### Permission request to FARE

Send the following to `permissions@foodallergy.org` before importing the lists into a distributable or production dataset:

> Subject: Permission request — structured ingredient-to-allergen dataset
>
> Hello FARE Permissions Team,
>
> We are developing Life Goods, a read-only food-package ingredient information system focused on Cambodia and Asia. We would like written permission to extract the ingredient, alternate-name, derivative, “may contain,” and exception entries from FARE's Common Allergens pages and transform them into structured database records.
>
> Please confirm whether FARE grants us a worldwide, non-exclusive, royalty-free right to reproduce, adapt, translate, store, use in software, display, and redistribute those extracted records, including through a public repository, downloadable dataset, application bundle, and API. Please also confirm whether commercial use and sublicensing under **[insert intended dataset license]** are permitted; whether modified and Khmer-translated records may be distributed; the required attribution and notices; whether source links must be displayed per record; and whether there are limits on the amount of material, duration of use, or downstream redistribution.
>
> The records would identify FARE as a source, include the source URL and access/version date, and would not reproduce FARE's explanatory articles, graphics, or medical advice. FARE would not be described as endorsing our product. We can provide the exact fields and a sample export if helpful.
>
> Please send your Copyright Permission Guidelines and confirm whether this proposed use is authorized. If a separate license agreement is required, please let us know.
>
> Thank you,
> [name, organization, contact information]

Replace the bracketed license before sending. If the intended license is not yet known, decide it first: FARE cannot meaningfully approve downstream rights without knowing the redistribution terms. Save FARE's response and any attached guidelines as a Source Record, and encode every restriction in the dataset's distribution policy.

## Recommended way to use FARE

1. Treat each listed term as a **candidate**, not an accepted production row.
2. Preserve the page section and wording category: definite avoidance ingredient, possible source, cross-contact context, negative example, or conditional exception.
3. Verify the candidate against the intended category authority and an openly reusable ingredient vocabulary.
4. Add stable ingredient identifiers and parent relationships from the selected structured source.
5. Attach jurisdiction, processing state, evidence, source URL, source version/access date, and human-review status.
6. Use FARE's negative examples to build false-positive tests, especially `cocoa butter`, `lactic acid`, `calcium lactate`, `carrageenan`, `iodine`, and `buckwheat` versus wheat.
7. Source buckwheat independently; FARE's common-allergen collection does not cover it as an allergen.

A suitable candidate record would look more like this than a two-column mapping:

```csv
ingredient_name,allergen_group,relationship_type,jurisdiction,review_status,source_url
whey,milk,derived_from,US,candidate,https://www.foodallergy.org/living-food-allergy/food-allergy-essentials/common-allergens/milk
cocoa butter,milk,does_not_contain,US,candidate,https://www.foodallergy.org/living-food-allergy/food-allergy-essentials/common-allergens/milk
shrimp,crustaceans,species_member,US,candidate,https://www.foodallergy.org/living-food-allergy/food-allergy-essentials/common-allergens/shellfish
buckwheat,wheat,does_not_contain,US,candidate,https://www.foodallergy.org/living-food-allergies/food-allergy-essentials/common-allergens/wheat
```

The `candidate` status is essential until the relationship has independent evidence and rights suitable for the final dataset.
