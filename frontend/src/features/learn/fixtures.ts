export type LearnLocale = "km" | "en"

export type LearnTopic =
    "laws" | "declarations" | "halal" | "evidence" | "ingredients" | "dates"

export type LocalizedText = {
    en: string
    km?: string
}

export type KnowledgeImage = {
    src: string
    alt: LocalizedText
}

type KnowledgeEntryBase = {
    slug: string
    topic: LearnTopic
    title: LocalizedText
    summary: LocalizedText
    body: LocalizedText
    learningOutcome?: LocalizedText
    doesNotProve?: LocalizedText
    relatedSlugs?: string[]
    image?: KnowledgeImage
}

export type KnowledgeSource = {
    label: LocalizedText
    url: string
}

export type SourcedKnowledgeEntry = KnowledgeEntryBase & {
    kind: "sourced"
    cardSummary: LocalizedText
    keyPoints?: LocalizedText[]
    publisher: LocalizedText
    issuingAgency?: LocalizedText
    documentReference?: LocalizedText
    jurisdiction?: LocalizedText
    date?: {
        label: LocalizedText
        value: LocalizedText
    }
    sources: KnowledgeSource[]
    sourceDisclosure: LocalizedText
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
        date: {
            label: {
                km: "កាលបរិច្ឆេទចុះហត្ថលេខា",
                en: "Signed",
            },
            value: {
                km: "៨ មិថុនា ២០២២",
                en: "June 8, 2022",
            },
        },
        sources: [
            {
                label: {
                    km: "កំណត់ត្រាច្បាប់ Open Development Cambodia",
                    en: "Open Development Cambodia law record",
                },
                url: "https://data.opendevelopmentcambodia.net/laws_record/law-on-food-safety",
            },
            {
                label: {
                    km: "ធនធាន PDF ភាសាខ្មែរ",
                    en: "Khmer PDF resource",
                },
                url: "https://data.opendevelopmentcambodia.net/laws_record/law-on-food-safety/resource/1406ab5a-0097-43e9-99db-234b80cfb7ec",
            },
            {
                label: {
                    km: "ធនធាន PDF ភាសាអង់គ្លេស",
                    en: "English PDF resource",
                },
                url: "https://data.opendevelopmentcambodia.net/laws_record/law-on-food-safety/resource/525730c8-110a-4670-a3b5-80d08db2c82b",
            },
        ],
        sourceDisclosure: {
            km: "នេះជាប្រភពខាងក្រៅ។ LifeGoods មិនបានផ្ទៀងផ្ទាត់ ឬបកស្រាយព័ត៌មានផ្លូវច្បាប់នេះដោយឯករាជ្យទេ។ ព័ត៌មាននេះមិនមែនជាការប្រឹក្សាផ្លូវច្បាប់ទេ។",
            en: "This is an external source. LifeGoods has not independently verified or interpreted this legal information. This information is not legal advice.",
        },
    },
    {
        kind: "sourced",
        slug: "food-allergies-what-you-need-to-know",
        topic: "declarations",
        title: {
            km: "អាឡែហ្ស៊ីអាហារ៖ អ្វីដែលអ្នកត្រូវដឹង",
            en: "Food Allergies: What You Need to Know",
        },
        summary: {
            km: "ទំព័ររបស់ FDA ពន្យល់អំពីអាឡែហ្សែនអាហារសំខាន់ៗ និងវិធីដែលអាឡែហ្សែនអាចត្រូវបានបង្ហាញលើស្លាកនៅសហរដ្ឋអាមេរិក។",
            en: "The FDA page explains major food allergens and how allergen sources may be declared on labels in the United States.",
        },
        cardSummary: {
            km: "ការណែនាំរបស់ FDA អំពីអាឡែហ្សែនសំខាន់ៗ និងការបង្ហាញប្រភពអាឡែហ្សែនលើស្លាក។",
            en: "FDA guidance on major allergens and declaring allergen sources on labels.",
        },
        body: {
            km: "ប្រភពនេះជាការណែនាំសម្រាប់អាហារដែលស្ថិតក្រោមការគ្រប់គ្រងរបស់ FDA នៅសហរដ្ឋអាមេរិក។ វាជួយអានពាក្យប្រកាសលើស្លាក ប៉ុន្តែមិនមែនជាការកំណត់ថា Product ណាមួយសមស្របសម្រាប់មនុស្សម្នាក់ទេ។ សូមប្រើប្រភពដើមសម្រាប់ព័ត៌មានវេជ្ជសាស្ត្រ និងតម្រូវការតាមដែនសមត្ថកិច្ច។",
            en: "This source is guidance for foods regulated by the FDA in the United States. It helps explain label declarations, but it does not determine whether a particular Product is suitable for an individual. Use the original source for medical information and jurisdiction-specific requirements.",
        },
        keyPoints: [
            {
                km: "ទំព័រនេះរាយអាឡែហ្សែនសំខាន់ ៩ ប្រភេទ៖ ទឹកដោះគោ ស៊ុត ត្រី សត្វសមុទ្រសំបក ដើមឈើមានគ្រាប់ សណ្ដែកដី ស្រូវសាលី សណ្ដែកសៀង និងល្ង។",
                en: "It lists nine major allergens: milk, eggs, fish, crustacean shellfish, tree nuts, peanuts, wheat, soybeans, and sesame.",
            },
            {
                km: "ប្រភពអាឡែហ្សែនអាចបង្ហាញក្នុងវង់ក្រចកបន្ទាប់ពីឈ្មោះគ្រឿងផ្សំ ឬក្នុងសេចក្ដីប្រកាស “Contains” ជិតបញ្ជីគ្រឿងផ្សំ។",
                en: "An allergen source may appear in parentheses after an ingredient name or in a nearby “Contains” statement.",
            },
            {
                km: "តម្រូវការដែលបានពន្យល់នេះជារបស់សហរដ្ឋអាមេរិក ហើយមិនគួរយកទៅសន្និដ្ឋានថាជាច្បាប់កម្ពុជាទេ។",
                en: "The requirements described are U.S.-specific and should not be treated as Cambodian law.",
            },
        ],
        publisher: {
            km: "រដ្ឋបាលចំណីអាហារ និងឱសថសហរដ្ឋអាមេរិក (FDA)",
            en: "U.S. Food and Drug Administration (FDA)",
        },
        jurisdiction: {
            km: "សហរដ្ឋអាមេរិក",
            en: "United States",
        },
        sources: [
            {
                label: {
                    km: "អត្ថបទណែនាំរបស់ FDA",
                    en: "FDA guidance article",
                },
                url: "https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know",
            },
        ],
        sourceDisclosure: {
            km: "នេះជាការណែនាំពីប្រភពខាងក្រៅរបស់សហរដ្ឋអាមេរិក។ LifeGoods មិនបានផ្ទៀងផ្ទាត់ ឬបកស្រាយវាជាការណែនាំវេជ្ជសាស្ត្រ ឬជាតម្រូវការរបស់កម្ពុជាទេ។",
            en: "This is external U.S. guidance. LifeGoods has not independently verified or interpreted it as medical advice or as a Cambodian requirement.",
        },
    },
    {
        kind: "sourced",
        slug: "general-guidelines-use-term-halal",
        topic: "halal",
        title: {
            km: "គោលការណ៍ណែនាំទូទៅសម្រាប់ការប្រើពាក្យ «ហាឡាល់»",
            en: "General Guidelines for Use of the Term “Halal”",
        },
        summary: {
            km: "គោលការណ៍ណែនាំ Codex ពន្យល់ពីការប្រើពាក្យ Halal ក្នុងការអះអាងលើស្លាក និងលក្ខខណ្ឌទូទៅសម្រាប់អាហារ ការកែច្នៃ និងការរក្សាទុក។",
            en: "The Codex guidelines explain use of Halal claims on labels and general conditions for food preparation, processing, and storage.",
        },
        cardSummary: {
            km: "គោលការណ៍ណែនាំអន្តរជាតិសម្រាប់ការអះអាង Halal និងការរក្សាការបំបែកពីអាហារមិនស្របតាមច្បាប់អ៊ីស្លាម។",
            en: "International guidance for Halal claims and preventing contact with unlawful food.",
        },
        body: {
            km: "CAC/GL 24-1997 ជាអត្ថបទណែនាំរបស់ Codex Alimentarius Commission ដែលប្រទេសនីមួយៗអាចបកស្រាយតាមអាជ្ញាធររបស់ខ្លួន។ វាពិពណ៌នាអំពីអាហារ Halal ការរៀបចំ ការកែច្នៃ ការវេចខ្ចប់ ការដឹកជញ្ជូន និងការរក្សាទុក។ ការមើលឃើញពាក្យ ឬសញ្ញា Halal លើកញ្ចប់ មិនមែនជាការផ្ទៀងផ្ទាត់ Certificate ទេ។",
            en: "CAC/GL 24-1997 is Codex Alimentarius Commission guidance that each country may interpret through its appropriate authorities. It describes Halal food and conditions for preparation, processing, packaging, transport, and storage. Seeing a Halal word or mark on a package is not verification of a Certificate.",
        },
        keyPoints: [
            {
                km: "គោលការណ៍ណែនាំអនុវត្តចំពោះការប្រើពាក្យ Halal និងពាក្យមានន័យស្មើគ្នាក្នុងការអះអាងលើស្លាក។",
                en: "The guidance applies to use of Halal and equivalent terms in label claims.",
            },
            {
                km: "លក្ខខណ្ឌទូទៅរួមមានការមិនមានប្រភពមិនស្របតាមច្បាប់អ៊ីស្លាម និងការការពារការប៉ះពាល់ជាមួយអាហារប្រភេទនោះក្នុងដំណើរការ។",
                en: "General conditions include avoiding unlawful sources and preventing contact with them during processing and handling.",
            },
            {
                km: "ការអះអាង Halal មិនគួរបង្កើតការសង្ស័យអំពីសុវត្ថិភាពអាហារផ្សេងទៀត ឬអះអាងថាអាហារ Halal មានសុខភាពល្អជាងទេ។",
                en: "A Halal claim should not imply that other food is unsafe or that Halal food is nutritionally superior or healthier.",
            },
        ],
        publisher: {
            km: "អង្គការស្បៀងអាហារ និងកសិកម្ម (FAO)",
            en: "Food and Agriculture Organization (FAO)",
        },
        issuingAgency: {
            km: "គណៈកម្មការកូដិច អាលីម៉ង់តារីយ៉ូស",
            en: "Codex Alimentarius Commission",
        },
        documentReference: {
            km: "CAC/GL 24-1997",
            en: "CAC/GL 24-1997",
        },
        jurisdiction: {
            km: "អន្តរជាតិ (គោលការណ៍ណែនាំយោបល់)",
            en: "International (advisory guidance)",
        },
        date: {
            label: {
                km: "ឆ្នាំអនុម័ត",
                en: "Adopted",
            },
            value: {
                km: "១៩៩៧",
                en: "1997",
            },
        },
        sources: [
            {
                label: {
                    km: "គោលការណ៍ណែនាំ FAO/Codex",
                    en: "FAO/Codex guidelines",
                },
                url: "https://www.fao.org/4/y2770e/y2770e08.htm#TopOfPage",
            },
        ],
        sourceDisclosure: {
            km: "នេះជាគោលការណ៍ណែនាំខាងក្រៅ។ LifeGoods មិនបានផ្ទៀងផ្ទាត់ការអះអាង Halal ឬសុពលភាព Certificate របស់ Product ណាមួយទេ។",
            en: "This is external guidance. LifeGoods does not verify a Product’s Halal claim or Certificate validity.",
        },
    },
    {
        kind: "sourced",
        slug: "cambodian-standard-cs-001-2000",
        topic: "laws",
        title: {
            km: "ស្តង់ដារកម្ពុជា CS 001-2000 ស្តីពីការដាក់ស្លាកផលិតផលម្ហូបអាហារ",
            en: "Cambodian Standard CS 001-2000: Labelling of Food Product",
        },
        summary: {
            km: "ប្រកាសលេខ ១០៤៥ បង្កើតស្តង់ដារ CS 001-2000 សម្រាប់ការដាក់ស្លាកអាហារវេចខ្ចប់មុនដែលត្រូវផ្តល់ព័ត៌មានច្បាស់លាស់ដល់អ្នកប្រើប្រាស់ និងអាជ្ញាធរ។",
            en: "Prakas No. 1045 establishes CS 001-2000 for labelling prepackaged foods with clear information for consumers and authorities.",
        },
        cardSummary: {
            km: "ស្តង់ដារកម្ពុជាសម្រាប់ព័ត៌មានដែលត្រូវបង្ហាញលើស្លាកអាហារវេចខ្ចប់មុន។",
            en: "Cambodia’s standard for information required on prepackaged-food labels.",
        },
        body: {
            km: "ស្តង់ដារ CS 001-2000 អនុវត្តចំពោះអាហារវេចខ្ចប់មុនសម្រាប់អ្នកប្រើប្រាស់ ឬគោលបំណងផ្គត់ផ្គង់ម្ហូបអាហារ។ វាកំណត់ព័ត៌មានដូចជា ឈ្មោះអាហារ បញ្ជីគ្រឿងផ្សំ បរិមាណ ឈ្មោះនិងអាសយដ្ឋាន អ្នកផលិតឬអ្នកចែកចាយ ប្រទេសដើម លេខឡូត៍ និងកាលបរិច្ឆេទជាមួយការណែនាំរក្សាទុក។ ទំព័រប្រភពបង្ហាញការបកប្រែជាភាសាអង់គ្លេសដែលមិនមែនជាកំណែផ្លូវការ។",
            en: "CS 001-2000 applies to prepackaged foods offered to consumers or for catering. It covers information such as the food name, ingredient list, quantity, responsible organization’s name and address, country of origin, lot number, and date marking with storage instructions. The source page identifies its English text as an unofficial translation.",
        },
        keyPoints: [
            {
                km: "អាហារវេចខ្ចប់មុនត្រូវមានព័ត៌មានច្បាស់លាស់ និងគ្រប់គ្រាន់លើស្លាក។",
                en: "Prepackaged foods must carry clear and sufficient label information.",
            },
            {
                km: "បញ្ជីគ្រឿងផ្សំត្រូវរៀបតាមលំដាប់បរិមាណចូលពីច្រើនទៅតិច ហើយអាចរួមបញ្ចូលគ្រឿងផ្សំរងក្នុងវង់ក្រចក។",
                en: "Ingredients are listed in descending order of ingoing amount, with compound ingredients and their sub-ingredients shown in brackets where applicable.",
            },
            {
                km: "លេខឡូត៍ ប្រទេសដើម និងការសម្គាល់កាលបរិច្ឆេទជួយកំណត់អត្តសញ្ញាណ និងព័ត៌មានរក្សាទុករបស់ទំនិញ។",
                en: "Lot numbers, country of origin, and date markings provide identification and storage information for the food.",
            },
        ],
        publisher: {
            km: "National Trade Repository កម្ពុជា",
            en: "Cambodia National Trade Repository",
        },
        issuingAgency: {
            km: "ក្រសួងឧស្សាហកម្ម រ៉ែ និងថាមពល",
            en: "Ministry of Industry, Mines and Energy",
        },
        documentReference: {
            km: "ប្រកាសលេខ ១០៤៥; CS 001-2000",
            en: "Prakas No. 1045; CS 001-2000",
        },
        jurisdiction: {
            km: "កម្ពុជា",
            en: "Cambodia",
        },
        date: {
            label: {
                km: "កាលបរិច្ឆេទចុះហត្ថលេខា",
                en: "Signed",
            },
            value: {
                km: "២៨ ធ្នូ ២០០០",
                en: "December 28, 2000",
            },
        },
        sources: [
            {
                label: {
                    km: "កំណត់ត្រាស្តង់ដារ National Trade Repository",
                    en: "National Trade Repository standard record",
                },
                url: "https://cambodiantr.gov.kh/en/document/?title=prakas-no-1045-isc-cs001-2000-labeling-of-food-product",
            },
        ],
        sourceDisclosure: {
            km: "នេះជាប្រភពច្បាប់ខាងក្រៅ។ ទំព័រនេះបង្ហាញអត្ថបទអង់គ្លេសជាការបកប្រែមិនមែនជាកំណែផ្លូវការ។ LifeGoods មិនបានបកស្រាយ ឬសន្និដ្ឋានអំពីភាពស្របច្បាប់របស់ Product ណាមួយទេ។",
            en: "This is an external regulatory source. Its English text is identified as an unofficial translation. LifeGoods does not interpret it as a compliance conclusion for any Product.",
        },
    },
    {
        kind: "sourced",
        slug: "prakas-0059-nutrition-labelling",
        topic: "laws",
        title: {
            km: "ប្រកាសលេខ ០០៥៩ ស្តីពីតម្រូវការព័ត៌មានអាហារូបត្ថម្ភសម្រាប់ស្លាកអាហារវេចខ្ចប់មុន",
            en: "Prakas No. 0059: Nutrition Information Requirements for Labelling Prepackaged Food",
        },
        summary: {
            km: "ប្រកាសនេះកំណត់តម្រូវការព័ត៌មានអាហារូបត្ថម្ភសម្រាប់ស្លាកអាហារវេចខ្ចប់មុន ដើម្បីជួយការពារអ្នកប្រើប្រាស់ និងលើកកម្ពស់ការធ្វើពាណិជ្ជកម្មដោយស្មោះត្រង់។",
            en: "This Prakas sets nutrition-information requirements for prepackaged-food labels to protect consumers and promote fair food trade.",
        },
        cardSummary: {
            km: "តម្រូវការរបស់កម្ពុជាសម្រាប់ការបង្ហាញព័ត៌មានអាហារូបត្ថម្ភលើស្លាកអាហារវេចខ្ចប់មុន។",
            en: "Cambodian requirements for nutrition information on prepackaged-food labels.",
        },
        body: {
            km: "កំណត់ត្រារបស់ Open Development Cambodia បង្ហាញថា ប្រកាសលេខ ០០៥៩ កំណត់ព័ត៌មានអាហារូបត្ថម្ភដែលត្រូវបង្ហាញលើស្លាកអាហារវេចខ្ចប់មុន។ គោលបំណងដែលបានសរសេរគឺកុំឲ្យអាហារត្រូវបានចែកចាយដោយបោកបញ្ឆោត និងដើម្បីការពារសុខុមាលភាពអ្នកប្រើប្រាស់ និងការធ្វើពាណិជ្ជកម្មដោយស្មោះត្រង់។ សូមអានកំណត់ត្រា និងឯកសារ PDF ភាសាខ្មែរ ឬអង់គ្លេសសម្រាប់តម្រូវការពេញលេញ។",
            en: "Open Development Cambodia’s record describes Prakas No. 0059 as setting nutrition-information requirements for prepackaged-food labels. Its stated purpose is to prevent fraudulent or deceptive circulation of food, protect consumer welfare, and promote fair food trade. Consult the record and linked Khmer or English PDFs for the complete requirements.",
        },
        keyPoints: [
            {
                km: "ប្រកាសនេះអនុវត្តចំពោះព័ត៌មានអាហារូបត្ថម្ភលើស្លាកអាហារវេចខ្ចប់មុននៅកម្ពុជា។",
                en: "The Prakas concerns nutrition information on prepackaged-food labels in Cambodia.",
            },
            {
                km: "គោលបំណងដែលបានបញ្ជាក់គឺការពារអ្នកប្រើប្រាស់ពីព័ត៌មានបោកបញ្ឆោត និងលើកកម្ពស់ការធ្វើពាណិជ្ជកម្មដោយស្មោះត្រង់។",
                en: "Its stated aims are consumer protection from deceptive information and fair food trade.",
            },
            {
                km: "ឯកសារមានធនធាន PDF ជាភាសាខ្មែរ និងអង់គ្លេស ដើម្បីអានតម្រូវការដើមឲ្យបានពេញលេញ។",
                en: "The record provides Khmer and English PDF resources for the complete original requirements.",
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
            km: "០០៥៩ ប.អ.ក.ប.ប្រក",
            en: "0059 P.N. A.KBB.PrK",
        },
        jurisdiction: {
            km: "កម្ពុជា",
            en: "Cambodia",
        },
        date: {
            label: {
                km: "កាលបរិច្ឆេទចុះហត្ថលេខា",
                en: "Signed",
            },
            value: {
                km: "២២ កុម្ភៈ ២០២២",
                en: "February 22, 2022",
            },
        },
        sources: [
            {
                label: {
                    km: "កំណត់ត្រាច្បាប់ Open Development Cambodia",
                    en: "Open Development Cambodia law record",
                },
                url: "https://data.opendevelopmentcambodia.net/en/laws_record/prakas-n-0059-on-nutrition-information-requirements-for-the-labelling-of-pre-packaging-food-product",
            },
            {
                label: {
                    km: "ធនធាន PDF ភាសាខ្មែរ",
                    en: "Khmer PDF resource",
                },
                url: "https://data.opendevelopmentcambodia.net/en/laws_record/prakas-n-0059-on-nutrition-information-requirements-for-the-labelling-of-pre-packaging-food-product/resource/da15bcfa-a256-43f7-a21b-8f4f0c0d1467",
            },
            {
                label: {
                    km: "ធនធាន PDF ភាសាអង់គ្លេស",
                    en: "English PDF resource",
                },
                url: "https://data.opendevelopmentcambodia.net/en/laws_record/prakas-n-0059-on-nutrition-information-requirements-for-the-labelling-of-pre-packaging-food-product/resource/b9f8e8d6-f568-48b1-8104-a3e36ea57b68",
            },
        ],
        sourceDisclosure: {
            km: "នេះជាប្រភពច្បាប់ខាងក្រៅ។ LifeGoods មិនបានផ្ទៀងផ្ទាត់ ឬបកស្រាយតម្រូវការនេះជាការវិនិច្ឆ័យភាពស្របច្បាប់របស់ Product ណាមួយទេ។",
            en: "This is an external regulatory source. LifeGoods has not independently verified or interpreted it as a compliance conclusion for any Product.",
        },
    },
    {
        kind: "sourced",
        slug: "what-a-barcode-can-tell-you",
        topic: "evidence",
        title: { en: "What a barcode can—and cannot—tell you" },
        summary: {
            en: "A barcode is an identifier for a Package Variant, not proof that every detail on the package is current or authentic.",
        },
        cardSummary: {
            en: "Learn what a GTIN identifies and which questions still need label Evidence.",
        },
        body: {
            en: "Verified by GS1 can check whether a GTIN is properly structured, issued by GS1, and associated with a licensed company. A valid number does not prove the product’s origin, authenticity, importer, or current Package Revision.",
        },
        learningOutcome: {
            en: "Use a barcode to start a lookup, then compare the returned candidate with the package in your hand.",
        },
        doesNotProve: {
            en: "It does not establish that a Product is genuine, safe, compliant, or identical to the physical package.",
        },
        relatedSlugs: [
            "where-product-data-comes-from",
            "package-revision-differences",
        ],
        publisher: { en: "GS1" },
        issuingAgency: { en: "GS1 Global Office" },
        documentReference: { en: "Verified by GS1" },
        jurisdiction: { en: "Global identifier service" },
        sources: [
            {
                label: { en: "Verified by GS1" },
                url: "https://www.gs1.org/services/verified-by-gs1",
            },
        ],
        sourceDisclosure: {
            en: "This is external identifier guidance. LifeGoods uses barcode information as a lookup key and does not treat it as proof of physical-package identity.",
        },
    },
    {
        kind: "sourced",
        slug: "where-product-data-comes-from",
        topic: "evidence",
        title: { en: "Where Product information comes from" },
        summary: {
            en: "Open Food Facts is a collaborative external dataset. Its records can help with lookup, but fields may be missing, stale, or incorrect.",
        },
        cardSummary: {
            en: "Understand why external community data stays attributed and visibly uncertain.",
        },
        body: {
            en: "Open Food Facts documents that its data is provided voluntarily and comes without assurances that it is accurate, complete, or reliable. LifeGoods keeps that source attribution and retrieval context visible instead of turning an empty field into a negative Claim.",
        },
        learningOutcome: {
            en: "Treat an external record as one piece of Evidence and compare it with readable package details.",
        },
        doesNotProve: {
            en: "An Open Food Facts record is not a project-reviewed Product, Package Variant, or Package Revision.",
        },
        relatedSlugs: [
            "what-a-barcode-can-tell-you",
            "evidence-uncertainty-unreadable-labels",
        ],
        publisher: { en: "Open Food Facts" },
        documentReference: { en: "API documentation" },
        jurisdiction: { en: "International community dataset" },
        sources: [
            {
                label: { en: "Open Food Facts API documentation" },
                url: "https://openfoodfacts.github.io/openfoodfacts-server/api/",
            },
        ],
        sourceDisclosure: {
            en: "This is external community data guidance. LifeGoods preserves the source’s own limitations and does not independently verify every record.",
        },
    },
    {
        kind: "sourced",
        slug: "what-additives-and-ins-numbers-mean",
        topic: "ingredients",
        title: { en: "What additive names and INS numbers mean" },
        summary: {
            en: "Additive names, synonyms, INS numbers, and functional classes describe what an ingredient does in a food.",
        },
        cardSummary: {
            en: "Read additive terminology without turning presence into a danger judgment.",
        },
        body: {
            en: "The Codex GSFA can be searched by additive name, synonym, INS number, function, and food category. Its entries are interpreted with their food category and conditions of use; the appearance of an additive alone does not show that a product exceeds a limit or violates Cambodian law.",
        },
        learningOutcome: {
            en: "Use the additive name or INS number to understand its stated function and locate the relevant reference.",
        },
        doesNotProve: {
            en: "LifeGoods does not infer that an additive is dangerous, excessive, or prohibited just because it appears on a label.",
        },
        relatedSlugs: [
            "ingredient-list-structure",
            "evidence-uncertainty-unreadable-labels",
        ],
        publisher: { en: "FAO/WHO Codex Alimentarius" },
        documentReference: { en: "GSFA Online (Codex STAN 192-1995)" },
        jurisdiction: { en: "International reference" },
        sources: [
            {
                label: { en: "Codex GSFA Online database" },
                url: "https://www.fao.org/fao-who-codexalimentarius/codex-texts/dbs/gsfa/en/",
            },
        ],
        sourceDisclosure: {
            en: "This is an international reference. Cambodian requirements may differ and require a jurisdiction- and category-specific source.",
        },
    },
    {
        kind: "sourced",
        slug: "date-and-lot-markings",
        topic: "dates",
        title: { en: "Dates, lot codes, and storage instructions" },
        summary: {
            en: "Date marks and lot codes answer different questions about a package and should be read with their exact label wording.",
        },
        cardSummary: {
            en: "Separate manufacture, best-before, use-by, lot, and storage information.",
        },
        body: {
            en: "A date may describe manufacture, best-before, use-by or expiry, while a lot code helps identify a production group. Storage instructions add context. LifeGoods preserves the exact source text and reports uncertain meaning instead of saying that a product is safe.",
        },
        learningOutcome: {
            en: "Check the date label, lot or batch code, and storage instruction together on the physical package.",
        },
        doesNotProve: {
            en: "A date result is not a universal safety, freshness, or purchase recommendation.",
        },
        relatedSlugs: [
            "evidence-uncertainty-unreadable-labels",
            "package-revision-differences",
        ],
        publisher: { en: "Codex Alimentarius Commission" },
        documentReference: {
            en: "General Standard for the Labelling of Pre-packaged Foods (CXS 1-1985)",
        },
        jurisdiction: { en: "International reference" },
        sources: [
            {
                label: { en: "Codex labelling standard" },
                url: "https://www.fao.org/4/Y2770E/y2770e02.htm",
            },
        ],
        sourceDisclosure: {
            en: "This is an international labeling reference. Local requirements and the meaning of a package’s exact date mark may differ.",
        },
    },
    {
        kind: "sourced",
        slug: "evidence-uncertainty-unreadable-labels",
        topic: "evidence",
        title: { en: "When a label is unreadable or incomplete" },
        summary: {
            en: "A cropped, blurry, or incomplete label leaves Evidence uncertain; an unreadable field is not the same as an absent declaration.",
        },
        cardSummary: {
            en: "Learn why missing label areas should stay visibly uncertain.",
        },
        body: {
            en: "Codex labelling guidance is a reference for the information presented on pre-packaged food labels. When the package image does not show that information clearly, LifeGoods records the gap and keeps the original wording separate from any explanation.",
        },
        learningOutcome: {
            en: "Look for the complete panel, preserve the exact visible text, and ask for a clearer capture when a field cannot be read.",
        },
        doesNotProve: {
            en: "An unreadable or missing area does not prove that an ingredient, allergen declaration, date, or mark is absent.",
        },
        relatedSlugs: [
            "where-product-data-comes-from",
            "what-a-barcode-can-tell-you",
        ],
        publisher: { en: "Codex Alimentarius Commission" },
        issuingAgency: { en: "FAO/WHO Codex Alimentarius" },
        documentReference: {
            en: "General Standard for the Labelling of Pre-packaged Foods (CXS 1-1985)",
        },
        jurisdiction: { en: "International reference" },
        sources: [
            {
                label: { en: "Codex labelling standard" },
                url: "https://www.fao.org/4/Y2770E/y2770e02.htm",
            },
        ],
        sourceDisclosure: {
            en: "This is an international labeling reference. LifeGoods reports Evidence Uncertainty when the physical package or capture does not show a field clearly.",
        },
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
    "halal",
    "evidence",
    "ingredients",
    "dates",
]

export const LEARN_TOPIC_LABELS: Record<LearnTopic, string> = {
    laws: "Laws & Regulations",
    declarations: "Declarations & Claims",
    halal: "Halal",
    evidence: "Evidence & Uncertainty",
    ingredients: "Ingredients & Additives",
    dates: "Dates & Seals",
}
