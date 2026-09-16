import type {
    AllergenIngredientGroup,
    LearnCategory,
    LearnEntry,
    LearnFact,
    LearnLocale,
    LearnSourceReference,
    LocalizedText,
} from "./types"

const approved = "approved" as const
const codexDisclosure = {
    km: "នេះជាឯកសារយោងអន្តរជាតិ មិនមែនជាសេចក្តីសន្និដ្ឋានអំពីច្បាប់កម្ពុជា ឬ Product ណាមួយទេ។",
    en: "This is an international reference, not a conclusion about Cambodian law or any Product.",
}

function firstTwoSentences(text: string, locale: LearnLocale) {
    if (locale === "km") {
        return text
            .split("។")
            .map((sentence) => sentence.trim())
            .filter(Boolean)
            .slice(0, 2)
            .map((sentence) => `${sentence}។`)
            .join(" ")
    }

    return text
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(" ")
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
            km: firstTwoSentences(body.km, "km"),
            en: firstTwoSentences(body.en, "en"),
        },
        body,
        facts,
        doesNotImply,
        sourceRefs: [{ sourceId, section }],
        relatedEntryIds: [],
        reviewState: approved,
    }
}

function makeFoodScoreEntry(
    id: string,
    slug: string,
    title: LocalizedText,
    body: LocalizedText,
    doesNotImply: LocalizedText,
    sourceRefs: LearnSourceReference[],
    facts: LearnFact[],
): LearnEntry {
    return {
        id,
        slug,
        category: "food-scores",
        title,
        summary: {
            km: firstTwoSentences(body.km, "km"),
            en: firstTwoSentences(body.en, "en"),
        },
        body,
        facts,
        doesNotImply,
        sourceRefs,
        relatedEntryIds: [],
        reviewState: approved,
    }
}

