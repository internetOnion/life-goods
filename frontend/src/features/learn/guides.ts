import type { LearnGuide } from "./types"

const commonTableHeadings = {
    itemHeading: { km: "អ្វីដែលត្រូវមើល", en: "What to look for" },
    meaningHeading: { km: "អត្ថន័យ", en: "What it means" },
    boundaryHeading: {
        km: "អ្វីដែលវាមិនបញ្ជាក់",
        en: "What it does not prove",
    },
    sourceHeading: { km: "ប្រភព", en: "Source" },
}

export const LEARN_GUIDES: LearnGuide[] = [
    {
        slug: "how-to-read-a-label",
        category: "label",
        title: { km: "របៀបអានស្លាកអាហារ", en: "How to read a food label" },
        intro: {
            km: "ស្វែងយល់ពីព័ត៌មានសំខាន់ៗដែលស្លាកអាហារវេចខ្ចប់អាចបង្ហាញ និងដែនកំណត់របស់ព័ត៌មាននីមួយៗ។",
            en: "Understand the main information a pre-packaged food label can show—and the limits of each item.",
        },
        entryIds: Array.from(
            { length: 8 },
            (_, index) => `LABEL_${String(index + 1).padStart(3, "0")}`,
        ),
        featured: true,
        table: {
            caption: {
                km: "បញ្ជីពិនិត្យព័ត៌មានលើស្លាក",
                en: "Food-label information checklist",
            },
            ...commonTableHeadings,
        },
    },
    {
        slug: "food-scores",
        category: "food-scores",
        title: { km: "ពិន្ទុអាហារ", en: "Food Scores" },
        intro: {
            km: "ស្វែងយល់ពី Nutri-Score, NOVA និង Green-Score និងអ្វីដែលពិន្ទុនីមួយៗអាច ឬមិនអាចប្រាប់អំពីផលិតផលបាន។",
            en: "Understand Nutri-Score, NOVA, and Green-Score—and what each can and cannot tell you about a product.",
        },
        entryIds: ["FOOD_SCORE_001", "FOOD_SCORE_002", "FOOD_SCORE_003"],
        featured: false,
        table: {
            caption: {
                km: "ពិន្ទុអាហារ និងដែនកំណត់របស់វា",
                en: "Food scores and their limits",
            },
            ...commonTableHeadings,
        },
    },
    {
        slug: "ingredients-and-additives",
        category: "ingredients",
        title: {
            km: "គ្រឿងផ្សំ និងសារធាតុបន្ថែម",
            en: "Ingredients and additives",
        },
        intro: {
            km: "សម្គាល់ភាពខុសគ្នារវាងគ្រឿងផ្សំ សារធាតុបន្ថែម មុខងារ និងលេខ INS ឬ E-number។",
            en: "Separate ingredients, additives, functional classes, and INS or E-number identifiers.",
        },
        entryIds: [
            "INGREDIENT_001",
            "INGREDIENT_002",
            "ADDITIVE_001",
            "ADDITIVE_002",
        ],
        featured: false,
        table: {
            caption: {
                km: "ពាក្យគន្លឹះសម្រាប់គ្រឿងផ្សំ និងសារធាតុបន្ថែម",
                en: "Ingredient and additive terms",
            },
            ...commonTableHeadings,
        },
    },
    {
        slug: "allergen-declarations",
        category: "allergens",
        title: {
            km: "អាលែហ្សែន និងការប្រកាស",
            en: "Allergens and declarations",
        },
        intro: {
            km: "អានបញ្ជីអាលែហ្សែន Codex ស្នូល ដាច់ដោយឡែកពីអាលែហ្សែនបន្ថែមដែលអាចអាស្រ័យលើប្រទេស ឬតំបន់។",
            en: "Read the core Codex allergen list separately from additional allergens that may depend on a country or region.",
        },
        entryIds: Array.from(
            { length: 4 },
            (_, index) =>
                `ALLERGEN_LEARN_${String(index + 1).padStart(3, "0")}`,
        ),
        featured: true,
        table: {
            caption: {
                km: "ការប្រកាសអាលែហ្សែន និងដែនកំណត់",
                en: "Allergen declarations and their limits",
            },
            ...commonTableHeadings,
        },
    },
    {
        slug: "halal-information",
        category: "halal",
        title: {
            km: "ព័ត៌មានពាក់ព័ន្ធហាឡាល់",
            en: "Halal-related information",
        },
        intro: {
            km: "រក្សាការពិនិត្យគ្រឿងផ្សំ ការមើលឃើញសញ្ញា និងការផ្ទៀងផ្ទាត់វិញ្ញាបនបត្រឱ្យនៅដាច់ពីគ្នា។",
            en: "Keep ingredient screening, visible label claims, and certificate verification separate.",
        },
        entryIds: Array.from(
            { length: 4 },
            (_, index) => `HALAL_LEARN_${String(index + 1).padStart(3, "0")}`,
        ),
        featured: false,
        table: {
            caption: {
                km: "ប្រភេទភស្តុតាងពាក់ព័ន្ធហាឡាល់",
                en: "Types of Halal-related evidence",
            },
            ...commonTableHeadings,
        },
    },
    {
        slug: "package-marks",
        category: "marks",
        title: {
            km: "កាលបរិច្ឆេទ និងសញ្ញាលើកញ្ចប់",
            en: "Dates and package marks",
        },
        intro: {
            km: "សម្គាល់បាកូដ លេខឡូត កាលបរិច្ឆេទ ការរក្សាទុក និងសញ្ញាសម្ភារៈ ដោយមិនបន្ថែមការសន្និដ្ឋាន។",
            en: "Identify barcodes, lot codes, date marks, storage instructions, and material symbols without adding conclusions.",
        },
        entryIds: Array.from(
            { length: 7 },
            (_, index) => `MARK_LEARN_${String(index + 1).padStart(3, "0")}`,
        ),
        featured: false,
        table: {
            caption: {
                km: "សញ្ញាលើកញ្ចប់ និងអត្ថន័យរបស់វា",
                en: "Package marks and what they indicate",
            },
            ...commonTableHeadings,
        },
    },
]

export const LEARN_GUIDE_BY_SLUG = new Map(
    LEARN_GUIDES.map((guide) => [guide.slug, guide]),
)

export const LEARN_GUIDE_BY_CATEGORY = new Map(
    LEARN_GUIDES.map((guide) => [guide.category, guide]),
)
