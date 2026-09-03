import type {
    LearnCategory,
    LearnEntry,
    LearnFact,
    LocalizedText,
} from "./types"

const approved = "approved" as const
const codexDisclosure = {
    km: "នេះជាឯកសារយោងអន្តរជាតិ មិនមែនជាសេចក្តីសន្និដ្ឋានអំពីច្បាប់កម្ពុជា ឬ Product ណាមួយទេ។",
    en: "This is an international reference, not a conclusion about Cambodian law or any Product.",
}

function makeEntry(
    id: string,
    slug: string,
    category: LearnCategory,
    title: LocalizedText,
    body: LocalizedText,
    doesNotImply: LocalizedText,
    sourceId: string,
    section: string,
    facts?: LearnFact[],
): LearnEntry {
    return {
        id,
        slug,
        category,
        title,
        summary: {
            km: `${body.km.split("។").at(0) ?? body.km}។`,
            en: `${(body.en.split(". ").at(0) ?? body.en).replace(/\.$/, "")}.`,
        },
        body,
        facts,
        doesNotImply,
        sourceRefs: [{ sourceId, section }],
        relatedEntryIds: [],
        reviewState: approved,
    }
}

export const LEARN_ENTRIES: LearnEntry[] = [
    makeEntry(
        "LABEL_001",
        "name-of-the-food",
        "label",
        { km: "ឈ្មោះផលិតផល", en: "Name of the food" },
        {
            km: "ឈ្មោះផលិតផលត្រូវបង្ហាញប្រភេទពិតប្រាកដនៃអាហារ មិនមែនត្រឹមតែឈ្មោះម៉ាក ឬឈ្មោះពាណិជ្ជកម្មនោះទេ។ ប្រសិនបើមានឈ្មោះដែលបានកំណត់ក្នុងស្តង់ដារ ឬច្បាប់ជាតិ ត្រូវប្រើឈ្មោះនោះ។",
            en: "The name must indicate the food’s true nature, not only a brand or trade name. A name established by a Codex standard or national legislation should be used where applicable.",
        },
        {
            km: "ឈ្មោះម៉ាកតែមួយមិនប្រាប់ប្រភេទពិតប្រាកដនៃអាហារទេ។",
            en: "A brand name alone does not establish the food’s true nature.",
        },
        "codex-label-2026",
        "Section 4.1",
    ),
    makeEntry(
        "LABEL_002",
        "list-of-ingredients",
        "label",
        { km: "បញ្ជីគ្រឿងផ្សំ", en: "List of ingredients" },
        {
            km: "លើកលែងតែអាហារដែលមានគ្រឿងផ្សំតែមួយ គ្រប់អាហារដែលវេចខ្ចប់ទុកជាមុនត្រូវមានបញ្ជីគ្រឿងផ្សំ។ គ្រឿងផ្សំត្រូវរាយតាមលំដាប់បរិមាណពីច្រើនទៅតិច នៅពេលផលិត។",
            en: "Except for single-ingredient foods, pre-packaged food must declare an ingredient list. Ingredients are listed in descending order by their incoming weight at manufacture.",
        },
        {
            km: "បញ្ជីនេះមិនចាំបាច់រាប់រាល់សំណល់តិចតួច ឬជំនួយក្នុងការកែច្នៃទាំងអស់ទេ។",
            en: "The list does not necessarily include every possible trace or processing aid.",
        },
        "codex-label-2026",
        "Sections 4.2.1 and 4.2.5",
    ),
    makeEntry(
        "LABEL_003",
        "net-contents",
        "label",
        { km: "បរិមាណសុទ្ធ", en: "Net contents" },
        {
            km: "បរិមាណសុទ្ធត្រូវបង្ហាញជាលេខ ជាមួយឯកតាម៉ែត្រ ដូចជា g, kg, ml ឬ L។ សម្រាប់អាហាររាវ ត្រូវប្រើមាឌ ចំណែកអាហាររឹង ត្រូវប្រើទម្ងន់។",
            en: "Net contents are declared numerically in metric units. Liquid food is normally declared by volume and solid food by weight.",
        },
        {
            km: "បរិមាណសុទ្ធមិនស្មើនឹងចំនួនដងបរិភោគ ឬតម្លៃអាហារូបត្ថម្ភទេ។",
            en: "Net contents are not the number of servings or a nutritional value.",
        },
        "codex-label-2026",
        "Section 4.3",
    ),
    makeEntry(
        "LABEL_004",
        "responsible-party",
        "label",
        {
            km: "ឈ្មោះ និងអាសយដ្ឋានអ្នកទទួលខុសត្រូវ",
            en: "Responsible party name and address",
        },
        {
            km: "ស្លាកត្រូវបង្ហាញឈ្មោះ និងអាសយដ្ឋានរបស់អ្នកផលិត អ្នកវេចខ្ចប់ អ្នកចែកចាយ អ្នកនាំចូល អ្នកនាំចេញ ឬអ្នកលក់។",
            en: "The label should show the name and address of the manufacturer, packer, distributor, importer, exporter, or vendor.",
        },
        {
            km: "អ្នកនាំចូលមិនមែនតែងតែជាអ្នកផលិតទេ។",
            en: "The importer is not necessarily the manufacturer.",
        },
        "codex-label-2026",
        "Section 4.4",
    ),
    makeEntry(
        "LABEL_005",
        "country-of-origin",
        "label",
        { km: "ប្រទេសដើមកំណើត", en: "Country of origin" },
        {
            km: "ប្រទេសដើមកំណើតត្រូវបង្ហាញ ប្រសិនបើការមិនបង្ហាញអាចធ្វើឱ្យអ្នកប្រើប្រាស់ច្រឡំ។ ប្រសិនបើអាហារត្រូវបានកែច្នៃនៅប្រទេសទីពីរ ប្រទេសនោះអាចចាត់ទុកជាប្រទេសដើមកំណើតសម្រាប់ស្លាក។",
            en: "Country of origin must be declared when omission could mislead. Processing in a second country may make that country the origin for labelling purposes.",
        },
        {
            km: "លេខបុព្វបទបាកូដមិនមែនជាប្រទេសដើមកំណើតទេ។",
            en: "A barcode prefix does not establish country of origin.",
        },
        "codex-label-2026",
        "Section 4.5",
    ),
    makeEntry(
        "LABEL_006",
        "lot-identification",
        "label",
        { km: "លេខឡូត ឬលេខបាច់ផលិត", en: "Lot identification" },
        {
            km: "គ្រប់កញ្ចប់ត្រូវមានលេខឡូត ឬលេខបាច់ផលិត ដើម្បីសម្គាល់ក្រុមផលិតផលដែលផលិតក្រោមលក្ខខណ្ឌស្រដៀងគ្នា។",
            en: "Each container should carry an identifying code for the lot: a quantity produced under essentially the same conditions.",
        },
        {
            km: "លេខឡូតមិនមែនជាកាលបរិច្ឆេទផុតកំណត់ ឬបាកូដទេ។",
            en: "A lot code is not an expiry date or a barcode.",
        },
        "codex-label-2026",
        "Section 4.6",
    ),
    makeEntry(
        "LABEL_007",
        "date-marking-and-storage",
        "label",
        { km: "កាលបរិច្ឆេទ និងការរក្សាទុក", en: "Date marking and storage" },
        {
            km: "ប្រសិនបើអាហារត្រូវប្រើមុនថ្ងៃណាមួយដើម្បីសុវត្ថិភាព ស្លាកត្រូវបង្ហាញ “Use-by” ឬ “Expiration date”។ បើមិនមែន ត្រូវបង្ហាញ “Best-before” ឬ “Best quality-before”។ លក្ខខណ្ឌរក្សាទុកត្រូវបង្ហាញ ប្រសិនបើវាជះឥទ្ធិពលលើសុវត្ថិភាព ឬសុពលភាពកាលបរិច្ឆេទ។",
            en: "Use-by or expiration identifies the end of the period after which a food should not be sold or consumed for safety and quality reasons. Otherwise, best-before or best-quality-before indicates expected quality. Relevant storage conditions support the date’s validity.",
        },
        {
            km: "“Best before” មិនមានន័យថាអាហារមិនមានសុវត្ថិភាពភ្លាមៗបន្ទាប់ពីថ្ងៃនោះទេ។",
            en: "Best-before does not mean a food automatically becomes unsafe after that date.",
        },
        "codex-label-2026",
        "Section 4.7 and definitions in Section 2",
    ),
    makeEntry(
        "LABEL_008",
        "instructions-for-use",
        "label",
        { km: "ការណែនាំប្រើប្រាស់", en: "Instructions for use" },
        {
            km: "ប្រសិនបើចាំបាច់ ស្លាកត្រូវមានការណែនាំប្រើប្រាស់ រួមទាំងការលាយទឹក ការចម្អិន ឬការរក្សាទុកបន្ទាប់ពីបើក។",
            en: "Instructions, including reconstitution or other preparation, should be present when needed to ensure correct use of the food.",
        },
        {
            km: "ការណែនាំលើស្លាកមិនមែនជាដំបូន្មានវេជ្ជសាស្ត្រ ឬអាហារូបត្ថម្ភបន្ថែមទេ។",
            en: "Label instructions are not additional medical or nutrition advice.",
        },
        "codex-label-2026",
        "Section 4.8",
    ),
    makeEntry(
        "INGREDIENT_001",
        "what-counts-as-an-ingredient",
        "ingredients",
        { km: "អ្វីដែលរាប់ជាគ្រឿងផ្សំ", en: "What counts as an ingredient" },
        {
            km: "គ្រឿងផ្សំគឺជាសារធាតុគ្រប់ប្រភេទ រួមទាំងសារធាតុបន្ថែម ដែលត្រូវបានប្រើក្នុងការផលិត ឬការរៀបចំអាហារ ហើយនៅមានក្នុងផលិតផលចុងក្រោយ ទោះបីទម្រង់របស់វាអាចបានផ្លាស់ប្តូរក៏ដោយ។",
            en: "An ingredient is any substance, including a food additive, used to make or prepare food and present in the final product, possibly in a modified form.",
        },
        {
            km: "វាមិនមានន័យថារាល់សំណល់ ឬជំនួយក្នុងការកែច្នៃត្រូវបានរាយទាំងអស់ទេ។",
            en: "It does not mean every possible residue or processing aid is listed.",
        },
        "codex-label-2026",
        "Definition of “Ingredient”, Section 2",
    ),
    makeEntry(
        "INGREDIENT_002",
        "food-additives",
        "ingredients",
        { km: "សារធាតុបន្ថែមក្នុងអាហារ", en: "Food additives" },
        {
            km: "សារធាតុបន្ថែមគឺជាសារធាតុដែលមិនត្រូវបានបរិភោគជាអាហារដោយឯករាជ្យ ហើយត្រូវបានបន្ថែមដោយចេតនាដើម្បីគោលបំណងបច្ចេកទេស ដូចជា រក្សាទុក ពណ៌ រសជាតិ ឬធ្វើឱ្យល្បាយស្ថិរភាព។ វាមិនរាប់បញ្ចូលកាកសំណល់ ឬសារធាតុដែលបន្ថែមដើម្បីរក្សា ឬកែលម្អគុណភាពអាហារូបត្ថម្ភនោះទេ។",
            en: "A food additive is not normally consumed as food by itself and is intentionally added for a technological purpose, such as preservation, colour, flavour, or stability. The definition excludes contaminants and substances added to maintain or improve nutritional qualities.",
        },
        {
            km: "ការរាយសារធាតុបន្ថែមមិនបញ្ជាក់ថាវាគ្រោះថ្នាក់ ឬថាអាហារមានសុខភាពល្អទេ។",
            en: "Listing an additive does not show that it is harmful or that the food is healthy.",
        },
        "codex-label-2026",
        "Definition of “Food additive”, Section 2",
    ),
    makeEntry(
        "ADDITIVE_001",
        "additive-functional-classes",
        "ingredients",
        {
            km: "មុខងាររបស់សារធាតុបន្ថែម",
            en: "Functional classes of additives",
        },
        {
            km: "សារធាតុបន្ថែមត្រូវបានចាត់ថ្នាក់តាមមុខងារ ដូចជា ជាតិគ្រប់គ្រងអាស៊ីត ជាតិរក្សាទុក ជាតិពណ៌ ជាតិបង្កើនរសជាតិ ជាតិធ្វើឱ្យខាប់ ជាតិបង្កើតហ្វូម ជាតិស្ថិរភាព និងជាតិផ្អែម។",
            en: "Additives are described by functions such as acidity regulator, preservative, colour, flavour enhancer, thickener, foaming agent, stabilizer, and sweetener.",
        },
        {
            km: "មុខងារតែមួយមិនអាចបញ្ជាក់សុវត្ថិភាព ឬហានិភ័យបានទេ។",
            en: "A functional class alone does not prove safety or risk.",
        },
        "codex-label-2026",
        "Section 4.2.4.3",
    ),
    makeEntry(
        "ADDITIVE_002",
        "ins-and-e-numbers",
        "ingredients",
        { km: "លេខ INS និង E-number", en: "INS and E-numbers" },
        {
            km: "លេខ INS ឬ E-number គឺជាលេខសម្គាល់សម្រាប់សារធាតុបន្ថែមមួយចំនួន។ លេខនេះអាចជួយសម្គាល់ឈ្មោះ និងមុខងាររបស់សារធាតុបន្ថែមនោះ។",
            en: "INS and E-numbers are identifiers used for certain additives. They can help locate an additive’s recognized name, synonyms, and functions.",
        },
        {
            km: "លេខនេះតែមួយមិនបញ្ជាក់ភាពស្របច្បាប់នៅកម្ពុជា ឬកម្រិតគ្រោះថ្នាក់ទេ។",
            en: "The number alone does not prove legality in Cambodia or indicate danger.",
        },
        "codex-gsfa-2025",
        "Additive index, INS number and functional-class records",
    ),
    makeEntry(
        "ALLERGEN_LEARN_001",
        "what-is-a-food-allergen",
        "allergens",
        { km: "អ្វីទៅជាអាហារបង្កអាលែហ្ស៊ី", en: "What is a food allergen?" },
        {
            km: "អាហារបង្កអាលែហ្ស៊ី គឺជាអាហារ រួមទាំងគ្រឿងផ្សំ សារធាតុបន្ថែម និងជំនួយក្នុងការកែច្នៃ ដែលអាចបណ្តាលឱ្យមានប្រតិកម្មអាលែហ្ស៊ីនៅក្នុងអ្នកដែលមានហានិភ័យ។ សារធាតុបង្កអាលែហ្ស៊ីជាធម្មតាជាប្រូតេអ៊ីន ឬដេរីវេនៃប្រូតេអ៊ីន។",
            en: "An allergenic food, including ingredients, additives, and processing aids, can elicit an immune-mediated reaction in susceptible people. A food allergen is usually a protein or protein derivative.",
        },
        {
            km: "មិនមែនមនុស្សគ្រប់គ្នាសុទ្ធតែមានប្រតិកម្ម ហើយការមិនឃើញការប្រកាសមិនមានន័យថាគ្មានអាលែហ្សែនទេ។",
            en: "Not everyone will react, and absence of a declaration does not mean allergen-free.",
        },
        "codex-label-2026",
        "Definitions of “Allergenic food” and “Food allergen”, Section 2",
    ),
    makeEntry(
        "ALLERGEN_LEARN_002",
        "core-declared-allergens",
        "allergens",
        {
            km: "អាលែហ្សែនស្នូលដែលត្រូវប្រកាស",
            en: "Core allergens that must be declared",
        },
        {
            km: "តាមស្តង់ដារ Codex អាហារ និងគ្រឿងផ្សំក្នុងបញ្ជីនេះត្រូវប្រកាសដោយឈ្មោះជាក់លាក់ នៅពេលមានដោយចេតនាក្នុងអាហារ។ ស៊ុលហ្វៃតមានកម្រិតប្រកាសដាច់ដោយឡែកចាប់ពី 10 mg/kg។",
            en: "Codex requires the listed foods and ingredients to be declared by specified name when intentionally present. Sulphite has a separate declaration threshold of 10 mg/kg or more.",
        },
        {
            km: "បញ្ជីនេះមិនមែនជាបញ្ជីពេញលេញសម្រាប់គ្រប់ប្រទេស ឬមនុស្សគ្រប់រូបទេ។",
            en: "This is not an exhaustive list for every country or every person.",
        },
        "codex-label-2026",
        "Sections 4.2.1.4 and 4.2.1.7",
        [
            {
                label: {
                    km: "ស្រូវមានជាតិគ្លុយតែន",
                    en: "Cereals containing gluten",
                },
                detail: {
                    km: "ស្រូវសាលី រ៉ាយ និងបាឡេ",
                    en: "Wheat, rye, and barley",
                },
            },
            { label: { km: "សត្វសមុទ្រសំបករឹង", en: "Crustacea" } },
            { label: { km: "ស៊ុត", en: "Egg" } },
            { label: { km: "ត្រី", en: "Fish" } },
            { label: { km: "សណ្តែកដី", en: "Peanut" } },
            { label: { km: "ទឹកដោះគោ", en: "Milk" } },
            { label: { km: "ល្ង", en: "Sesame" } },
            {
                label: {
                    km: "គ្រាប់ធញ្ញជាតិជាក់លាក់",
                    en: "Specified tree nuts",
                },
                detail: {
                    km: "អាល់ម៉ុន ស្វាយចន្ទី ហេសែលណាត់ ផេកាន ពីស្តាស្យូ និងវ៉ាល់ណាត់",
                    en: "Almond, cashew, hazelnut, pecan, pistachio, and walnut",
                },
            },
            {
                label: { km: "ស៊ុលហ្វៃត", en: "Sulphite" },
                detail: { km: "10 mg/kg ឬច្រើនជាងនេះ", en: "10 mg/kg or more" },
            },
        ],
    ),
    makeEntry(
        "ALLERGEN_LEARN_003",
        "additional-regional-allergens",
        "allergens",
        {
            km: "អាលែហ្សែនបន្ថែមតាមតំបន់",
            en: "Additional allergens that may be required",
        },
        {
            km: "ប្រទេស ឬតំបន់មួយចំនួនអាចទាមទារឱ្យប្រកាសអាហារបង្កអាលែហ្ស៊ីបន្ថែម អាស្រ័យលើការវាយតម្លៃហានិភ័យសម្រាប់ប្រជាជននោះ។",
            en: "National or regional authorities may require additional allergenic foods to be declared based on risk assessment for their populations.",
        },
        {
            km: "អាហារទាំងនេះមិនត្រូវបានចាត់ទុកជាតម្រូវការរបស់កម្ពុជាដោយស្វ័យប្រវត្តិទេ។",
            en: "These foods are not automatically Cambodian requirements without local confirmation.",
        },
        "codex-label-2026",
        "Section 4.2.1.5",
        [
            { label: { km: "បាក់វីត", en: "Buckwheat" } },
            { label: { km: "សេលេរី", en: "Celery" } },
            { label: { km: "អូត", en: "Oats" } },
            { label: { km: "លុយពីន", en: "Lupin" } },
            { label: { km: "ម៉ាស្តាត", en: "Mustard" } },
            { label: { km: "សណ្តែកសៀង", en: "Soy" } },
            {
                label: {
                    km: "គ្រាប់ធញ្ញជាតិបន្ថែម",
                    en: "Additional specified tree nuts",
                },
                detail: {
                    km: "Brazil nut, macadamia និង pine nut",
                    en: "Brazil nut, macadamia, and pine nut",
                },
            },
        ],
    ),
    makeEntry(
        "ALLERGEN_LEARN_004",
        "how-allergens-are-declared",
        "allergens",
        { km: "របៀបប្រកាសអាលែហ្សែន", en: "How allergens are declared" },
        {
            km: "ឈ្មោះជាក់លាក់នៃអាហារបង្កអាលែហ្ស៊ីត្រូវប្រកាសឱ្យច្បាស់ ដោយអាចប្រើពុម្ពអក្សរ រចនាប័ទ្ម ឬពណ៌ដែលខុសពីអក្សរជុំវិញ។ អាជ្ញាធរមានសមត្ថកិច្ចអាចកំណត់ឱ្យប្រកាសក្នុងបញ្ជីគ្រឿងផ្សំ ក្នុងប្រយោគ “Contains…” ឬទាំងពីរ។",
            en: "Specified allergen names must be clear and distinct, for example through contrasting type, style, or colour. The competent authority may require declaration in the ingredient list, a separate “Contains…” statement, or both.",
        },
        {
            km: "ការមិនឃើញប្រយោគ “Contains” មិនមានន័យថាគ្មានហានិភ័យអាលែហ្សែនទេ។",
            en: "A missing “Contains” statement does not mean there is no allergen risk.",
        },
        "codex-label-2026",
        "Section 8.3",
    ),
    makeEntry(
        "HALAL_LEARN_001",
        "codex-definition-of-halal-food",
        "halal",
        {
            km: "និយមន័យអាហារហាឡាល់តាម Codex",
            en: "Codex definition of Halal food",
        },
        {
            km: "អាហារហាឡាល់ គឺជាអាហារដែលអនុញ្ញាតតាមច្បាប់ឥស្លាម មិនផ្ទុកអ្វីដែលខុសច្បាប់ឥស្លាម មិនត្រូវបានរៀបចំ កែច្នៃ ដឹកជញ្ជូន ឬរក្សាទុកដោយឧបករណ៍ដែលមិនស្អាតពីអ្វីដែលខុសច្បាប់ និងមិនបានប៉ះពាល់ផ្ទាល់ជាមួយអាហារដែលមិនបំពេញលក្ខខណ្ឌទាំងនេះ។",
            en: "Codex describes Halal food as permitted under Islamic law, free from unlawful components, prepared and handled with equipment free from unlawful substances, and kept from direct contact with food that does not meet those conditions.",
        },
        {
            km: "ការពិនិត្យគ្រឿងផ្សំតែមួយមិនស្មើនឹងវិញ្ញាបនបត្រហាឡាល់ទេ។",
            en: "Ingredient screening alone is not Halal certification.",
        },
        "codex-halal-1997",
        "Section 2.1",
    ),
    makeEntry(
        "HALAL_LEARN_002",
        "codex-unlawful-food-sources",
        "halal",
        {
            km: "ប្រភពអាហារដែលមិនអនុញ្ញាតតាម Codex",
            en: "Unlawful food sources in Codex guidance",
        },
        {
            km: "គោលការណ៍ Codex រាយប្រភពសត្វ រុក្ខជាតិ និងភេសជ្ជៈមួយចំនួនដែលចាត់ទុកថាមិនស្របតាមច្បាប់ឥស្លាម។ ករណីជាក់លាក់អាចអាស្រ័យលើអាជ្ញាធរជាតិ និងសាលាគំនិតឥស្លាម។",
            en: "Codex guidance lists certain animal sources, plants, and drinks as unlawful. Specific cases can depend on national authorities and Islamic schools of thought.",
        },
        {
            km: "LifeGoods មិនអាចវិនិច្ឆ័យគ្រប់ករណី ឬចេញវិញ្ញាបនបត្របានទេ។",
            en: "LifeGoods cannot decide every case or issue certification.",
        },
        "codex-halal-1997",
        "Section 3.1",
        [
            {
                label: {
                    km: "ជ្រូក និងផលិតផលពីជ្រូក",
                    en: "Pigs and products derived from pigs",
                },
            },
            {
                label: {
                    km: "សត្វស៊ីសាច់មានក្រចក ឬធ្មេញមុត",
                    en: "Carnivorous animals with claws or fangs",
                },
            },
            {
                label: {
                    km: "សត្វស្លាបព្រៃមានក្រចកមុត",
                    en: "Birds of prey with sharp claws",
                },
            },
            {
                label: {
                    km: "សត្វដែលមិនបានសម្លាប់តាមច្បាប់ឥស្លាម",
                    en: "Animals not slaughtered according to Islamic law",
                },
            },
            { label: { km: "ឈាម", en: "Blood" } },
            { label: { km: "ភេសជ្ជៈមានជាតិស្រវឹង", en: "Alcoholic drinks" } },
        ],
    ),
    makeEntry(
        "HALAL_LEARN_003",
        "halal-claim-on-a-label",
        "halal",
        { km: "ការអះអាងហាឡាល់លើស្លាក", en: "Halal claims on labels" },
        {
            km: "ប្រសិនបើមានការអះអាងថាអាហារនេះហាឡាល់ ពាក្យ “Halal” ឬពាក្យសមមូលត្រូវតែមានលើស្លាក។ ការអះអាងមិនគួរធ្វើឱ្យអាហារផ្សេងមើលទៅមិនមានសុវត្ថិភាព ឬអះអាងថាអាហារហាឡាល់មានគុណភាពអាហារូបត្ថម្ភល្អជាង។",
            en: "When a food carries a Halal claim, the word “Halal” or an equivalent term should appear on the label. The claim should not imply that other foods are unsafe or nutritionally inferior.",
        },
        {
            km: "សញ្ញាដែលមើលឃើញតែមួយមិនបញ្ជាក់ថាវិញ្ញាបនបត្រនៅមានសុពលភាពទេ។",
            en: "A visible logo alone does not prove that a certificate is current.",
        },
        "codex-halal-1997",
        "Section 4",
    ),
    makeEntry(
        "HALAL_LEARN_004",
        "cambodia-halal-authority",
        "halal",
        { km: "អាជ្ញាធរហាឡាល់នៅកម្ពុជា", en: "Cambodia’s Halal authority" },
        {
            km: "នៅកម្ពុជា ឯកសារ និងសេវាសាធារណៈពាក់ព័ន្ធនឹងការគ្រប់គ្រងផលិតផលហាឡាល់ ត្រូវបានផ្សព្វផ្សាយដោយអគ្គនាយកដ្ឋាន ក.ប.ប. នៃក្រសួងពាណិជ្ជកម្ម។",
            en: "In Cambodia, official documents and public services related to management of Halal products are published by the CCF Directorate-General of the Ministry of Commerce.",
        },
        {
            km: "កម្មវិធីនេះមិនអាចផ្ទៀងផ្ទាត់វិញ្ញាបនបត្របានទេ បើគ្មានចំណុចប្រទាក់បញ្ជីផ្លូវការ។",
            en: "The app cannot verify a certificate without an official registry interface.",
        },
        "cambodia-ccf-halal",
        "Official Halal regulations and public-service documents",
    ),
    makeEntry(
        "MARK_LEARN_001",
        "barcode-and-gtin",
        "marks",
        { km: "បាកូដ និង GTIN", en: "Barcode and GTIN" },
        {
            km: "បាកូដគឺជាតំណាងដែលអាចស្កេនបាននៃលេខសម្គាល់ ដូចជា GTIN។ លេខនេះជួយសម្គាល់ Package Variant និងអាចភ្ជាប់ទៅព័ត៌មានក្រុមហ៊ុន ប៉ុន្តែលេខបុព្វបទមិនប្រាប់ប្រទេសផលិតទេ។",
            en: "A barcode is a scannable representation of an identifier such as a GTIN. It can identify a Package Variant and link to company information, but its prefix does not show where the item was manufactured.",
        },
        {
            km: "បាកូដតែមួយមិនបញ្ជាក់ប្រទេសដើម សុវត្ថិភាព ភាពពិតប្រាកដ ឬរូបមន្តបច្ចុប្បន្នទេ។",
            en: "A barcode alone does not prove origin, safety, authenticity, or current formulation.",
        },
        "gs1-prefix",
        "GS1 prefix and country-of-origin guidance",
    ),
    makeEntry(
        "MARK_LEARN_002",
        "lot-and-batch-code",
        "marks",
        { km: "លេខឡូត ឬបាច់ផលិត", en: "Lot or batch code" },
        {
            km: "លេខឡូត ឬលេខបាច់ផលិត សម្គាល់ក្រុមផលិតផលដែលផលិតក្រោមលក្ខខណ្ឌស្រដៀងគ្នា។",
            en: "A lot or batch code identifies a defined quantity produced under essentially the same conditions.",
        },
        {
            km: "វាមិនមែនជាកាលបរិច្ឆេទផុតកំណត់ទេ។",
            en: "It is not an expiry date.",
        },
        "codex-label-2026",
        "Section 4.6 and definition of “Lot”",
    ),
    makeEntry(
        "MARK_LEARN_003",
        "date-marks",
        "marks",
        { km: "សញ្ញាកាលបរិច្ឆេទ", en: "Date marks" },
        {
            km: "កាលបរិច្ឆេទផលិត, best-before និង use-by ឬ expiration មានន័យខុសគ្នា ហើយត្រូវអានជាមួយលក្ខខណ្ឌរក្សាទុកដែលបានប្រកាស។",
            en: "Manufacture, best-before, and use-by or expiration dates have different meanings and should be read with any stated storage conditions.",
        },
        {
            km: "“Best before” មិនមានន័យថាមិនមានសុវត្ថិភាពដោយស្វ័យប្រវត្តិបន្ទាប់ពីថ្ងៃនោះទេ។",
            en: "Best-before does not mean automatically unsafe after that date.",
        },
        "codex-label-2026",
        "Date definitions in Section 2 and Section 4.7",
        [
            {
                label: { km: "កាលបរិច្ឆេទផលិត", en: "Date of manufacture" },
                detail: {
                    km: "ថ្ងៃដែលអាហារក្លាយជាផលិតផលដូចដែលបានពិពណ៌នា",
                    en: "When the food becomes the product as described",
                },
            },
            {
                label: { km: "Best-before", en: "Best-before" },
                detail: {
                    km: "រយៈពេលដែលផលិតផលមិនទាន់បើករក្សាគុណភាពដែលបានរំពឹង",
                    en: "Expected quality period for the unopened product",
                },
            },
            {
                label: {
                    km: "Use-by ឬ Expiration",
                    en: "Use-by or expiration",
                },
                detail: {
                    km: "បន្ទាប់ពីថ្ងៃនេះ មិនគួរលក់ ឬប្រើប្រាស់ដោយសារសុវត្ថិភាព និងគុណភាព",
                    en: "After this date, the product should not be sold or consumed for safety and quality reasons",
                },
            },
        ],
    ),
    makeEntry(
        "MARK_LEARN_004",
        "storage-instructions",
        "marks",
        { km: "ការណែនាំអំពីការរក្សាទុក", en: "Storage instructions" },
        {
            km: "លក្ខខណ្ឌរក្សាទុក ដូចជា “រក្សាទុកកន្លែងត្រជាក់ និងស្ងួត” ឬ “ទុកក្នុងទូទឹកកកបន្ទាប់ពីបើក” ត្រូវបង្ហាញ ប្រសិនបើចាំបាច់សម្រាប់សុវត្ថិភាព ឬសុពលភាពកាលបរិច្ឆេទ។",
            en: "Storage conditions such as keeping the package cool and dry or refrigerating after opening should be shown when needed to support safety or the date’s validity.",
        },
        {
            km: "កាលបរិច្ឆេទអាចមិនមានន័យដដែល បើមិនបានគោរពលក្ខខណ្ឌរក្សាទុក។",
            en: "A date may not remain meaningful when its storage conditions were not followed.",
        },
        "codex-label-2026",
        "Section 4.7.2",
    ),
    makeEntry(
        "MARK_LEARN_005",
        "irradiation-mark",
        "marks",
        { km: "សញ្ញាព្យាបាលដោយវិទ្យុសកម្ម", en: "Irradiation marking" },
        {
            km: "ប្រសិនបើអាហារត្រូវបានព្យាបាលដោយវិទ្យុសកម្មអ៊ីយ៉ុង ស្លាកត្រូវមានសេចក្តីប្រកាសអំពីការព្យាបាលនោះ។ សញ្ញាអន្តរជាតិអាចប្រើបាន ប៉ុន្តែមិនចាំបាច់ទេ។",
            en: "Food treated with ionizing radiation must carry a written statement. The international irradiation symbol may be used, but it is optional.",
        },
        {
            km: "ការព្យាបាលដោយវិទ្យុសកម្មមិនមានន័យថាអាហារមិនមានសុវត្ថិភាព ឬគ្រោះថ្នាក់ទេ។",
            en: "Irradiation does not automatically mean unsafe or dangerous.",
        },
        "codex-label-2026",
        "Section 5.2",
    ),
    makeEntry(
        "MARK_LEARN_006",
        "food-contact-symbol",
        "marks",
        { km: "សញ្ញាកែវ និងសម", en: "Glass-and-fork food-contact symbol" },
        {
            km: "សញ្ញាកែវ និងសម អាចបង្ហាញថាសម្ភារៈនោះត្រូវបានកំណត់សម្រាប់ប៉ះជាមួយអាហារ។ វាទាក់ទងនឹងសម្ភារៈវេចខ្ចប់ មិនមែនគ្រឿងផ្សំ ឬអាហារូបត្ថម្ភទេ។",
            en: "The glass-and-fork symbol can indicate that a material is intended for food contact. It describes packaging or another article, not the food’s ingredients or nutrition.",
        },
        {
            km: "សញ្ញានេះមិនបញ្ជាក់ថាអាហារមានសុខភាពល្អ ហាឡាល់ ឬគ្មានអាលែហ្សែនទេ។",
            en: "The symbol does not show that the food is healthy, Halal, or allergen-free.",
        },
        "eu-food-contact",
        "Food-contact materials labelling guidance",
    ),
    makeEntry(
        "MARK_LEARN_007",
        "resin-and-recycling-codes",
        "marks",
        { km: "កូដជ័រ និងកូដកែច្នៃ", en: "Resin and recycling codes" },
        {
            km: "លេខនៅក្រោមកញ្ចប់ជ័រ ដូចជា 1 PET ឬ 2 HDPE សម្គាល់ប្រភេទជ័រសម្រាប់ការបែងចែកសម្ភារៈ។",
            en: "A number such as 1 PET or 2 HDPE identifies the plastic resin type and can support material sorting.",
        },
        {
            km: "កូដនេះមិនធានាថាកញ្ចប់អាចកែច្នៃឡើងវិញបាននៅគ្រប់ទីកន្លែងទេ។",
            en: "The code does not guarantee that the package is recyclable in every local program.",
        },
        "us-epa-recycling",
        "Plastic resin-code guidance",
    ),
]

for (const entry of LEARN_ENTRIES) {
    entry.relatedEntryIds = LEARN_ENTRIES.filter(
        (candidate) =>
            candidate.category === entry.category && candidate.id !== entry.id,
    )
        .slice(0, 3)
        .map((candidate) => candidate.id)
}

export const LEARN_ENTRY_BY_ID = new Map(
    LEARN_ENTRIES.map((entry) => [entry.id, entry]),
)
export const LEARN_ENTRY_BY_SLUG = new Map(
    LEARN_ENTRIES.map((entry) => [entry.slug, entry]),
)
export { codexDisclosure }