const ALLERGEN_INGREDIENT_GROUPS: AllergenIngredientGroup[] = [
    {
        key: "milk",
        name: { km: "ទឹកដោះគោ", en: "Milk" },
        examples: [
            { name: { km: "ម្សៅទឹកដោះគោ (milk powder)", en: "Milk powder" } },
            { name: { km: "វ៉េ (whey)", en: "Whey" } },
            { name: { km: "កាសេអ៊ីន (casein)", en: "Casein" } },
            { name: { km: "កាសេអ៊ីណាត (caseinate)", en: "Caseinate" } },
            { name: { km: "ប៊ឺ (butter)", en: "Butter" } },
            { name: { km: "ក្រែម (cream)", en: "Cream" } },
            { name: { km: "ឈីស (cheese)", en: "Cheese" } },
            { name: { km: "យ៉ាអួ (yogurt)", en: "Yogurt" } },
        ],
        labelMeaning: { km: "ប្រូតេអ៊ីនទឹកដោះគោ", en: "Milk protein" },
    },
    {
        key: "egg",
        name: { km: "ស៊ុត", en: "Egg" },
        examples: [
            { name: { km: "ស៊ុតស (egg white)", en: "Egg white" } },
            { name: { km: "ស៊ុតលឿង (egg yolk)", en: "Egg yolk" } },
            { name: { km: "អាល់ប៊ុយមីន (albumin)", en: "Albumin" } },
            { name: { km: "អូវ៉ាល់ប៊ុយមីន (ovalbumin)", en: "Ovalbumin" } },
            { name: { km: "ម៉ាយ៉ូណេស (mayonnaise)", en: "Mayonnaise" } },
        ],
        labelMeaning: { km: "ប្រូតេអ៊ីនស៊ុត", en: "Egg protein" },
    },
    {
        key: "peanut",
        name: { km: "សណ្តែកដី", en: "Peanut" },
        examples: [
            { name: { km: "សណ្តែកដី (peanut)", en: "Peanut" } },
            { name: { km: "សណ្តែកដី (groundnut)", en: "Groundnut" } },
            { name: { km: "ម្សៅសណ្តែកដី (peanut flour)", en: "Peanut flour" } },
            {
                name: {
                    km: "ប៊ឺសណ្តែកដី (peanut butter)",
                    en: "Peanut butter",
                },
            },
            {
                name: { km: "ប្រេងអារ៉ាគីស (arachis oil)", en: "Arachis oil" },
                note: {
                    km: "ការកែច្នៃអាចផ្លាស់ប្តូរបរិមាណប្រូតេអ៊ីនដែលនៅសល់។ ឈ្មោះប្រេងតែមួយមិនអាចបញ្ជាក់សុវត្ថិភាពបានទេ។",
                    en: "Processing can change the amount of protein that remains. The oil name alone does not establish safety.",
                },
            },
        ],
        labelMeaning: { km: "សណ្តែកដី", en: "Peanut" },
    },
    {
        key: "tree-nuts",
        name: { km: "គ្រាប់ធញ្ញជាតិពីដើមឈើ", en: "Tree nuts" },
        examples: [
            { name: { km: "អាល់ម៉ុន (almond)", en: "Almond" } },
            { name: { km: "ស្វាយចន្ទី (cashew)", en: "Cashew" } },
            { name: { km: "វ៉ាល់ណាត់ (walnut)", en: "Walnut" } },
            { name: { km: "ហេសែលណាត់ (hazelnut)", en: "Hazelnut" } },
            { name: { km: "ពីស្តាស្យូ (pistachio)", en: "Pistachio" } },
            { name: { km: "ផេកាន (pecan)", en: "Pecan" } },
            { name: { km: "ម៉ាកាដាមៀ (macadamia)", en: "Macadamia" } },
        ],
        labelMeaning: {
            km: "ត្រូវសម្គាល់ឈ្មោះគ្រាប់ជាក់លាក់",
            en: "Identify the specific nut",
        },
    },
    {
        key: "soy",
        name: { km: "សណ្តែកសៀង", en: "Soy" },
        examples: [
            { name: { km: "សណ្តែកសៀង (soybean)", en: "Soybean" } },
            { name: { km: "ម្សៅសណ្តែកសៀង (soy flour)", en: "Soy flour" } },
            {
                name: {
                    km: "ប្រូតេអ៊ីនសណ្តែកសៀង (soy protein)",
                    en: "Soy protein",
                },
            },
            { name: { km: "តៅហ៊ូ (tofu)", en: "Tofu" } },
            { name: { km: "តែមប៉េ (tempeh)", en: "Tempeh" } },
            { name: { km: "មីសូ (miso)", en: "Miso" } },
            {
                name: { km: "លេស៊ីទីន (lecithin)", en: "Lecithin" },
                note: {
                    km: "ប្រភពលេស៊ីទីនត្រូវមានបញ្ជាក់។ ការកែច្នៃអាចផ្លាស់ប្តូរបរិមាណប្រូតេអ៊ីនដែលនៅសល់ ហើយឈ្មោះនេះតែមួយមិនអាចបញ្ជាក់សុវត្ថិភាពបានទេ។",
                    en: "The source of lecithin needs to be stated. Processing can change the amount of protein that remains, and this name alone does not establish safety.",
                },
            },
        ],
        labelMeaning: { km: "សណ្តែកសៀង", en: "Soy" },
    },
    {
        key: "wheat-gluten-cereals",
        name: {
            km: "ស្រូវសាលី ឬធញ្ញជាតិមានគ្លុយតែន",
            en: "Wheat or gluten cereals",
        },
        examples: [
            { name: { km: "ម្សៅស្រូវសាលី (wheat flour)", en: "Wheat flour" } },
            { name: { km: "សេម៉ូលីណា (semolina)", en: "Semolina" } },
            { name: { km: "ឌូរ៉ុម (durum)", en: "Durum" } },
            { name: { km: "ស្ពែល (spelt)", en: "Spelt" } },
            { name: { km: "កម្ទេចនំប៉័ង (breadcrumbs)", en: "Breadcrumbs" } },
            {
                name: {
                    km: "ម្សៅអាមីដុងស្រូវសាលី (wheat starch)",
                    en: "Wheat starch",
                },
            },
        ],
        labelMeaning: {
            km: "ស្រូវសាលី ឬធញ្ញជាតិមានគ្លុយតែន",
            en: "Wheat or a gluten-containing cereal",
        },
    },
    {
        key: "fish",
        name: { km: "ត្រី", en: "Fish" },
        examples: [
            { name: { km: "សាច់ត្រី (fish meat)", en: "Fish meat" } },
            { name: { km: "ទឹកត្រី (fish sauce)", en: "Fish sauce" } },
            { name: { km: "ទឹកស៊ុបត្រី (fish stock)", en: "Fish stock" } },
            { name: { km: "ត្រីអាន់ឆូវី (anchovy)", en: "Anchovy" } },
            { name: { km: "ត្រីធូណា (tuna)", en: "Tuna" } },
            { name: { km: "ត្រីសាល់ម៉ុន (salmon)", en: "Salmon" } },
            { name: { km: "ស៊ូរីមី (surimi)", en: "Surimi" } },
        ],
        labelMeaning: { km: "ត្រី", en: "Fish" },
    },
    {
        key: "crustacean-shellfish",
        name: { km: "សត្វសមុទ្រសំបករឹង", en: "Crustacean shellfish" },
        examples: [
            { name: { km: "បង្គា (shrimp)", en: "Shrimp" } },
            { name: { km: "បង្គា (prawn)", en: "Prawn" } },
            { name: { km: "ក្តាម (crab)", en: "Crab" } },
            { name: { km: "បង្កង (lobster)", en: "Lobster" } },
            { name: { km: "ក្រេហ្វីស (crayfish)", en: "Crayfish" } },
            { name: { km: "កាពិបង្គា (shrimp paste)", en: "Shrimp paste" } },
        ],
        labelMeaning: { km: "សត្វសមុទ្រសំបករឹង", en: "Crustacean" },
    },
    {
        key: "molluscs",
        name: { km: "សត្វសមុទ្រសាច់ទន់", en: "Molluscs" },
        examples: [
            { name: { km: "មឹក (squid)", en: "Squid" } },
            { name: { km: "អយស្ទ័រ (oyster)", en: "Oyster" } },
            { name: { km: "មូសែល (mussel)", en: "Mussel" } },
            { name: { km: "ខ្យងសមុទ្រ (clam)", en: "Clam" } },
            { name: { km: "មឹកយក្ស (octopus)", en: "Octopus" } },
            { name: { km: "ខ្យង (snail)", en: "Snail" } },
        ],
        labelMeaning: { km: "សត្វសមុទ្រសាច់ទន់", en: "Mollusc" },
    },
    {
        key: "sesame",
        name: { km: "ល្ង", en: "Sesame" },
        examples: [
            { name: { km: "គ្រាប់ល្ង (sesame seed)", en: "Sesame seed" } },
            { name: { km: "ម្សៅល្ង (sesame flour)", en: "Sesame flour" } },
            { name: { km: "ប្រេងល្ង (sesame oil)", en: "Sesame oil" } },
            { name: { km: "តាហ៊ីនី (tahini)", en: "Tahini" } },
        ],
        labelMeaning: { km: "ល្ង", en: "Sesame" },
    },
    {
        key: "buckwheat",
        name: { km: "បាក់វីត", en: "Buckwheat" },
        examples: [
            {
                name: {
                    km: "គ្រាប់បាក់វីត (buckwheat grain)",
                    en: "Buckwheat grain",
                },
            },
            {
                name: {
                    km: "ម្សៅបាក់វីត (buckwheat flour)",
                    en: "Buckwheat flour",
                },
            },
            {
                name: { km: "មីសូបា (soba noodles)", en: "Soba noodles" },
                note: {
                    km: "មីសូបាខ្លះមានទាំងបាក់វីត និងស្រូវសាលី។ ត្រូវអានបញ្ជីគ្រឿងផ្សំពេញលេញ។",
                    en: "Some soba noodles contain both buckwheat and wheat. Read the complete ingredient list.",
                },
            },
        ],
        labelMeaning: { km: "បាក់វីត", en: "Buckwheat" },
    },
    {
        key: "sulphites",
        name: { km: "ស៊ុលហ្វៃត", en: "Sulphites" },
        examples: [
            {
                name: {
                    km: "ស៊ុលហ្វឺឌីអុកស៊ីត (sulfur dioxide)",
                    en: "Sulfur dioxide",
                },
            },
            {
                name: {
                    km: "សារធាតុរក្សាទុក E220-E228",
                    en: "Preservatives E220-E228",
                },
            },
        ],
        labelMeaning: {
            km: "សារធាតុរក្សាទុកស៊ុលហ្វៃត",
            en: "Sulphite preservative",
        },
    },
]

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
    {
        id: "ALLERGEN_LEARN_005",
        slug: "common-ingredient-names-by-allergen",
        category: "allergens",
        title: {
            km: "ឈ្មោះគ្រឿងផ្សំទូទៅតាមក្រុមអាលែហ្សែន",
            en: "Common ingredient names by allergen",
        },
        summary: {
            km: "ស្គាល់ឈ្មោះគ្រឿងផ្សំទូទៅដែលអាចបង្ហាញប្រភពអាលែហ្សែននៅលើស្លាកអាហារ។ ឧទាហរណ៍ទាំងនេះមិនមែនជាបញ្ជីពេញលេញទេ។",
            en: "Recognize common ingredient names that can indicate an allergen source on a food label. These examples are not an exhaustive list.",
        },
        body: {
            km: "ស្លាកអាហារអាចប្រើឈ្មោះអាហារដែលស្គាល់ ឬឈ្មោះគ្រឿងផ្សំជាក់លាក់ជាងនេះ។ ក្រុមខាងក្រោមភ្ជាប់ពាក្យទូទៅលើស្លាកទៅនឹងប្រភពអាលែហ្សែនដែលពាក្យនោះអាចបង្ហាញ។ ត្រូវអានបញ្ជីគ្រឿងផ្សំពេញលេញ និងសេចក្តីប្រកាសដែលនៅជិត ព្រោះច្បាប់ និងពាក្យប្រើប្រាស់អាចខុសគ្នាតាមប្រទេស ឬតំបន់។",
            en: "A food label may use a familiar food name or a more specific ingredient name. The groups below connect common label terms with the allergen source they can indicate. Read the complete ingredient list and any nearby declaration because requirements and wording vary by country or region.",
        },
        allergenIngredientGroups: ALLERGEN_INGREDIENT_GROUPS,
        doesNotImply: {
            km: "ឧទាហរណ៍ទាំងនេះមិនមែនជាបញ្ជីពេញលេញ និងមិនកំណត់ថា Product មួយមានសុវត្ថិភាពសម្រាប់មនុស្សជាក់លាក់ទេ។ គ្រឿងផ្សំដែលបានបញ្ជាក់ខុសពីសេចក្តីប្រកាសអំពីការប៉ះពាល់ដោយចៃដន្យដូចជា “អាចមាន”។ មិនត្រូវចាត់ថ្នាក់ពាក្យមិនច្បាស់ដូចជា flavouring គ្រឿងទេស ឬប្រេងបន្លែទៅជាអាលែហ្សែនដោយគ្មានប្រភពដែលបានបញ្ជាក់ទេ ហើយការមិនឃើញសេចក្តីប្រកាសមិនបញ្ជាក់ថា Product គ្មានអាលែហ្សែនទេ។",
            en: "These examples are not exhaustive and do not determine whether a Product is safe for a particular person. A confirmed ingredient is different from precautionary wording such as “may contain.” Vague terms such as flavouring, spices, or vegetable oil must not be assigned to an allergen without a stated source, and a missing declaration does not prove that a Product is allergen-free.",
        },
        sourceRefs: [
            {
                sourceId: "project-allergen-ingredient-guide",
                section:
                    "Common allergens and ingredient examples; How to show allergen information; Important safety notes",
            },
            {
                sourceId: "codex-label-2026",
                section: "Sections 4.2.1.4-4.2.1.7 and 8.3",
            },
            {
                sourceId: "fda-food-allergies",
                section: "Food Labels and Allergens",
            },
            {
                sourceId: "fsanz-allergen-labelling",
                section: "What must be declared",
            },
        ],
        relatedEntryIds: [],
        reviewState: "draft",
    },
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
    makeFoodScoreEntry(
        "FOOD_SCORE_001",
        "nutri-score",
        { km: "Nutri-Score", en: "Nutri-Score" },
        {
            km: "Nutri-Score គឺជាស្លាកអាហារូបត្ថម្ភនៅផ្នែកខាងមុខកញ្ចប់ ដែលជួយប្រៀបធៀបគុណភាពអាហារូបត្ថម្ភទូទៅរបស់អាហារ និងភេសជ្ជៈបានរហ័ស។ វាប្រើអក្សរ និងពណ៌ ៥ កម្រិត ពី A ពណ៌បៃតងចាស់ ដែលមានសមាសភាពអាហារូបត្ថម្ភអំណោយផលជាង ទៅ E ពណ៌ទឹកក្រូចចាស់ ដែលមានសមាសភាពអំណោយផលតិចជាង។ ពិន្ទុនេះគណនាតាម ១០០ ក្រាម ឬ ១០០ មីលីលីត្រ ហើយមានប្រយោជន៍ជាងគេពេលប្រៀបធៀបផលិតផលស្រដៀងគ្នា។ វាមិនមែនជាការសម្រេចថាអាហារ “ល្អសម្រាប់សុខភាព” ឬ “មិនល្អសម្រាប់សុខភាព” ទេ។",
            en: "Nutri-Score is a front-of-package nutrition label that helps compare the overall nutritional quality of foods and drinks. It uses five letters and colours, from A in dark green for a more favourable nutritional composition to E in dark orange for a less favourable composition. The score is calculated per 100 g or 100 mL and is most useful when comparing similar products. It is not a simple verdict that a food is healthy or unhealthy.",
        },
        {
            km: "Nutri-Score មិនវាស់ដោយផ្ទាល់នូវអាលែហ្សែន ភាពសមស្របតាមហាឡាល់ សារធាតុបន្ថែម កម្រិតកែច្នៃ ឬផលប៉ះពាល់បរិស្ថានទេ។ វាក៏មិនរាប់បញ្ចូលវីតាមីន សារធាតុរ៉ែ ឬសមាសធាតុមានប្រយោជន៍ទាំងអស់ ហើយមិនគួរជំនួសអនុសាសន៍អាហារូបត្ថម្ភសាធារណៈទេ។",
            en: "Nutri-Score does not directly measure allergens, Halal suitability, food additives, processing level, or environmental impact. It also does not include every vitamin, mineral, or beneficial food compound, and it does not replace public-health dietary recommendations.",
        },
        [
            {
                sourceId: "nutri-score-sante-publique-france",
                section: "Summary and Sources",
            },
            {
                sourceId: "nutri-score-eren-blog",
                section: "Summary and Sources",
            },
        ],
        [
            {
                label: { km: "A — បៃតងចាស់", en: "A — Dark green" },
                detail: {
                    km: "សមាសភាពអាហារូបត្ថម្ភអំណោយផលជាង; អាចជាជម្រើសដែលគួរជ្រើសញឹកញាប់ជាង ពេលប្រៀបធៀបផលិតផលស្រដៀងគ្នា",
                    en: "Most favourable nutritional composition; prefer more often when comparing similar products",
                },
            },
            {
                label: { km: "B — បៃតងស្រាល", en: "B — Light green" },
                detail: {
                    km: "សមាសភាពអាហារូបត្ថម្ភអំណោយផល",
                    en: "Favourable nutritional composition",
                },
            },
            {
                label: { km: "C — លឿង", en: "C — Yellow" },
                detail: {
                    km: "សមាសភាពអាហារូបត្ថម្ភកម្រិតមធ្យម; គួរទទួលទានជាផ្នែកនៃរបបអាហារសមតុល្យ",
                    en: "Moderate nutritional composition; consume as part of a balanced diet",
                },
            },
            {
                label: { km: "D — ទឹកក្រូច", en: "D — Orange" },
                detail: {
                    km: "សមាសភាពអាហារូបត្ថម្ភអំណោយផលតិច; គួរទទួលទានតិចញឹកញាប់ ឬក្នុងបរិមាណតូចជាង",
                    en: "Less favourable nutritional composition; consume less frequently or in smaller amounts",
                },
            },
            {
                label: { km: "E — ទឹកក្រូចចាស់", en: "E — Dark orange" },
                detail: {
                    km: "សមាសភាពអាហារូបត្ថម្ភអំណោយផលតិចបំផុត; គួរកំណត់ភាពញឹកញាប់ ឬបរិមាណ",
                    en: "Least favourable nutritional composition; limit frequency or quantity",
                },
            },
            {
                label: {
                    km: "អ្វីដែលគណនា",
                    en: "What the calculation considers",
                },
                detail: {
                    km: "លើកទឹកចិត្តសរសៃអាហារ ប្រូតេអ៊ីន ផ្លែឈើ បន្លែ និងគ្រាប់ធញ្ញជាតិ; កំណត់ថាមពល ស្ករ ខ្លាញ់ឆ្អែត អំបិល និងសារធាតុផ្អែមមិនមានជីវជាតិ",
                    en: "Encourages fibre, protein, fruits, vegetables, and pulses; limits energy, sugars, saturated fat, salt, and non-nutritive sweeteners",
                },
            },
            {
                label: { km: "ដែនកំណត់សំខាន់", en: "Important limitation" },
                detail: {
                    km: "គណនាតាម ១០០ ក្រាម ឬ ១០០ មីលីលីត្រ មិនមែនតាមបរិមាណដែលបានបរិភោគពិតប្រាកដទេ",
                    en: "Calculated per 100 g or 100 mL, not according to the portion actually eaten",
                },
            },
        ],
    ),
    makeFoodScoreEntry(
        "FOOD_SCORE_002",
        "nova-food-classification",
        { km: "ចំណាត់ថ្នាក់អាហារ NOVA", en: "NOVA Food Classification" },
        {
            km: "NOVA គឺជាប្រព័ន្ធចំណាត់ថ្នាក់អាហារ ដែលបែងចែកអាហារតាមលក្ខណៈ កម្រិត និងគោលបំណងនៃការកែច្នៃឧស្សាហកម្ម មិនមែនវាយតម្លៃតាមសារធាតុចិញ្ចឹមតែប៉ុណ្ណោះទេ។ វាមាន ៤ ក្រុម ចាប់ពីអាហារមិនបានកែច្នៃ ឬកែច្នៃតិចតួច រហូតដល់ផលិតផលកែច្នៃខ្លាំងបំផុត។",
            en: "NOVA is a food-classification system that groups foods by the nature, extent, and purpose of industrial processing rather than by nutrient content alone. It has four groups, ranging from unprocessed or minimally processed foods to ultra-processed products.",
        },
        {
            km: "NOVA ពិពណ៌នាកម្រិត និងគោលបំណងនៃការកែច្នៃ មិនមែនជាការវាយតម្លៃពេញលេញអំពីគុណភាពអាហារូបត្ថម្ភ ឬសុវត្ថិភាពរបស់ផលិតផលទេ។ ក្រុម NOVA មិនគួរត្រូវបានប្រើជំនួសព័ត៌មានអាហារូបត្ថម្ភ ឬអនុសាសន៍សុខភាពទេ។",
            en: "NOVA describes the level and purpose of food processing; it is not a complete assessment of a product’s nutritional quality or safety. A NOVA group should not replace nutrition information or health guidance.",
        },
        [
            { sourceId: "nova-monteiro-2016", section: "Sources" },
            { sourceId: "nova-monteiro-2018", section: "Sources" },
            { sourceId: "nova-monteiro-2010", section: "Sources" },
            { sourceId: "nova-fao-2019", section: "Sources" },
            { sourceId: "nova-nupens-overview", section: "Sources" },
            { sourceId: "nova-open-food-facts", section: "Sources" },
        ],
        [
            {
                label: {
                    km: "ក្រុម ១ — មិនបានកែច្នៃ ឬកែច្នៃតិចតួច",
                    en: "Group 1 — Unprocessed or minimally processed foods",
                },
                detail: {
                    km: "អាហារធម្មជាតិ ឬអាហារដែលបានសម្អាត សម្ងួត បង្កក កិន ឬប៉ាស្ទ័រតែប៉ុណ្ណោះ។ ឧទាហរណ៍៖ ផ្លែឈើ បន្លែ អង្ករ សណ្តែក ស៊ុត សាច់ និងទឹកដោះគោ",
                    en: "Natural foods or foods changed only by basic processes such as cleaning, drying, freezing, grinding, or pasteurisation. Examples include fruit, vegetables, rice, beans, eggs, meat, and milk.",
                },
            },
            {
                label: {
                    km: "ក្រុម ២ — គ្រឿងផ្សំសម្រាប់ចម្អិន",
                    en: "Group 2 — Processed culinary ingredients",
                },
                detail: {
                    km: "សារធាតុដែលបានមកពីអាហារក្រុម ១ ឬពីធម្មជាតិ ហើយប្រើសម្រាប់រៀបចំ និងបន្ថែមរសជាតិអាហារ។ ឧទាហរណ៍៖ ប្រេង ប៊ឺ ស្ករ និងអំបិល",
                    en: "Substances obtained from Group 1 foods or nature and mainly used to prepare or season meals. Examples include oil, butter, sugar, and salt.",
                },
            },
            {
                label: {
                    km: "ក្រុម ៣ — អាហារកែច្នៃ",
                    en: "Group 3 — Processed foods",
                },
                detail: {
                    km: "អាហារដែលផលិតជាចម្បងដោយផ្សំអាហារក្រុម ១ ជាមួយអំបិល ស្ករ ប្រេង ឬគ្រឿងផ្សំក្រុម ២ ផ្សេងទៀត។ ឧទាហរណ៍៖ បន្លែកំប៉ុង នំប៉័ងសាមញ្ញ ឈីស និងគ្រាប់ធញ្ញជាតិប្រៃ",
                    en: "Foods made mainly by combining Group 1 foods with salt, sugar, oil, or another Group 2 ingredient. Examples include canned vegetables, simple bread, cheese, and salted nuts.",
                },
            },
            {
                label: {
                    km: "ក្រុម ៤ — អាហារ និងភេសជ្ជៈកែច្នៃខ្លាំងបំផុត",
                    en: "Group 4 — Ultra-processed foods and drinks",
                },
                detail: {
                    km: "រូបមន្តឧស្សាហកម្មដែលជាទូទៅមានគ្រឿងផ្សំ សារធាតុបន្ថែម ឬសារធាតុដែលមិនសូវប្រើក្នុងការចម្អិននៅផ្ទះជាច្រើន។ ឧទាហរណ៍៖ ភេសជ្ជៈផ្អែម មីកញ្ចប់ អាហារសម្រន់ បង្អែម និងអាហារត្រៀមញ៉ាំ",
                    en: "Industrial formulations generally made with multiple ingredients, additives, or substances not commonly used in home cooking. Examples include soft drinks, instant noodles, packaged snacks, confectionery, and many ready-to-eat meals.",
                },
            },
            {
                label: { km: "ចំណាំសំខាន់", en: "Important note" },
                detail: {
                    km: "NOVA និង Nutri-Score វាស់អ្វីខុសគ្នា៖ NOVA ពិពណ៌នាការកែច្នៃ ខណៈ Nutri-Score សង្ខេបសមាសភាពអាហារូបត្ថម្ភ។",
                    en: "NOVA and Nutri-Score measure different things: NOVA describes processing, while Nutri-Score summarises nutritional composition.",
                },
            },
        ],
    ),
    makeFoodScoreEntry(
        "FOOD_SCORE_003",
        "green-score",
        { km: "Green-Score", en: "Green-Score" },
        {
            km: "Green-Score គឺជាចំណាត់ថ្នាក់បរិស្ថានដែល Open Food Facts ប្រើ ដើម្បីជួយប្រៀបធៀបផលប៉ះពាល់បរិស្ថានដែលបានប៉ាន់ស្មានរបស់ផលិតផលអាហារ។ វាផ្ដល់កម្រិតពី A ដែលមានផលប៉ះពាល់ទាបបំផុត ទៅ E ដែលមានផលប៉ះពាល់ខ្ពស់បំផុត។ ការគណនាពិចារណាពេញមួយវដ្តជីវិត ចាប់ពីផលិតកម្ម កែច្នៃ ដឹកជញ្ជូន វេចខ្ចប់ ការប្រើប្រាស់ រហូតដល់ចុងអាយុកាល ហើយលទ្ធផលអាចមិនច្បាស់ពេលព័ត៌មានផលិតផលខ្វះខាត។",
            en: "Green-Score is an environmental rating used by Open Food Facts to help compare the estimated environmental impact of food products. It assigns grades from A for very low impact to E for very high impact. The calculation considers the product life cycle, including production, processing, transport, packaging, use, and end-of-life, and may be less precise when product information is missing.",
        },
        {
            km: "Green-Score ជាការប៉ាន់ស្មានអំពីផលប៉ះពាល់បរិស្ថាន មិនមែនជាពិន្ទុអាហារូបត្ថម្ភ សុវត្ថិភាពអាហារ អាលែហ្សែន ស្ថានភាពហាឡាល់ ឬកម្រិតកែច្នៃទេ។ ទិន្នន័យមធ្យម ប្រភពមិនពេញលេញ ឬទិន្នន័យខុសអាចធ្វើឱ្យលទ្ធផលមិនសូវត្រឹមត្រូវ ហើយគួរប្រៀបធៀបផលិតផលស្រដៀងគ្នាក្នុងប្រភេទដូចគ្នា។",
            en: "Green-Score is an estimate of environmental impact, not a nutrition, food-safety, allergen, Halal, or processing score. Average, missing, or incorrect data can reduce accuracy, so compare similar products within the same food category.",
        },
        [
            { sourceId: "green-score-open-food-facts", section: "Sources" },
            { sourceId: "green-score-methodology", section: "Sources" },
            { sourceId: "green-score-agribalyse", section: "Sources" },
            { sourceId: "green-score-ademe-method", section: "Sources" },
        ],
        [
            {
                label: {
                    km: "A — ផលប៉ះពាល់ទាបបំផុត",
                    en: "A — Very low impact",
                },
                detail: {
                    km: "ជាជម្រើសបរិស្ថានមួយដែលល្អជាង",
                    en: "One of the better environmental choices",
                },
            },
            {
                label: { km: "B — ផលប៉ះពាល់ទាប", en: "B — Low impact" },
                detail: {
                    km: "ជាទូទៅមានផលប៉ះពាល់កំណត់ជាង",
                    en: "Generally has a relatively limited impact",
                },
            },
            {
                label: { km: "C — ផលប៉ះពាល់មធ្យម", en: "C — Moderate impact" },
                detail: {
                    km: "មានផលប៉ះពាល់បរិស្ថានជាមធ្យម",
                    en: "Has an average environmental impact",
                },
            },
            {
                label: { km: "D — ផលប៉ះពាល់ខ្ពស់", en: "D — High impact" },
                detail: {
                    km: "មានផលប៉ះពាល់បរិស្ថានគួរឱ្យកត់សម្គាល់",
                    en: "Has a considerable environmental impact",
                },
            },
            {
                label: {
                    km: "E — ផលប៉ះពាល់ខ្ពស់បំផុត",
                    en: "E — Very high impact",
                },
                detail: {
                    km: "ស្ថិតក្នុងចំណោមផលិតផលដែលមានផលប៉ះពាល់ខ្ពស់ជាងគេ",
                    en: "One of the products with the greatest impact",
                },
            },
            {
                label: { km: "មិនបានគណនា", en: "Not calculated" },
                detail: {
                    km: "ព័ត៌មានចាំបាច់ខ្វះខាត ឬវិធីសាស្ត្រមិនអាចអនុវត្តបាន",
                    en: "Required information is missing or the method does not apply",
                },
            },
            {
                label: {
                    km: "អ្វីដែលគណនា",
                    en: "What the calculation considers",
                },
                detail: {
                    km: "ការវាយតម្លៃវដ្តជីវិត ផលិតកម្ម និងកែច្នៃ ប្រភព និងដឹកជញ្ជូន វេចខ្ចប់ វិធីផលិត និងហានិភ័យជីវចម្រុះ",
                    en: "Life-cycle assessment, production and processing, transport and origins, packaging, production methods, and biodiversity risks",
                },
            },
            {
                label: { km: "ដែនកំណត់សំខាន់", en: "Important limitations" },
                detail: {
                    km: "ទិន្នន័យជាមធ្យម និងមូលដ្ឋាន AGRIBALYSE ដែលផ្តោតលើប្រព័ន្ធអាហារបារាំង អាចមិនតំណាងឱ្យកម្ពុជា ឬប្រទេសផ្សេងទៀតបានពេញលេញ",
                    en: "Average data and AGRIBALYSE’s mainly French food-system basis may not fully represent Cambodia or other countries",
                },
            },
        ],
    ),
]

