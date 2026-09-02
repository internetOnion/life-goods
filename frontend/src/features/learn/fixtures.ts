export type LearnLocale = "km" | "en"

export type LearnTopic =
    "laws" | "declarations" | "evidence" | "ingredients" | "dates"

type LocalizedText = Record<LearnLocale, string>

type KnowledgeEntryBase = {
    slug: string
    topic: LearnTopic
    title: LocalizedText
    summary: LocalizedText
    body: LocalizedText
}

export type KnowledgeResource = {
    language: LearnLocale
    format: "PDF"
    url: string
}

export type SourcedKnowledgeEntry = KnowledgeEntryBase & {
    kind: "sourced"
    cardSummary: LocalizedText
    keyPoints: LocalizedText[]
    publisher: LocalizedText
    issuingAgency: LocalizedText
    documentReference: LocalizedText
    signedDate: LocalizedText
    recordUrl: string
    resources: KnowledgeResource[]
}

export type SimulatedKnowledgeEntry = KnowledgeEntryBase & {
    kind: "simulated"
}

export type KnowledgeEntry = SourcedKnowledgeEntry | SimulatedKnowledgeEntry

export const KNOWLEDGE_ENTRIES: KnowledgeEntry[] = [
    {
        kind: "sourced",
        slug: "law-on-food-safety",
        topic: "laws",
        title: {
            km: "ច្បាប់ស្ដីពីសុវត្ថិភាពម្ហូបអាហារ",
            en: "Law on Food Safety",
        },
        summary: {
            km: "ច្បាប់នេះបង្កើតក្របខណ្ឌ និងយន្តការសម្រាប់គ្រប់គ្រង និងធានាសុវត្ថិភាព គុណភាព អនាម័យ និងភាពស្របច្បាប់នៃម្ហូបអាហារនៅគ្រប់ដំណាក់កាលនៃខ្សែចង្វាក់ផលិតកម្ម។ គោលបំណងដែលបានបញ្ជាក់គឺការពារសុខភាព និងសុវត្ថិភាពម្ហូបអាហាររបស់អ្នកប្រើប្រាស់ និងគាំទ្រពាណិជ្ជកម្មម្ហូបអាហារដោយស្មោះត្រង់។",
            en: "This law establishes frameworks and mechanisms for managing food safety, quality, hygiene, and compliance throughout the food-production chain. Its stated aims are to protect consumer health and food safety and to support fair food trade.",
        },
        cardSummary: {
            km: "ក្របខណ្ឌរបស់កម្ពុជាសម្រាប់សុវត្ថិភាព គុណភាព និងអនាម័យម្ហូបអាហារនៅទូទាំងខ្សែចង្វាក់ផលិតកម្ម។",
            en: "Cambodia’s framework for food safety, quality, and hygiene across the food-production chain.",
        },
        body: {
            km: "Open Development Cambodia បង្ហាញច្បាប់នេះជាក្របខណ្ឌថ្នាក់ជាតិ មិនមែនជាសេចក្ដីសន្និដ្ឋានអំពី Product ណាមួយទេ។ ចំណុចសំខាន់ៗខាងក្រោមសង្ខេបតាមកំណត់ត្រារបស់ ODC។ សូមអានឯកសារប្រភពភាសាខ្មែរ ឬអង់គ្លេសដែលបានភ្ជាប់សម្រាប់បទប្បញ្ញត្តិពេញលេញ។",
            en: "Open Development Cambodia presents this law as a national framework, not as a conclusion about any Product. The points below reflect ODC’s record. Consult the linked Khmer or English source text for the complete provisions.",
        },
        keyPoints: [
            {
                km: "វិសាលភាពរបស់ច្បាប់គ្របដណ្តប់លើគ្រប់ដំណាក់កាលនៃខ្សែចង្វាក់ផលិតកម្មម្ហូបអាហារ។",
                en: "Its scope covers every stage of the food-production chain.",
            },
            {
                km: "ច្បាប់កំណត់ក្របខណ្ឌ និងយន្តការសម្រាប់គ្រប់គ្រងសុវត្ថិភាព គុណភាព អនាម័យ និងភាពស្របច្បាប់នៃម្ហូបអាហារ។",
                en: "It establishes frameworks and mechanisms for managing food safety, quality, hygiene, and compliance.",
            },
            {
                km: "គោលបំណងដែលបានបញ្ជាក់គឺការពារសុខភាព និងសុវត្ថិភាពម្ហូបអាហាររបស់អ្នកប្រើប្រាស់ និងធានាពាណិជ្ជកម្មម្ហូបអាហារដោយស្មោះត្រង់។",
                en: "Its stated aims are consumer health and food-safety protection and fair food trade.",
            },
        ],
        publisher: {
            km: "Open Development Cambodia",
            en: "Open Development Cambodia",
        },
        issuingAgency: {
            km: "ក្រសួងពាណិជ្ជកម្ម",
            en: "Ministry of Commerce",
        },
        documentReference: {
            km: "នស/រកម/០៦២២/០០៦",
            en: "NS/RKM/0622/006",
        },
        signedDate: {
            km: "៨ មិថុនា ២០២២",
            en: "June 8, 2022",
        },
        recordUrl:
            "https://data.opendevelopmentcambodia.net/laws_record/law-on-food-safety",
        resources: [
            {
                language: "km",
                format: "PDF",
                url: "https://data.opendevelopmentcambodia.net/laws_record/law-on-food-safety/resource/1406ab5a-0097-43e9-99db-234b80cfb7ec",
            },
            {
                language: "en",
                format: "PDF",
                url: "https://data.opendevelopmentcambodia.net/laws_record/law-on-food-safety/resource/525730c8-110a-4670-a3b5-80d08db2c82b",
            },
        ],
    },
    {
        kind: "simulated",
        slug: "contains-and-may-contain",
        topic: "declarations",
        title: {
            km: "ពាក្យ «មាន» និង «អាចមាន»",
            en: "Contains and may contain",
        },
        summary: {
            km: "ពាក្យទាំងពីរនេះបង្ហាញពីប្រភេទនៃការប្រកាសខុសគ្នា។",
            en: "These phrases describe different kinds of label declarations.",
        },
        body: {
            km: "ការប្រកាស «មាន» និង «អាចមាន» ត្រូវអានតាមអត្ថបទដើម និងបរិបទរបស់ស្លាក។ កម្មវិធីមិនបម្លែងពាក្យទាំងនេះទៅជាការធានាសុវត្ថិភាពទេ។",
            en: "“Contains” and “may contain” should be read from the original label text and its context. The app does not turn either phrase into a safety guarantee.",
        },
    },
    {
        kind: "simulated",
        slug: "no-declaration-is-not-allergen-free",
        topic: "declarations",
        title: {
            km: "មិនឃើញការប្រកាស មិនមែនគ្មានអាលែហ្សែន",
            en: "No declaration is not allergen-free",
        },
        summary: {
            km: "អវត្តមាននៃពាក្យប្រកាសមួយ មិនបញ្ជាក់ពីអវត្តមានរបស់អាលែហ្សែនទេ។",
            en: "The absence of a declaration does not establish the absence of an allergen.",
        },
        body: {
            km: "ប្រសិនបើភស្តុតាងអាចអានបានពេញលេញ ប្រព័ន្ធអាចរាយការណ៍ថាមិនបានរកឃើញការប្រកាស។ នេះមិនមែនជាការធានាថា Product គ្មានអាលែហ្សែនទេ។",
            en: "When readable evidence is complete, the system may report that no declaration was detected. That is not a guarantee that a Product is allergen-free.",
        },
    },
    {
        kind: "simulated",
        slug: "readable-and-incomplete-labels",
        topic: "evidence",
        title: {
            km: "ស្លាកអាចអានបាន និងស្លាកមិនពេញលេញ",
            en: "Readable and incomplete labels",
        },
        summary: {
            km: "ភាពមិនពេញលេញរបស់រូបភាព ឬអត្ថបទធ្វើឲ្យការណែនាំនៅមានភាពមិនច្បាស់។",
            en: "Missing or unreadable label areas keep guidance uncertain.",
        },
        body: {
            km: "ស្លាកដែលបាត់ផ្នែក ឬអានមិនច្បាស់ ត្រូវបង្ហាញជាភស្តុតាងមិនច្បាស់លាស់។ វាមិនគួរត្រូវបានបកស្រាយថាជា «គ្មាន» ទេ។",
            en: "A label with missing or unreadable areas is evidence uncertainty. It should not be interpreted as “none.”",
        },
    },
    {
        kind: "simulated",
        slug: "ingredient-list-structure",
        topic: "ingredients",
        title: {
            km: "របៀបអានបញ្ជីគ្រឿងផ្សំ",
            en: "Ingredient-list structure",
        },
        summary: {
            km: "លំដាប់ វង់ក្រចក និងភាគរយជួយរក្សាអត្ថន័យរបស់ស្លាកដើម។",
            en: "Order, brackets, and percentages preserve the meaning of the original label.",
        },
        body: {
            km: "ការពន្យល់គួររក្សាអត្ថបទដើម លំដាប់ និងគ្រឿងផ្សំរង។ ការបកប្រែខ្លីមិនគួរជំនួសភស្តុតាងដើមទេ។",
            en: "An explanation should preserve original text, order, and compound ingredients. A short translation does not replace the source evidence.",
        },
    },
    {
        kind: "simulated",
        slug: "additive-names-and-functions",
        topic: "ingredients",
        title: {
            km: "ឈ្មោះ និងមុខងារសារធាតុបន្ថែម",
            en: "Additive names and functions",
        },
        summary: {
            km: "លេខ ឬឈ្មោះសារធាតុបន្ថែមគួរត្រូវបានបង្ហាញជាមួយបរិបទ និងភាពមិនច្បាស់។",
            en: "Additive names or numbers need context and visible uncertainty.",
        },
        body: {
            km: "ការមានសារធាតុបន្ថែមមួយ មិនមានន័យថាវាគ្រោះថ្នាក់ទេ។ ការពន្យល់ត្រូវបែងចែកឈ្មោះ មុខងារ និងភស្តុតាងចេញពីគ្នា។",
            en: "The presence of an additive does not make it dangerous. Explanations keep its name, function, and evidence distinct.",
        },
    },
    {
        kind: "simulated",
        slug: "date-marking-types",
        topic: "dates",
        title: {
            km: "ប្រភេទកាលបរិច្ឆេទលើស្លាក",
            en: "Types of date markings",
        },
        summary: {
            km: "កាលបរិច្ឆេទផលិត ប្រើមុន និងផុតកំណត់មានន័យខុសគ្នា។",
            en: "Manufacture, best-before, and expiry markings have different meanings.",
        },
        body: {
            km: "ត្រូវរក្សាទុកអត្ថបទកាលបរិច្ឆេទដើម និងបង្ហាញភាពមិនច្បាស់ ប្រសិនបើទម្រង់ ឬអត្ថន័យមិនអាចបកស្រាយបាន។",
            en: "Keep the original date text and show uncertainty when its format or meaning cannot be interpreted reliably.",
        },
    },
    {
        kind: "simulated",
        slug: "seal-observation-and-certification",
        topic: "dates",
        title: {
            km: "សញ្ញាដែលមើលឃើញ និងវិញ្ញាបនបត្រ",
            en: "Visible seals and certification",
        },
        summary: {
            km: "ការមើលឃើញសញ្ញាមួយ មិនមែនជាការផ្ទៀងផ្ទាត់វិញ្ញាបនបត្រទេ។",
            en: "Seeing a mark is not the same as verifying a certificate.",
        },
        body: {
            km: "ប្រព័ន្ធអាចកត់ត្រាអ្វីដែលមើលឃើញលើកញ្ចប់ ប៉ុន្តែមិនអះអាងសុពលភាព ឬវិសាលភាពវិញ្ញាបនបត្រទេ។",
            en: "The system may record what is visible on a package, but it does not assert certificate validity or scope.",
        },
    },
    {
        kind: "simulated",
        slug: "package-revision-differences",
        topic: "dates",
        title: {
            km: "ភាពខុសគ្នារវាងកំណែកញ្ចប់",
            en: "Package Revision differences",
        },
        summary: {
            km: "ការផ្លាស់ប្តូរស្លាក ឬទីផ្សារ អាចបង្កើតកំណែកញ្ចប់ផ្សេងគ្នា។",
            en: "Label or market changes can represent different Package Revisions.",
        },
        body: {
            km: "ការផ្គូផ្គងដោយលេខសម្គាល់ ឬរូបភាពគឺជាបេក្ខជនប៉ុណ្ណោះ។ វាមិនបញ្ជាក់ថាកញ្ចប់នៅក្នុងដៃដូចគ្នាទាំងស្រុងទេ។",
            en: "An identifier or image match is only a candidate. It does not prove that the physical package is the same revision.",
        },
    },
]

export const LEARN_TOPIC_ORDER: LearnTopic[] = [
    "laws",
    "declarations",
    "evidence",
    "ingredients",
    "dates",
]

export const LEARN_TOPIC_LABELS: Record<LearnTopic, string> = {
    laws: "Laws & Regulations",
    declarations: "Declarations & Claims",
    evidence: "Evidence & Uncertainty",
    ingredients: "Ingredients & Additives",
    dates: "Dates & Seals",
}