/**
 * The guide cards intentionally use short summaries. These additions are the
 * longer, source-led reading layer shown on each lesson article. Keeping them
 * separate makes the catalog easy to review while preserving the compact
 * index experience.
 */
const ARTICLE_EXPANSIONS: Record<
    string,
    { body: LocalizedText; facts: LearnFact[] }
> = {
    LABEL_001: {
        body: {
            km: "Codex ក៏បញ្ជាក់ថា ឈ្មោះអាចត្រូវបន្ថែមពាក្យពិពណ៌នាអំពីសភាព ឬការកែច្នៃ ដូចជា ស្ងួត ប្រមូលផ្តុំ រំលាយទឹកវិញ ឬជក់ផ្សែង ដើម្បីកុំឱ្យអ្នកប្រើប្រាស់ច្រឡំ។ ឈ្មោះម៉ាក ឈ្មោះបង្កើតថ្មី ឬពាណិជ្ជសញ្ញាអាចប្រើជាមួយឈ្មោះដែលពិពណ៌នាប្រភេទអាហារបាន។",
            en: "Codex also says that descriptive wording may be needed for the food’s physical condition or treatment, such as dried, concentrated, reconstituted, or smoked. A coined name, brand name, or trademark can appear with the descriptive food name, but it should not replace that name.",
        },
        facts: [
            {
                label: { km: "ឈ្មោះដែលត្រូវស្វែងរក", en: "Name to look for" },
                detail: {
                    km: "ឈ្មោះជាក់លាក់ ឬឈ្មោះប្រើជាទូទៅដែលពិពណ៌នាប្រភេទអាហារ",
                    en: "A specific or customary name that describes the food",
                },
            },
            {
                label: { km: "ពាក្យពិពណ៌នា", en: "Descriptive wording" },
                detail: {
                    km: "ស្ងួត ប្រមូលផ្តុំ រំលាយទឹកវិញ ជក់ផ្សែង ឬសភាពស្រដៀងគ្នា បើចាំបាច់",
                    en: "Dried, concentrated, reconstituted, smoked, or similar wording when needed",
                },
            },
        ],
    },
    LABEL_002: {
        body: {
            km: "នៅពេលគ្រឿងផ្សំជាគ្រឿងផ្សំផ្សំច្រើនមុខ វាអាចដាក់ឈ្មោះគ្រឿងផ្សំផ្សំនោះ ហើយដាក់គ្រឿងផ្សំរបស់វាក្នុងវង់ក្រចកតាមលំដាប់បរិមាណ។ ទឹកដែលបានបន្ថែមជាទូទៅត្រូវរាយ ប៉ុន្តែទឹកក្នុងទឹកជ្រលក់ ស៊ីរ៉ូ ឬទឹកស៊ុបដែលបានរាយជាគ្រឿងផ្សំផ្សំ អាចមានករណីលើកលែង។",
            en: "When an ingredient is itself made from several ingredients, its name may be followed by those component ingredients in parentheses and descending proportion. Added water is generally declared, although water that is part of a declared brine, syrup, or broth can fall under an exception.",
        },
        facts: [
            {
                label: { km: "លំដាប់រាយ", en: "Order of listing" },
                detail: {
                    km: "ពីទម្ងន់ច្រើនទៅតិចនៅពេលផលិត",
                    en: "Descending incoming weight at manufacture",
                },
            },
            {
                label: { km: "គ្រឿងផ្សំផ្សំ", en: "Compound ingredient" },
                detail: {
                    km: "ឈ្មោះគ្រឿងផ្សំផ្សំ និងគ្រឿងផ្សំរបស់វាក្នុងវង់ក្រចក អាស្រ័យលើច្បាប់អនុវត្ត",
                    en: "The compound name and its components in parentheses, subject to applicable rules",
                },
            },
            {
                label: { km: "ជំនួយកែច្នៃ", en: "Processing aid" },
                detail: {
                    km: "អាចមិនត្រូវបានរាយ ប្រសិនបើនៅសល់តែសំណល់ដែលជៀសមិនរួច និងមិនមានមុខងារបច្ចេកទេសក្នុងផលិតផលចុងក្រោយ",
                    en: "May be exempt when only unavoidable residue remains and it has no technological function in the finished food",
                },
            },
        ],
    },
    LABEL_003: {
        body: {
            km: "បរិមាណសុទ្ធគឺបរិមាណនៅពេលវេចខ្ចប់ មិនមែនការវាស់ទំហំកញ្ចប់ខាងក្រៅទេ។ ប្រសិនបើអាហាររឹងស្ថិតក្នុងទឹក ឬមជ្ឈដ្ឋានរាវ Codex អាចទាមទារឱ្យបង្ហាញទម្ងន់បង្ហូរចេញបន្ថែមពីបរិមាណសុទ្ធ។",
            en: "Net contents describe the quantity at packaging, not the outside size of the container. When a solid food is packed in a liquid medium, a drained weight may also be required in addition to net contents.",
        },
        facts: [
            {
                label: { km: "អាហាររាវ", en: "Liquid food" },
                detail: { km: "មាឌ", en: "Volume" },
            },
            {
                label: { km: "អាហាររឹង", en: "Solid food" },
                detail: { km: "ទម្ងន់", en: "Weight" },
            },
            {
                label: {
                    km: "អាហារខាប់ ឬពាក់កណ្តាលរឹង",
                    en: "Semi-solid or viscous food",
                },
                detail: {
                    km: "ទម្ងន់ ឬមាឌ អាស្រ័យលើការអនុវត្ត",
                    en: "Weight or volume, as appropriate",
                },
            },
        ],
    },
    LABEL_004: {
        body: {
            km: "ព័ត៌មាននេះជួយបញ្ជាក់ថាតើអ្នកណាជាអ្នកទទួលខុសត្រូវ ឬអ្នកពាក់ព័ន្ធនឹងការដាក់ផលិតផលលក់។ មុខងារនីមួយៗមិនដូចគ្នាទេ៖ អ្នកនាំចូលអាចនាំផលិតផលចូលប្រទេស ប៉ុន្តែមិនចាំបាច់ជាអ្នកផលិតឡើយ។",
            en: "This field helps identify the parties responsible for, or involved in, placing the food on the market. Those roles are not interchangeable: an importer may bring the food into a country without being its manufacturer.",
        },
        facts: [
            {
                label: { km: "ឈ្មោះអាចមាន", en: "Possible named party" },
                detail: {
                    km: "អ្នកផលិត អ្នកវេចខ្ចប់ អ្នកចែកចាយ អ្នកនាំចូល អ្នកនាំចេញ ឬអ្នកលក់",
                    en: "Manufacturer, packer, distributor, importer, exporter, or vendor",
                },
            },
            {
                label: { km: "ព័ត៌មានភ្ជាប់", en: "Paired information" },
                detail: {
                    km: "អាសយដ្ឋានរបស់ភាគីដែលបានបង្ហាញ",
                    en: "The address of the named party",
                },
            },
        ],
    },
    LABEL_005: {
        body: {
            km: "ការបង្ហាញប្រទេសដើមកំណើតត្រូវអានជាមួយព័ត៌មានអំពីកន្លែងកែច្នៃ។ ប្រសិនបើការកែច្នៃនៅប្រទេសទីពីរបានផ្លាស់ប្តូរធម្មជាតិរបស់អាហារ ប្រទេសកែច្នៃនោះអាចជាប្រទេសដើមកំណើតសម្រាប់គោលបំណងដាក់ស្លាក។",
            en: "Origin information should be read together with where the food was processed. If processing in a second country changes the food’s nature, that processing country may be treated as the country of origin for labelling purposes.",
        },
        facts: [
            {
                label: { km: "ពេលត្រូវបង្ហាញ", en: "When it matters" },
                detail: {
                    km: "នៅពេលមិនបង្ហាញអាចធ្វើឱ្យអ្នកប្រើប្រាស់យល់ច្រឡំ ឬចាញ់បោក",
                    en: "When omission could mislead or deceive the consumer",
                },
            },
            {
                label: {
                    km: "ការកែច្នៃប្រទេសទីពីរ",
                    en: "Second-country processing",
                },
                detail: {
                    km: "អាចប្តូរការកំណត់ប្រទេសដើម ប្រសិនបើវាប្តូរធម្មជាតិអាហារ",
                    en: "May affect the origin designation if it changes the food’s nature",
                },
            },
        ],
    },
    LABEL_006: {
        body: {
            km: "លេខឡូតជួយឱ្យរោងចក្រ និងអ្នកពាក់ព័ន្ធស្គាល់ក្រុមផលិតផលជាក់លាក់មួយ។ Codex ពិពណ៌នាឡូតថាជាបរិមាណទំនិញដែលផលិតក្រោមលក្ខខណ្ឌសំខាន់ៗដូចគ្នា ហើយការសម្គាល់អាចបោះពុម្ព ឆ្លាក់ ឬសម្គាល់ជារបៀបអចិន្ត្រៃយ៍ផ្សេងទៀត។",
            en: "A lot code lets the factory and other parties identify a defined production group. Codex describes a lot as a quantity produced under essentially the same conditions, and says the mark may be embossed or otherwise permanently applied.",
        },
        facts: [
            {
                label: { km: "អ្វីដែលវាសម្គាល់", en: "What it identifies" },
                detail: {
                    km: "រោងចក្រផលិត និងក្រុមផលិតផល",
                    en: "The producing factory and production lot",
                },
            },
            {
                label: { km: "ទម្រង់សញ្ញា", en: "Mark format" },
                detail: {
                    km: "បោះពុម្ព ឆ្លាក់ ឬសម្គាល់ជាអចិន្ត្រៃយ៍",
                    en: "Printed, embossed, or otherwise permanently marked",
                },
            },
        ],
    },
    LABEL_007: {
        body: {
            km: "Codex បែងចែកកាលបរិច្ឆេទសម្រាប់គុណភាព និងកាលបរិច្ឆេទសម្រាប់សុវត្ថិភាព។ សម្រាប់ផលិតផលមានអាយុកាលមិនលើសបីខែ ជាទូទៅបង្ហាញថ្ងៃ និងខែ; សម្រាប់អាយុកាលលើសបីខែ យ៉ាងហោចណាស់បង្ហាញខែ និងឆ្នាំ។ ទម្រង់លេខគួរបញ្ជាក់លំដាប់ថ្ងៃ ខែ ឆ្នាំនៅពេលអាចបង្កការយល់ច្រឡំ។",
            en: "Codex separates dates used for quality from dates used for safety. For products with durability of no more than three months, day and month are generally shown; for products lasting more than three months, at least month and year are shown. Numeric formats should make the day-month-year order clear when confusion is possible.",
        },
        facts: [
            {
                label: { km: "Best-before", en: "Best-before" },
                detail: {
                    km: "ចុងរយៈពេលដែលផលិតផលមិនទាន់បើករក្សាគុណភាពដែលបានរំពឹង",
                    en: "End of the period in which the unopened food is expected to retain stated qualities",
                },
            },
            {
                label: {
                    km: "Use-by ឬ Expiration",
                    en: "Use-by or expiration",
                },
                detail: {
                    km: "ចុងរយៈពេលដែលអាហារគួរមិនត្រូវលក់ ឬបរិភោគដោយហេតុផលសុវត្ថិភាព និងគុណភាព",
                    en: "End of the period after which the food should not be sold or consumed for safety and quality reasons",
                },
            },
            {
                label: { km: "លក្ខខណ្ឌរក្សាទុក", en: "Storage condition" },
                detail: {
                    km: "ត្រូវអនុវត្ត ប្រសិនបើសុពលភាពកាលបរិច្ឆេទពឹងផ្អែកលើវា",
                    en: "Must be followed when the date’s validity depends on it",
                },
            },
        ],
    },
    LABEL_008: {
        body: {
            km: "ការណែនាំអាចមានវិធីលាយទឹក ការរៀបចំមុនប្រើ ការចម្អិន ឬវិធីរក្សាទុកក្រោយបើក។ គោលបំណងរបស់វាគឺឱ្យអាហារត្រូវបានប្រើប្រាស់តាមរបៀបដែលបានពិពណ៌នា មិនមែនជាការបន្ថែមការអះអាងអំពីសុខភាពទេ។",
            en: "Instructions can cover reconstitution, preparation before use, cooking, or storage after opening. Their purpose is to support the correct use of the food as described, not to add a health claim.",
        },
        facts: [
            {
                label: { km: "ឧទាហរណ៍ការណែនាំ", en: "Example instruction" },
                detail: {
                    km: "លាយទឹក ចម្អិន ឬរក្សាទុកក្រោយបើក",
                    en: "Reconstitute, cook, or store after opening",
                },
            },
            {
                label: { km: "ពេលត្រូវមាន", en: "When included" },
                detail: {
                    km: "នៅពេលចាំបាច់សម្រាប់ការប្រើប្រាស់ត្រឹមត្រូវ",
                    en: "When needed to ensure correct utilization",
                },
            },
        ],
    },
    INGREDIENT_001: {
        body: {
            km: "និយមន័យនេះគ្របដណ្តប់សារធាតុដែលនៅសល់ក្នុងផលិតផលចុងក្រោយ ទោះបីវាបានប្តូរទម្រង់ក្នុងពេលផលិតក៏ដោយ។ វាខុសពីជំនួយក្នុងការកែច្នៃ ដែលត្រូវបានប្រើសម្រាប់គោលបំណងបច្ចេកទេស ហើយអាចនៅសល់ដោយអចេតនា។",
            en: "The definition includes substances that remain in the finished food even if their form changed during manufacture. This is different from a processing aid, which is used for a technical purpose and may remain only as unavoidable residue.",
        },
        facts: [
            {
                label: {
                    km: "ត្រូវមានក្នុងផលិតផលចុងក្រោយ",
                    en: "Present in the finished food",
                },
                detail: {
                    km: "បាទ/ចាស ទោះបីបានផ្លាស់ប្តូរទម្រង់ក៏ដោយ",
                    en: "Yes, even if its form has been modified",
                },
            },
            {
                label: { km: "រួមបញ្ចូល", en: "Includes" },
                detail: { km: "សារធាតុបន្ថែមក្នុងអាហារ", en: "Food additives" },
            },
        ],
    },
    INGREDIENT_002: {
        body: {
            km: "សារធាតុបន្ថែមអាចមានមុខងារបច្ចេកទេសដោយផ្ទាល់ ឬតាមរយៈផលិតផលរងរបស់វា។ Codex ដកសារធាតុកខ្វក់ និងសារធាតុដែលបន្ថែមដើម្បីរក្សា ឬកែលម្អគុណភាពអាហារូបត្ថម្ភចេញពីនិយមន័យនេះ។",
            en: "An additive can have a technological effect directly or through its by-products. Codex excludes contaminants and substances added to maintain or improve nutritional qualities from this definition.",
        },
        facts: [
            {
                label: { km: "ហេតុផលបន្ថែម", en: "Reason for addition" },
                detail: {
                    km: "គោលបំណងបច្ចេកទេស ដូចជា រក្សាទុក ពណ៌ រសជាតិ ឬស្ថិរភាព",
                    en: "A technological purpose such as preservation, colour, flavour, or stability",
                },
            },
            {
                label: { km: "មិនមែនជាអ្វី", en: "Not the same as" },
                detail: {
                    km: "សារធាតុកខ្វក់ ឬសារធាតុបន្ថែមសម្រាប់កែលម្អអាហារូបត្ថម្ភ",
                    en: "A contaminant or a substance added to improve nutrition",
                },
            },
        ],
    },
    ADDITIVE_001: {
        body: {
            km: "មុខងារមួយបង្ហាញពីអ្វីដែលសារធាតុបន្ថែមត្រូវបានប្រើសម្រាប់ក្នុងដំណើរការ។ លើស្លាក វាអាចបង្ហាញជាមុខងាររួមជាមួយឈ្មោះជាក់លាក់ ឬលេខសម្គាល់អន្តរជាតិ តាមតម្រូវការរបស់ច្បាប់ដែលអនុវត្ត។",
            en: "A functional class describes what an additive is used to do in the process. On a label, it may appear with the specific name or an international numerical identifier, depending on the applicable labelling rules.",
        },
        facts: [
            {
                label: { km: "រក្សាទុក", en: "Preservative" },
                detail: {
                    km: "ជួយរក្សាស្ថានភាពផលិតផលតាមមុខងារបច្ចេកទេស",
                    en: "A functional class for preservation",
                },
            },
            {
                label: { km: "ស្ថិរភាព", en: "Stabilizer" },
                detail: {
                    km: "បង្ហាញមុខងារជួយរក្សាលក្ខណៈរបស់អាហារ",
                    en: "A class describing support for product stability",
                },
            },
            {
                label: { km: "ជាតិផ្អែម", en: "Sweetener" },
                detail: {
                    km: "មុខងារបច្ចេកទេសពាក់ព័ន្ធនឹងរសជាតិផ្អែម",
                    en: "A technological function related to sweetness",
                },
            },
        ],
    },
    ADDITIVE_002: {
        body: {
            km: "ការស្វែងរកក្នុង GSFA គួរប្រើលេខ ឬឈ្មោះជាមួយប្រភេទអាហារ និងលក្ខខណ្ឌប្រើប្រាស់។ ទិន្នន័យជាក់លាក់សម្រាប់សារធាតុបន្ថែមមួយនៅក្នុង Product ណាមួយ មិនអាចសន្និដ្ឋានបានពីលេខតែមួយទេ។ នៅពេលប្រភពមិនផ្តល់កំណត់ត្រាដែលត្រូវនឹង Product នោះ សូមចាត់ទុកជា Source Data Unavailable។",
            en: "A GSFA search should be read with the food category and conditions of use. Product-specific information cannot be inferred from a number alone. When the source does not provide a record matching the Product, treat that field as Source Data Unavailable.",
        },
        facts: [
            {
                label: { km: "អ្វីដែលអាចស្វែងរក", en: "Searchable fields" },
                detail: {
                    km: "ឈ្មោះ សទិសន័យ លេខ INS មុខងារ និងប្រភេទអាហារ",
                    en: "Name, synonym, INS number, function, and food category",
                },
            },
            {
                label: {
                    km: "កំណត់ត្រាជាក់លាក់សម្រាប់ Product",
                    en: "Product-specific record",
                },
                detail: {
                    km: "Source Data Unavailable — មិនមានកំណត់ត្រា Product-specific ពីប្រភពនេះទេ",
                    en: "Source Data Unavailable — no Product-specific record is supplied by this source",
                },
            },
        ],
    },
    ALLERGEN_LEARN_001: {
        body: {
            km: "Codex បែងចែកពាក្យ allergenic food និង food allergen៖ មួយសំដៅលើអាហារ ឬគ្រឿងផ្សំដែលអាចបង្កប្រតិកម្ម ហើយមួយទៀតសំដៅលើសារធាតុក្នុងអាហារនោះ ដែលជាទូទៅជាប្រូតេអ៊ីន ឬដេរីវេនៃប្រូតេអ៊ីន។ និយមន័យនេះរួមបញ្ចូលសារធាតុបន្ថែម និងជំនួយក្នុងការកែច្នៃនៅពេលពាក់ព័ន្ធ។",
            en: "Codex distinguishes an allergenic food from the food allergen within it. The allergen is usually a protein or protein derivative, and the relevant source can include an ingredient, additive, or processing aid.",
        },
        facts: [
            {
                label: { km: "ប្រភេទប្រតិកម្ម", en: "Reaction described" },
                detail: {
                    km: "ប្រតិកម្មដែលពាក់ព័ន្ធនឹងប្រព័ន្ធភាពស៊ាំនៅមនុស្សដែលងាយប្រតិកម្ម",
                    en: "An immune-mediated reaction in susceptible people",
                },
            },
            {
                label: { km: "ជាធម្មតា", en: "Usually" },
                detail: {
                    km: "ប្រូតេអ៊ីន ឬដេរីវេនៃប្រូតេអ៊ីន",
                    en: "A protein or protein derivative",
                },
            },
        ],
    },
    ALLERGEN_LEARN_002: {
        body: {
            km: "នៅពេលគ្រឿងផ្សំទាំងនេះមានដោយចេតនា ឈ្មោះជាក់លាក់ត្រូវបង្ហាញបន្ថែម ឬជាផ្នែកមួយនៃឈ្មោះគ្រឿងផ្សំ។ ស៊ុលហ្វៃតមានចំណុចកំណត់ដាច់ដោយឡែក 10 mg/kg ឬច្រើនជាងនេះ ដោយវាស់ជាសមមូល sulfur dioxide។",
            en: "When these foods or ingredients are intentionally present, the specified name must be shown in addition to, or as part of, the ingredient name. Sulphite has a separate threshold of 10 mg/kg or more, measured on a sulphur-dioxide-equivalent basis.",
        },
        facts: [
            {
                label: { km: "បញ្ជីស្នូល", en: "Core list" },
                detail: {
                    km: "ស្រូវមានគ្លុយតែន សត្វសមុទ្រសំបក ស៊ុត ត្រី សណ្តែកដី ទឹកដោះគោ ល្ង និងគ្រាប់ធញ្ញជាតិជាក់លាក់",
                    en: "Gluten-containing cereals, crustacea, egg, fish, peanut, milk, sesame, and specified tree nuts",
                },
            },
            {
                label: { km: "កម្រិតស៊ុលហ្វៃត", en: "Sulphite threshold" },
                detail: { km: "10 mg/kg ឬច្រើនជាងនេះ", en: "10 mg/kg or more" },
            },
        ],
    },
    ALLERGEN_LEARN_003: {
        body: {
            km: "Codex បង្ហាញបញ្ជីនេះជាអាហារដែលអាចត្រូវបានទាមទារបន្ថែម បន្ទាប់ពីការវាយតម្លៃហានិភ័យសម្រាប់ប្រជាជន ឬតំបន់។ វាមិនមានន័យថាបញ្ជីនេះជាតម្រូវការដូចគ្នានៅគ្រប់ទីកន្លែងទេ ហើយការលើកលែងសម្រាប់ដេរីវេក៏ត្រូវការវាយតម្លៃហានិភ័យដែរ។",
            en: "Codex presents these foods as candidates for additional declaration after a risk assessment for a population or region. The list is not automatically the same requirement everywhere, and exemptions for derivatives also depend on risk assessment.",
        },
        facts: [
            {
                label: { km: "ឧទាហរណ៍បន្ថែម", en: "Additional examples" },
                detail: {
                    km: "បាក់វីត សេលេរី អូត លុយពីន ម៉ាស្តាត សណ្តែកសៀង Brazil nut, macadamia និង pine nut",
                    en: "Buckwheat, celery, oats, lupin, mustard, soy, Brazil nut, macadamia, and pine nut",
                },
            },
            {
                label: { km: "មូលដ្ឋានសម្រេច", en: "Decision basis" },
                detail: {
                    km: "ទិន្នន័យវាយតម្លៃហានិភ័យ និងការគ្រប់គ្រងហានិភ័យរបស់អាជ្ញាធរ",
                    en: "Available risk-assessment data and risk-management decisions by authorities",
                },
            },
        ],
    },
    ALLERGEN_LEARN_004: {
        body: {
            km: "Codex អនុញ្ញាតឱ្យអាជ្ញាធរកំណត់ថាតើការប្រកាសត្រូវដាក់ក្នុងបញ្ជីគ្រឿងផ្សំ សេចក្តីប្រកាសដាច់ដោយឡែក ឬទាំងពីរ។ ប្រសិនបើប្រើសេចក្តីប្រកាសដាច់ដោយឡែក វាគួរចាប់ផ្តើមដោយពាក្យ “Contains” ឬពាក្យសមមូល ហើយដាក់នៅក្រោម ឬជិតបញ្ជីគ្រឿងផ្សំ។",
            en: "Codex leaves the competent authority to determine whether declaration belongs in the ingredient list, a separate statement, or both. If a separate statement is used, it should begin with “contains” or an equivalent word and sit directly under or close to the ingredient list.",
        },
        facts: [
            {
                label: { km: "វិធីបង្ហាញ", en: "Presentation" },
                detail: {
                    km: "ប្រើអក្សរ រចនាប័ទ្ម ឬពណ៌ដែលមើលឃើញខុសពីអត្ថបទជុំវិញ",
                    en: "Use type, style, or colour that is distinct from surrounding text",
                },
            },
            {
                label: {
                    km: "សេចក្តីប្រកាស Contains",
                    en: "Contains statement",
                },
                detail: {
                    km: "ដាក់ក្រោម ឬជិតបញ្ជីគ្រឿងផ្សំ ប្រសិនបើប្រើ",
                    en: "Place directly under or close to the ingredient list when used",
                },
            },
        ],
    },
    HALAL_LEARN_001: {
        body: {
            km: "គោលការណ៍ Codex ក៏ទទួលស្គាល់ថា អាហារហាឡាល់អាចត្រូវបានរៀបចំ ឬរក្សាទុកនៅផ្នែកផ្សេងនៃទីតាំងតែមួយជាមួយអាហារមិនហាឡាល់ ប្រសិនបើមានវិធានការទប់ស្កាត់ការប៉ះពាល់។ ឧបករណ៍ដែលធ្លាប់ប្រើសម្រាប់អាហារមិនហាឡាល់ក៏អាចប្រើបាន ប្រសិនបើបានសម្អាតតាមតម្រូវការឥស្លាម។",
            en: "Codex also recognizes that Halal food may be prepared or stored in a separate section or line of premises that handles non-Halal food when contact is prevented. Previously used facilities may be used after proper cleaning according to Islamic requirements.",
        },
        facts: [
            {
                label: { km: "ប្រភពស្របច្បាប់", en: "Lawful source" },
                detail: {
                    km: "មិនមានអ្វីដែលចាត់ទុកថាមិនស្របតាមច្បាប់ឥស្លាម",
                    en: "Contains nothing considered unlawful under Islamic law",
                },
            },
            {
                label: { km: "ការប៉ះពាល់", en: "Contact" },
                detail: {
                    km: "មិនប៉ះពាល់ផ្ទាល់ជាមួយអាហារដែលមិនបំពេញលក្ខខណ្ឌ",
                    en: "No direct contact with food that does not meet the conditions",
                },
            },
        ],
    },
    HALAL_LEARN_002: {
        body: {
            km: "បញ្ជី Codex មានទាំងជ្រូក ឆ្កែ ពស់ ស្វា សត្វស៊ីសាច់មានក្រចកឬចង្កូម សត្វស្លាបមានក្រចក សត្វពុល ឈាម រុក្ខជាតិដែលមានសារធាតុបំពុលដែលមិនបានដកចេញ និងភេសជ្ជៈស្រវឹង។ សារធាតុបន្ថែមដែលបានមកពីប្រភពទាំងនេះក៏ត្រូវបានរាប់បញ្ចូលក្នុងគោលការណ៍នេះ។",
            en: "Codex lists pigs, dogs, snakes, monkeys, carnivorous animals with claws or fangs, birds of prey, poisonous animals, blood, hazardous plants whose hazards are not removed, and alcoholic or intoxicating drinks. Additives derived from these sources are included in the same criteria.",
        },
        facts: [
            {
                label: { km: "ប្រភពសត្វ", en: "Animal sources" },
                detail: {
                    km: "ជ្រូក សត្វមួយចំនួន ឈាម និងសត្វដែលមិនបានសម្លាប់តាមច្បាប់ឥស្លាម",
                    en: "Pigs, certain animals, blood, and animals not slaughtered according to Islamic law",
                },
            },
            {
                label: {
                    km: "ប្រភពរុក្ខជាតិ និងភេសជ្ជៈ",
                    en: "Plant and drink sources",
                },
                detail: {
                    km: "រុក្ខជាតិបំពុលដែលមិនបានដកហានិភ័យ និងភេសជ្ជៈស្រវឹង ឬបំពុល",
                    en: "Hazardous plants whose hazard is not removed and alcoholic or hazardous drinks",
                },
            },
        ],
    },
    HALAL_LEARN_003: {
        body: {
            km: "គោលការណ៍ណែនាំនេះអនុវត្តលើពាក្យ Halal និងពាក្យសមមូល នៅពេលប្រើក្នុងការអះអាងលើស្លាក រួមទាំងពាណិជ្ជសញ្ញា ឈ្មោះម៉ាក និងឈ្មោះអាជីវកម្ម។ ការអះអាងមិនគួរប្រើដើម្បីបង្ហាញថាអាហារផ្សេងទៀតមិនមានសុវត្ថិភាព ឬថាអាហារហាឡាល់មានអាហារូបត្ថម្ភល្អជាង។",
            en: "The guidance covers Halal and equivalent terms used in label claims, including trademarks, brand names, and business names. A claim should not imply that other food is unsafe or that Halal food is nutritionally superior.",
        },
        facts: [
            {
                label: { km: "ពាក្យដែលពាក់ព័ន្ធ", en: "Terms covered" },
                detail: {
                    km: "Halal និងពាក្យសមមូលក្នុងការអះអាងលើស្លាក",
                    en: "Halal and equivalent terms used in label claims",
                },
            },
            {
                label: { km: "ការផ្ទៀងផ្ទាត់", en: "Verification" },
                detail: {
                    km: "Source Data Unavailable — សញ្ញាដែលមើលឃើញមិនបង្ហាញសុពលភាព Certificate បច្ចុប្បន្នទេ",
                    en: "Source Data Unavailable — a visible mark does not establish current Certificate validity",
                },
            },
        ],
    },
    HALAL_LEARN_004: {
        body: {
            km: "ទំព័រផ្លូវការរបស់ CCF បង្ហាញឯកសារជាច្រើនក្នុងផ្នែក Prakas រួមមានការដាក់ពាក្យសុំ Certificate នៃស្តង់ដារបច្ចេកទេសផលិតផលកម្ពុជា Halal តម្រូវការសម្រាប់ភោជនីយដ្ឋាន និងតម្រូវការសម្រាប់សត្តឃាតដ្ឋាន។ ទំព័រនេះជាលិបិក្រមឯកសារ មិនមែនជាបញ្ជី Certificate របស់ Product នីមួយៗទេ។",
            en: "The official CCF Prakas index lists documents including an application for the Certificate of Cambodia Halal Product Technical Standard, Cambodian Halal requirements for restaurants, and requirements for slaughterhouses. It is a document index, not a registry of each Product’s Certificate.",
        },
        facts: [
            {
                label: { km: "ប្រភពផ្លូវការ", en: "Official source" },
                detail: {
                    km: "CCF នៃក្រសួងពាណិជ្ជកម្មកម្ពុជា",
                    en: "CCF under Cambodia’s Ministry of Commerce",
                },
            },
            {
                label: {
                    km: "បញ្ជី Certificate របស់ Product",
                    en: "Product Certificate registry",
                },
                detail: {
                    km: "Source Data Unavailable — ទំព័រប្រភពនេះមិនផ្តល់បញ្ជីតាម Product ទេ",
                    en: "Source Data Unavailable — this source does not provide a Product-level registry",
                },
            },
        ],
    },
    MARK_LEARN_001: {
        body: {
            km: "GS1 ពន្យល់ថា លេខ EAN-13 ចាប់ផ្តើមដោយ GS1 Prefix របស់អង្គការសមាជិកដែលបានចាត់លេខ។ អង្គការនោះអាចបានចាត់លេខឱ្យក្រុមហ៊ុនដែលផលិតនៅកន្លែងផ្សេងទៀត ដូច្នេះត្រូវមើលព័ត៌មានប្រទេសដើមលើស្លាក ឬប្រភពផ្សេងដោយឡែក។",
            en: "GS1 explains that an EAN-13 begins with the GS1 Prefix of the member organisation that allocated the number. That organisation may allocate numbers to a company whose goods are made elsewhere, so origin must be read from the label or another source separately.",
        },
        facts: [
            {
                label: { km: "បាកូដអាចជួយ", en: "A barcode can help" },
                detail: {
                    km: "ចាប់ផ្តើម Product Lookup និងសម្គាល់ Package Variant",
                    en: "Start a Product Lookup and identify a Package Variant",
                },
            },
            {
                label: { km: "GS1 Prefix", en: "GS1 Prefix" },
                detail: {
                    km: "អង្គការសមាជិកដែលបានចាត់លេខ មិនមែនប្រទេសផលិត",
                    en: "The allocating GS1 member organisation, not the manufacturing country",
                },
            },
        ],
    },
    MARK_LEARN_002: {
        body: {
            km: "លេខឡូតអាចមានអក្សរ លេខ ឬទម្រង់ខ្លីដែលអ្នកផលិតកំណត់។ ព្រោះរូបមន្តលេខមិនដូចគ្នារវាងក្រុមហ៊ុនទេ អត្ថបទ “lot” ឬ “batch” និងទីតាំងបោះពុម្ពលើកញ្ចប់ ជួយបែងចែកវាពីកាលបរិច្ឆេទ និងបាកូដ។",
            en: "A lot code can contain letters, numbers, or a short format chosen by the manufacturer. Because formats differ between companies, the words “lot” or “batch” and the code’s placement help distinguish it from a date mark and a barcode.",
        },
        facts: [
            {
                label: { km: "គោលបំណង", en: "Purpose" },
                detail: {
                    km: "សម្គាល់ក្រុមផលិតផលដែលផលិតក្រោមលក្ខខណ្ឌដូចគ្នា",
                    en: "Identify a production group made under essentially the same conditions",
                },
            },
            {
                label: { km: "ទម្រង់លេខ", en: "Code format" },
                detail: {
                    km: "មិនមានទម្រង់សកលតែមួយទេ",
                    en: "There is no single universal format",
                },
            },
        ],
    },
    MARK_LEARN_003: {
        body: {
            km: "កាលបរិច្ឆេទផលិត ឬវេចខ្ចប់ប្រាប់ពេលវេលាដែលផលិតផលក្លាយជាផលិតផលដែលបានពិពណ៌នា ឬត្រូវបានដាក់ក្នុងកញ្ចប់ចុងក្រោយ។ វាមិនមែនជាការបញ្ជាក់អាយុកាលដោយខ្លួនឯងទេ។ Best-before ផ្តោតលើគុណភាពដែលបានរំពឹង ខណៈ Use-by ឬ Expiration សំដៅលើចុងរយៈពេលដែលមិនគួរលក់ ឬប្រើប្រាស់តាមលក្ខខណ្ឌដែលបានបញ្ជាក់។",
            en: "A manufacture or packaging date tells when the food became the described product or was placed into its final container; it is not itself a durability statement. Best-before concerns expected quality, while use-by or expiration marks the end of the stated period after which the food should not be sold or consumed.",
        },
        facts: [
            {
                label: { km: "អាយុកាល ≤ ៣ ខែ", en: "Durability ≤ 3 months" },
                detail: {
                    km: "ជាទូទៅថ្ងៃ និងខែ ហើយអាចបន្ថែមឆ្នាំ",
                    en: "Generally day and month, with year when needed",
                },
            },
            {
                label: { km: "អាយុកាល > ៣ ខែ", en: "Durability > 3 months" },
                detail: {
                    km: "យ៉ាងហោចណាស់ខែ និងឆ្នាំ",
                    en: "At least month and year",
                },
            },
        ],
    },
    MARK_LEARN_004: {
        body: {
            km: "សេចក្តីណែនាំរក្សាទុកអាចមានលក្ខខណ្ឌមុនបើក និងក្រោយបើក ដូចជា កន្លែងត្រជាក់ ស្ងួត ឬទូទឹកកក។ ប្រសិនបើកាលបរិច្ឆេទមានសុពលភាពតែពេលគោរពលក្ខខណ្ឌទាំងនេះ ការណែនាំត្រូវបង្ហាញជាមួយកាលបរិច្ឆេទ។",
            en: "Storage instructions can cover the unopened and opened product, such as keeping it cool and dry or refrigerating it. When the validity of a date depends on those conditions, the instructions belong with the date information.",
        },
        facts: [
            {
                label: { km: "មុនបើក", en: "Before opening" },
                detail: {
                    km: "លក្ខខណ្ឌដែលត្រូវអនុវត្តតាមស្លាក",
                    en: "The conditions stated for the unopened package",
                },
            },
            {
                label: { km: "ក្រោយបើក", en: "After opening" },
                detail: {
                    km: "ដូចជា ត្រូវដាក់ទូទឹកកក ឬប្រើក្នុងរយៈពេលកំណត់ ប្រសិនបើបានបញ្ជាក់",
                    en: "For example, refrigerate or use within a stated period when specified",
                },
            },
        ],
    },
    MARK_LEARN_005: {
        body: {
            km: "ការប្រកាសនេះគួរអានជាពាក្យលើស្លាក មិនមែនពឹងផ្អែកលើនិមិត្តសញ្ញាតែមួយទេ។ វាបង្ហាញពីការព្យាបាលដែលបានអនុវត្តលើអាហារ ហើយមិនមែនជាការវាយតម្លៃគុណភាព ឬការណែនាំទិញឡើយ។",
            en: "Read this as a written label statement rather than relying on a symbol alone. It describes a treatment applied to the food; it is not a quality rating or a purchase recommendation.",
        },
        facts: [
            {
                label: { km: "អ្វីដែលត្រូវស្វែងរក", en: "What to look for" },
                detail: {
                    km: "ពាក្យបញ្ជាក់ថាអាហារត្រូវបានព្យាបាលដោយវិទ្យុសកម្មអ៊ីយ៉ុង",
                    en: "A written statement that the food was treated with ionizing radiation",
                },
            },
            {
                label: { km: "និមិត្តសញ្ញា", en: "Symbol" },
                detail: {
                    km: "អាចប្រើបាន ប៉ុន្តែ Codex ពិពណ៌នាថាមិនមែនជាកាតព្វកិច្ច",
                    en: "May be used, but Codex describes it as optional",
                },
            },
        ],
    },
    MARK_LEARN_006: {
        body: {
            km: "គណៈកម្មការអឺរ៉ុបពន្យល់ថា Food Contact Materials រួមមានកញ្ចប់ ប្រអប់ ម៉ាស៊ីនកែច្នៃ ឧបករណ៍ផ្ទះបាយ និងសម្ភារៈបម្រើអាហារ។ សមាសធាតុពីសម្ភារៈអាចផ្ទេរទៅអាហារ និងប៉ះពាល់ដល់សុវត្ថិភាពគីមី គុណភាព រសជាតិ ក្លិន ឬរូបរាង ដូច្នេះសញ្ញានេះគួរអានជាសញ្ញាអំពីសម្ភារៈប៉ះអាហារ។",
            en: "The European Commission describes Food Contact Materials as packaging, containers, processing machinery, kitchenware, and tableware. Substances can migrate from these materials into food and affect chemical safety, quality, taste, smell, or appearance, so this mark should be read as a packaging-material indication.",
        },
        facts: [
            {
                label: { km: "សម្ភារៈដែលពាក់ព័ន្ធ", en: "Materials covered" },
                detail: {
                    km: "ប្លាស្ទិក ក្រដាស កញ្ចក់ លោហៈ និងសម្ភារៈប៉ះអាហារផ្សេងទៀត",
                    en: "Plastic, paper, glass, metal, and other food-contact materials",
                },
            },
            {
                label: {
                    km: "អ្វីដែលសញ្ញាពិពណ៌នា",
                    en: "What the mark describes",
                },
                detail: {
                    km: "ការប្រើសម្ភារៈសម្រាប់ប៉ះអាហារ មិនមែនគ្រឿងផ្សំក្នុងអាហារ",
                    en: "Intended food contact, not the food’s ingredients",
                },
            },
        ],
    },
    MARK_LEARN_007: {
        body: {
            km: "EPA ព្រមានថា លេខជ័រនៅក្នុងត្រីកោណមានរូបរាងស្រដៀងសញ្ញាកែច្នៃ ប៉ុន្តែវាមានតួនាទីសម្គាល់ប្រភេទជ័រ។ ការទទួលយកអាស្រ័យលើកម្មវិធីប្រមូលសំរាមក្នុងតំបន់ ហើយសម្ភារៈដែលមានសំណល់អាហារអាចត្រូវលាង ឬកោសឱ្យស្អាត ប្រសិនបើកម្មវិធីនោះទទួលយក។",
            en: "The EPA notes that the resin number sits inside a triangle that resembles a recycling symbol, but its main purpose is identifying the plastic type. Acceptance depends on the local collection programme; where accepted, containers with food residue may need to be rinsed or scraped clean.",
        },
        facts: [
            {
                label: { km: "លេខ 1 PET", en: "Number 1 PET" },
                detail: {
                    km: "សម្គាល់ប្រភេទជ័រ PET សម្រាប់ការបែងចែកសម្ភារៈ",
                    en: "Identifies PET resin for material sorting",
                },
            },
            {
                label: { km: "លេខ 2 HDPE", en: "Number 2 HDPE" },
                detail: {
                    km: "សម្គាល់ប្រភេទជ័រ HDPE សម្រាប់ការបែងចែកសម្ភារៈ",
                    en: "Identifies HDPE resin for material sorting",
                },
            },
            {
                label: { km: "ការទទួលយកក្នុងតំបន់", en: "Local acceptance" },
                detail: {
                    km: "Source Data Unavailable — ត្រូវពិនិត្យកម្មវិធីកែច្នៃក្នុងតំបន់",
                    en: "Source Data Unavailable — check the local recycling programme",
                },
            },
        ],
    },
}

const PUBLICATION_NOTES: Record<string, LocalizedText> = {
    LABEL_001: {
        km: "ចាប់ផ្តើមពីឈ្មោះអាហារ មិនមែនតែឈ្មោះម៉ាកទេ។ រកពាក្យពិពណ៌នាសភាព ឬការកែច្នៃ ដូចជា ស្ងួត កក ជក់ផ្សែង ប្រមូលផ្តុំ រំលាយទឹកវិញ ឬប៉ាស្ទ័រ ដើម្បីយល់ពីអាហារដែលស្លាកកំពុងពិពណ៌នា។",
        en: "Start with the food name, not only the brand. Look for wording about condition or treatment such as dried, frozen, smoked, concentrated, reconstituted, or pasteurized so the label describes the food clearly.",
    },
    LABEL_002: {
        km: "បញ្ជីខ្លីមិនមានន័យថាអាហារមានអាហារូបត្ថម្ភល្អជាងទេ ហើយឈ្មោះគីមីដែលមិនស្គាល់មិនមានន័យថាគ្រោះថ្នាក់ទេ។ ប្រសិនបើឈ្មោះដូចជា gelatin មិនប្រាប់ប្រភពសត្វ ត្រី ឬប្រភពផ្សេងទេ ស្លាកមួយនេះអាចមិនឆ្លើយសំណួររបស់អ្នកបានពេញលេញ។",
        en: "A short list does not mean the food is healthier, and an unfamiliar chemical name does not by itself mean danger. If a term such as gelatin does not identify its animal, fish, or other source, the label may not answer every question you have.",
    },
    LABEL_003: {
        km: "បរិមាណសុទ្ធសំដៅលើអាហារដែលនៅក្នុងកញ្ចប់ ដោយមិនរាប់សម្ភារៈវេចខ្ចប់។ សម្រាប់អាហារដាក់ក្នុងទឹក ឬមជ្ឈដ្ឋានរាវ សូមរកមើលទម្ងន់បង្ហូរចេញ ប្រសិនបើមានការបង្ហាញ។",
        en: "Net contents refer to the food inside the package, excluding the packaging. For food packed in water or another liquid medium, look for a drained weight when one is declared.",
    },
    LABEL_004: {
        km: "រកមើលឈ្មោះ និងអាសយដ្ឋានអ្នកផលិត អ្នកវេចខ្ចប់ អ្នកចែកចាយ អ្នកនាំចូល អ្នកនាំចេញ ឬអ្នកលក់។ មុខងារទាំងនេះអាចជារបស់ភាគីផ្សេងគ្នា។",
        en: "Look for the name and address of the manufacturer, packer, distributor, importer, exporter, or vendor. These roles may belong to different parties.",
    },
    LABEL_005: {
        km: "ប្រទេសដើមកំណើតគួរមកពីសេចក្តីប្រកាសលើស្លាក និងច្បាប់ប្រភពដែលអនុវត្ត មិនមែនពីលេខបីខ្ទង់ដំបូងនៃ EAN-13 ទេ។ GS1 បញ្ជាក់ថា Prefix សម្គាល់អង្គការដែលបានចាត់លេខ។",
        en: "Country of origin should come from the label and the applicable origin rule, not from the first digits of an EAN-13. GS1 says the prefix identifies the organisation that allocated the number.",
    },
    LABEL_006: {
        km: "លេខឡូតជួយឱ្យក្រុមហ៊ុន ឬអាជ្ញាធរតាមដានក្រុមផលិតផលដែលពាក់ព័ន្ធនឹងបញ្ហា ឬការប្រមូលត្រឡប់។ កុំលុបលេខសូន្យនៅខាងមុខ ឬទាយថាតួអក្សរមួយជា O/0 ឬ I/1។",
        en: "A lot code helps a company or authority trace a production group during a complaint or recall. Keep leading zeroes and do not guess whether a character is O/0 or I/1.",
    },
    LABEL_007: {
        km: "កុំបង្ហាញកាលបរិច្ឆេទដោយគ្មានពាក្យដើមនៅជាប់វា។ Best before ទាក់ទងជាចម្បងនឹងគុណភាពដែលរំពឹង ខណៈ use-by ឬ expiry អាចមានការណែនាំតឹងរឹងជាងនេះតាមច្បាប់អនុវត្ត។",
        en: "Do not interpret a date without the original wording beside it. Best-before commonly concerns expected quality, while use-by or expiry may carry a stronger instruction under the applicable rule.",
    },
    LABEL_008: {
        km: "ការណែនាំលើស្លាកអាចប្រាប់ពីការលាយទឹក ការចម្អិន ឬការរក្សាទុកក្រោយបើក។ ការពិនិត្យរហ័សគួរភ្ជាប់ឈ្មោះ គ្រឿងផ្សំ អាលែហ្សែន បរិមាណ កាលបរិច្ឆេទ និងការរក្សាទុកជាមួយគ្នា។",
        en: "Label instructions may cover reconstitution, cooking, or storage after opening. A quick check should connect the name, ingredients, allergens, quantity, date, and storage instruction rather than reading one field in isolation.",
    },
    INGREDIENT_001: {
        km: "គ្រឿងផ្សំគឺជាសារធាតុដែលបានប្រើក្នុងការផលិត និងនៅមានក្នុងផលិតផលចុងក្រោយ។ ជំនួយក្នុងការកែច្នៃមានគោលបំណងបច្ចេកទេសផ្សេង ហើយអាចនៅសល់ដោយអចេតនា ដូច្នេះកុំបញ្ចូលពាក្យទាំងពីរនេះជាអត្ថន័យតែមួយ។",
        en: "An ingredient is used in manufacture and remains in the finished food. A processing aid serves a different technical purpose and may remain only unintentionally, so the two terms should not be treated as synonyms.",
    },
    INGREDIENT_002: {
        km: "មុខងារទូទៅរបស់សារធាតុបន្ថែមរួមមាន ជាតិរក្សាទុក ជាតិប្រឆាំងអុកស៊ីតកម្ម ជាតិពណ៌ ជាតិរក្សាពណ៌ ជាតិធ្វើឱ្យលាយ ជាតិស្ថិរភាព ជាតិធ្វើឱ្យខាប់ ជាតិជែល ជាតិផ្អែម ជាតិគ្រប់គ្រងអាស៊ីត និងជាតិបង្កើនរសជាតិ។",
        en: "Common additive functions include preservative, antioxidant, colour, colour-retention agent, emulsifier, stabilizer, thickener, gelling agent, sweetener, acidity regulator, and flavour enhancer.",
    },
    ADDITIVE_001: {
        km: "មុខងារប្រាប់ថាសារធាតុបន្ថែមត្រូវបានប្រើដើម្បីធ្វើអ្វី មិនមែនជាចំណាត់ថ្នាក់ល្អ ឬអាក្រក់ទេ។ គេអាចបង្ហាញមុខងារជាមួយឈ្មោះជាក់លាក់ ឬលេខសម្គាល់របស់វា។",
        en: "A functional class says what an additive is used to do; it is not a good-or-bad rating. The class may appear with the additive’s specific name or numerical identifier.",
    },
    ADDITIVE_002: {
        km: "INS មានន័យថា International Numbering System for Food Additives។ E-number អាចប្រើលេខស្នូលដូចគ្នានៅក្នុងប្រព័ន្ធអឺរ៉ុប ប៉ុន្តែការអនុញ្ញាតតាមច្បាប់មិនចាំបាច់ដូចគ្នានៅកម្ពុជា Codex និងសហភាពអឺរ៉ុបទេ។ ក្នុង GSFA ត្រូវអានកម្រិតអតិបរមា លក្ខខណ្ឌ GMP និងកំណត់សម្គាល់ជាមួយប្រភេទអាហារ។",
        en: "INS means International Numbering System for Food Additives. An E-number may use the same numerical core in the European system, but legal permissions do not automatically match across Cambodia, Codex, and the EU. In GSFA, read the maximum level, GMP condition, notes, and food category together.",
    },
    ALLERGEN_LEARN_001: {
        km: "អាលែហ្ស៊ីអាហារពាក់ព័ន្ធនឹងប្រតិកម្មរបស់ប្រព័ន្ធភាពស៊ាំ ខណៈការមិនអត់ឱនអាហារអាចមានយន្តការផ្សេង ដូចជាការរំលាយ lactose មិនបានល្អ។ ទាំងពីរអាចសំខាន់ ប៉ុន្តែឧបករណ៍អានស្លាកគួររាយតែព័ត៌មានលើកញ្ចប់ និងមិនធ្វើរោគវិនិច្ឆ័យ។",
        en: "A food allergy involves an immune response, while intolerance can have a different mechanism such as difficulty digesting lactose. Both can matter, but a label-reading tool should report the package information and should not diagnose a person.",
    },
    ALLERGEN_LEARN_002: {
        km: "មិនមានបញ្ជីសកលតែមួយដែលអាចយកទៅធ្វើជាច្បាប់របស់គ្រប់ប្រទេសបានទេ។ បញ្ជីអាលែហ្សែនរបស់សហរដ្ឋអាមេរិកអាចជាឯកសារអប់រំ ប៉ុន្តែត្រូវសម្គាល់ថាជាព័ត៌មានសហរដ្ឋអាមេរិក មិនមែនជាច្បាប់កម្ពុជាដោយស្វ័យប្រវត្តិទេ។",
        en: "There is no single worldwide list that can be copied into every country’s law. The U.S. list can be useful education, but it must remain identified as U.S. information and not be presented automatically as Cambodian law.",
    },
    ALLERGEN_LEARN_003: {
        km: "ការប៉ះពាល់ឆ្លងអាចកើតឡើងតាមឧបករណ៍រួម ការរក្សាទុក ការដឹកជញ្ជូន ឬការរៀបចំ។ ពាក្យ “May contain” អាចសំដៅលើវត្តមានដោយអចេតនា ប៉ុន្តែការប្រើពាក្យ និងលក្ខខណ្ឌរបស់វាពឹងផ្អែកលើការវាយតម្លៃហានិភ័យ និងអាជ្ញាធរដែលអនុវត្ត។",
        en: "Cross-contact can happen through shared equipment, storage, transport, or preparation. “May contain” can communicate unintended presence, but its use and wording depend on risk assessment and the applicable authority.",
    },
    ALLERGEN_LEARN_004: {
        km: "ការប្រកាសអាចស្ថិតក្នុងបញ្ជីគ្រឿងផ្សំ ក្នុងវង់ក្រចកបន្ទាប់ពីគ្រឿងផ្សំ ឬក្នុងប្រយោគ “Contains”។ ប្រយោគ “May contain” មានន័យខុសពី “Contains” ហើយតំបន់ស្លាកដែលមិនអាចអានបាន មិនគួរត្រូវបកស្រាយថាគ្មានអាលែហ្សែនទេ។",
        en: "A declaration may appear in the ingredient list, in parentheses after an ingredient, or in a “Contains” statement. “May contain” communicates something different from “Contains,” and an unreadable label area should not be interpreted as allergen-free.",
    },
    HALAL_LEARN_001: {
        km: "អាហារហាឡាល់អាចត្រូវបានផលិតនៅទីតាំងតែមួយជាមួយអាហារមិនហាឡាល់ ប្រសិនបើប្រើខ្សែ ឬផ្នែកដាច់ដោយឡែក និងទប់ស្កាត់ការប៉ះពាល់។ ឧបករណ៍ដែលធ្លាប់ប្រើក៏ត្រូវមានការសម្អាតត្រឹមត្រូវតាមតម្រូវការឥស្លាម។",
        en: "Halal food may be made on the same premises as non-Halal food when separate lines or sections prevent contact. Previously used equipment requires proper cleaning according to Islamic requirements.",
    },
    HALAL_LEARN_002: {
        km: "ចំណុចត្រូវប្រុងប្រយ័ត្នរួមមានជ្រូក ឈាម សាច់ដែលមិនបានសម្លាប់តាមលក្ខខណ្ឌ ភេសជ្ជៈស្រវឹង សារធាតុបន្ថែមពីប្រភពហាមឃាត់ និងគ្រឿងផ្សំដូចជា gelatin ឬ enzyme នៅពេលប្រភពមិនត្រូវបានបង្ហាញ។",
        en: "Common questions include pork, blood, meat without the required slaughter process, alcoholic drinks, additives from prohibited sources, and ingredients such as gelatin or enzymes when their source is not stated.",
    },
    HALAL_LEARN_003: {
        km: "ការពិនិត្យហាឡាល់អាចបែងជា ៤ កម្រិត៖ អ្វីដែលមើលឃើញលើកញ្ចប់ ការពិនិត្យគ្រឿងផ្សំ ភស្តុតាងអំពីការផលិត និងការផ្ទៀងផ្ទាត់ Certificate។ កម្រិតមួយមិនគួរត្រូវបានបង្ហាញជំនួសកម្រិតផ្សេងទៀតទេ។",
        en: "Halal evidence can be separated into four layers: package observation, ingredient review, manufacturing evidence, and Certificate verification. One layer should not be presented as a substitute for another.",
    },
    HALAL_LEARN_004: {
        km: "កាតាឡុក CCF រាយឯកសារកម្ពុជាពាក់ព័ន្ធនឹងផលិតផលហាឡាល់ ភោជនីយដ្ឋាន សត្តឃាតដ្ឋាន ការដាក់ពាក្យសុំ Certificate និងគណៈកម្មការដឹកនាំហាឡាល់។ ដោយសារវាជាលិបិក្រម ត្រូវភ្ជាប់ទៅឯកសារដែលគ្រប់គ្រង Product ឬ Certificate ជាក់លាក់។",
        en: "The CCF catalogue lists Cambodian instruments concerning Halal products, restaurants, slaughterhouses, Certificate applications, and the Halal Steering Committee. Because it is an index, link to the exact instrument governing the Product or Certificate in question.",
    },
    MARK_LEARN_001: {
        km: "ការស្កេនជោគជ័យអាចជួយប្រៀបធៀបឈ្មោះផលិតផល ម៉ាក ឬកំណត់ត្រាមូលដ្ឋាន។ សេវា Verified by GS1 អាចជួយពិនិត្យអង្គការដែលពាក់ព័ន្ធនឹងលេខសម្គាល់ ប៉ុន្តែការផ្គូផ្គងបាកូដមិនមែនជាវិញ្ញាបនបត្រអំពីគ្រឿងផ្សំ អាលែហ្សែន ហាឡាល់ ភាពពិតប្រាកដ ឬការប្រមូលត្រឡប់ទេ។",
        en: "A successful scan can help compare a product name, brand, or basic record. Verified by GS1 can help check the organisation associated with an identifier, but a barcode match is not certification of ingredients, allergen safety, Halal status, authenticity, or recall status.",
    },
    MARK_LEARN_002: {
        km: "លេខឡូតអាចមានលេខ អក្សរ លេខរោងចក្រ ឬពេលផលិត ហើយអាចជួយតាមដានទំនិញពេលមានបណ្តឹង ឬការប្រមូលត្រឡប់។ រក្សាលេខឱ្យដូចអត្ថបទដើម ដោយមិនបន្ថែម ឬដកតួអក្សរ។",
        en: "A lot code can contain numbers, letters, a factory code, or a production time and can support tracing during a complaint or recall. Preserve it exactly without adding or removing characters.",
    },
    MARK_LEARN_003: {
        km: "អានពាក្យនៅជាប់កាលបរិច្ឆេទជាមុនសិន ហើយកុំដកការណែនាំរក្សាទុកចេញពីបរិបទ។ ប្រសិនបើទម្រង់លេខអាចធ្វើឱ្យច្រឡំ គួររកមើលលំដាប់ថ្ងៃ ខែ ឆ្នាំ ឬពាក្យណែនាំផ្សេងទៀត។",
        en: "Read the words beside a date first and keep the storage instruction in context. If a numeric format could be confusing, look for a stated day-month-year order or another clarifying phrase.",
    },
    MARK_LEARN_004: {
        km: "លក្ខខណ្ឌរក្សាទុកអាចខុសគ្នាមុនបើក និងក្រោយបើក។ បើកញ្ចប់ត្រូវរក្សាទុកត្រជាក់ ស្ងួត ឬក្នុងទូទឹកកក សូមអានលក្ខខណ្ឌនោះជាមួយកាលបរិច្ឆេទ។",
        en: "Storage conditions may differ before and after opening. If the package says to keep it cool, dry, or refrigerated, read that condition together with the date mark.",
    },
    MARK_LEARN_005: {
        km: "Codex តម្រូវឱ្យមានសេចក្តីប្រកាសជាលាយលក្ខណ៍អក្សរ នៅពេលអាហារត្រូវបានព្យាបាលដោយវិទ្យុសកម្មអ៊ីយ៉ុង ហើយនិមិត្តសញ្ញា Radura អាចដាក់ជាមួយបាន។ ពន្យល់វាជាព័ត៌មានអំពីការព្យាបាល មិនមែនជាសញ្ញាគុណភាពទូទៅទេ។",
        en: "Codex requires a written statement when food has been treated with ionizing radiation, and the Radura symbol may accompany it. Present this as information about treatment, not as a general quality seal.",
    },
    MARK_LEARN_006: {
        km: "សញ្ញាកែវ និងសមមិនបញ្ជាក់ដោយស្វ័យប្រវត្តិថាកញ្ចប់អាចប្រើក្នុងមីក្រូវ៉េវ ឡ សម្អាតក្នុងម៉ាស៊ីនលាងចាន ប្រើឡើងវិញ កែច្នៃឡើងវិញ ឬហាឡាល់ទេ។ លក្ខណៈទាំងនោះត្រូវការការណែនាំ ឬសញ្ញាដាច់ដោយឡែក។",
        en: "The glass-and-fork symbol does not automatically mean microwave-safe, oven-safe, dishwasher-safe, reusable, recyclable, or Halal. Those properties require their own instructions or marks.",
    },
    MARK_LEARN_007: {
        km: "សំណល់អាហារអាចត្រូវលាង ឬកោសចេញ ប្រសិនបើកម្មវិធីក្នុងតំបន់ទទួលយក។ សន្លឹកជ័រ សម្ភារៈផ្សំច្រើនប្រភេទ polystyrene និងប្លាស្ទិក compostable អាចត្រូវការការគ្រប់គ្រងពិសេស ដូច្នេះពិនិត្យអ្នកប្រមូលក្នុងតំបន់កម្ពុជា។",
        en: "Food residue may need to be rinsed or scraped off where a local programme accepts the item. Films, mixed materials, polystyrene, and compostable plastics may need special handling, so check a Cambodian local collector or municipality.",
    },
}

for (const entry of LEARN_ENTRIES) {
    const expansion = ARTICLE_EXPANSIONS[entry.id]
    if (expansion) {
        entry.body = {
            km: `${entry.body.km} ${expansion.body.km}`,
            en: `${entry.body.en} ${expansion.body.en}`,
        }
        entry.facts = [...(entry.facts ?? []), ...expansion.facts]
    }
    const publicationNote = PUBLICATION_NOTES[entry.id]
    if (publicationNote) {
        entry.body = {
            km: `${entry.body.km} ${publicationNote.km}`,
            en: `${entry.body.en} ${publicationNote.en}`,
        }
    }
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
