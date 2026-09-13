import type { LearnSource } from "./types"

const retrievedAt = "2026-09-02"

export const LEARN_SOURCES: LearnSource[] = [
    {
        id: "codex-label-2026",
        name: {
            km: "ស្តង់ដារទូទៅសម្រាប់ការដាក់ស្លាកអាហារវេចខ្ចប់ទុកជាមុន",
            en: "General Standard for the Labelling of Pre-packaged Foods",
        },
        url: "https://www.fao.org/fao-who-codexalimentarius/sh-proxy/en/?lnk=1&url=https://workspace.fao.org/sites/codex/Standards/CXS+1-1985/CXS_001e.pdf",
        publisher: {
            km: "គណៈកម្មការ Codex Alimentarius របស់ FAO/WHO",
            en: "FAO/WHO Codex Alimentarius Commission",
        },
        jurisdiction: {
            km: "ឯកសារយោងអន្តរជាតិ",
            en: "International reference",
        },
        version: "CXS 1-1985 (2026 revision)",
        retrievedAt,
    },
    {
        id: "codex-halal-1997",
        name: {
            km: "គោលការណ៍ណែនាំទូទៅសម្រាប់ការប្រើពាក្យ «Halal»",
            en: "General Guidelines for Use of the Term “Halal”",
        },
        url: "https://www.fao.org/4/y2770e/y2770e08.htm#TopOfPage",
        publisher: {
            km: "គណៈកម្មការ Codex Alimentarius របស់ FAO/WHO",
            en: "FAO/WHO Codex Alimentarius Commission",
        },
        jurisdiction: {
            km: "ឯកសារយោងអន្តរជាតិ",
            en: "International reference",
        },
        version: "CXG 24-1997",
        retrievedAt,
    },
    {
        id: "codex-gsfa-2025",
        name: {
            km: "មូលដ្ឋានទិន្នន័យ GSFA Online",
            en: "GSFA Online database",
        },
        url: "https://www.fao.org/gsfaonline/index.html",
        publisher: {
            km: "គណៈកម្មការ Codex Alimentarius របស់ FAO/WHO",
            en: "FAO/WHO Codex Alimentarius Commission",
        },
        jurisdiction: {
            km: "ឯកសារយោងអន្តរជាតិ",
            en: "International reference",
        },
        version: "GSFA Online, updated through CAC48 (2025)",
        retrievedAt,
    },
    {
        id: "gs1-prefix",
        name: { km: "ការណែនាំអំពីលេខបុព្វបទ GS1", en: "GS1 prefix guidance" },
        url: "https://support.gs1.org/support/solutions/articles/43000734188-does-the-gs1-prefix-first-3-digits-of-the-ean-13-barcode-number-show-the-country-of-origin-",
        publisher: { km: "GS1", en: "GS1" },
        jurisdiction: {
            km: "ប្រព័ន្ធសម្គាល់អន្តរជាតិ",
            en: "Global identifier system",
        },
        version: "GS1 guidance, accessed 2026-09-02",
        retrievedAt,
    },
    {
        id: "cambodia-ccf-halal",
        name: {
            km: "ឯកសារ និងបទប្បញ្ញត្តិហាឡាល់",
            en: "Halal documents and regulations",
        },
        url: "https://www.ccfdg.gov.kh/en/laws-regulations/prakas/",
        publisher: {
            km: "អគ្គនាយកដ្ឋាន ក.ប.ប. ក្រសួងពាណិជ្ជកម្ម",
            en: "Consumer Protection, Competition and Fraud Repression Directorate-General, Ministry of Commerce",
        },
        jurisdiction: { km: "កម្ពុជា", en: "Cambodia" },
        version: "CCF official regulations index, accessed 2026-09-02",
        retrievedAt,
    },
    {
        id: "eu-food-contact",
        name: {
            km: "ការណែនាំសម្ភារៈប៉ះអាហារ",
            en: "Food-contact materials guidance",
        },
        url: "https://food.ec.europa.eu/food-safety/chemical-safety/food-contact-materials_en",
        publisher: { km: "គណៈកម្មការអឺរ៉ុប", en: "European Commission" },
        jurisdiction: { km: "សហភាពអឺរ៉ុប", en: "European Union" },
        version: "European Commission guidance, accessed 2026-09-02",
        retrievedAt,
    },
    {
        id: "us-epa-recycling",
        name: {
            km: "ការណែនាំអំពីកូដជ័រ និងការកែច្នៃ",
            en: "Resin code and recycling guidance",
        },
        url: "https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables",
        publisher: {
            km: "ទីភ្នាក់ងារការពារបរិស្ថានសហរដ្ឋអាមេរិក",
            en: "U.S. Environmental Protection Agency",
        },
        jurisdiction: { km: "សហរដ្ឋអាមេរិក", en: "United States" },
        version: "EPA guidance, accessed 2026-09-02",
        retrievedAt,
    },
    {
        id: "cambodian-food-safety-law-2022",
        name: {
            km: "ច្បាប់កម្ពុជាស្តីពីសុវត្ថិភាពម្ហូបអាហារ",
            en: "Cambodian Law on Food Safety",
        },
        url: "https://data.opendevelopmentcambodia.net/laws_record/law-on-food-safety",
        publisher: {
            km: "Open Development Cambodia",
            en: "Open Development Cambodia",
        },
        jurisdiction: { km: "កម្ពុជា", en: "Cambodia" },
        version: "Signed 2022-06-08",
        retrievedAt,
    },
    {
        id: "cambodian-standard-cs-001-2000",
        name: {
            km: "ស្តង់ដារកម្ពុជាស្តីពីការដាក់ស្លាកផលិតផលម្ហូបអាហារ",
            en: "Cambodian Standard CS 001-2000: Labelling of Food Product",
        },
        url: "https://cambodiantr.gov.kh/en/document/?title=prakas-no-1045-isc-cs001-2000-labeling-of-food-product",
        publisher: {
            km: "National Trade Repository កម្ពុជា",
            en: "Cambodia National Trade Repository",
        },
        jurisdiction: { km: "កម្ពុជា", en: "Cambodia" },
        version: "Prakas No. 1045, signed 2000-12-28",
        retrievedAt,
    },
    {
        id: "cambodian-prakas-0059",
        name: {
            km: "ប្រកាសលេខ ០០៥៩ ស្តីពីព័ត៌មានអាហារូបត្ថម្ភ",
            en: "Prakas No. 0059: Nutrition Information Requirements",
        },
        url: "https://data.opendevelopmentcambodia.net/en/laws_record/prakas-n-0059-on-nutrition-information-requirements-for-the-labelling-of-pre-packaging-food-product",
        publisher: {
            km: "Open Development Cambodia",
            en: "Open Development Cambodia",
        },
        jurisdiction: { km: "កម្ពុជា", en: "Cambodia" },
        version: "Signed 2022-02-22",
        retrievedAt,
    },
    {
        id: "fda-food-allergies",
        name: {
            km: "ការណែនាំរបស់ FDA អំពីអាឡែហ្ស៊ីអាហារ",
            en: "FDA Food Allergies: What You Need to Know",
        },
        url: "https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know",
        publisher: {
            km: "រដ្ឋបាលចំណីអាហារ និងឱសថសហរដ្ឋអាមេរិក",
            en: "U.S. Food and Drug Administration",
        },
        jurisdiction: { km: "សហរដ្ឋអាមេរិក", en: "United States" },
        version: "Consumer guidance, accessed 2026-09-05",
        retrievedAt: "2026-09-05",
    },
    {
        id: "project-allergen-ingredient-guide",
        name: {
            km: "មគ្គុទ្ទេសក៍សាមញ្ញអំពីគ្រឿងផ្សំអាលែហ្សែនក្នុងអាហារ",
            en: "Simple Food Allergen Ingredient Guide",
        },
        publisher: {
            km: "ឯកសារយោងដែលគម្រោងបានផ្តល់",
            en: "Project-supplied reference",
        },
        jurisdiction: {
            km: "ឯកសារយោងអប់រំទូទៅ",
            en: "General educational reference",
        },
        version: "Supplied 2026-09-10",
        retrievedAt: "2026-09-10",
        plainText: true,
    },
    {
        id: "fsanz-allergen-labelling",
        name: {
            km: "ការដាក់ស្លាកអាលែហ្សែនសម្រាប់អ្នកប្រើប្រាស់",
            en: "Allergen labelling for consumers",
        },
        url: "https://www.foodstandards.gov.au/consumer/labelling/allergen-labelling",
        publisher: {
            km: "ស្តង់ដារអាហារ អូស្ត្រាលី នូវែលសេឡង់",
            en: "Food Standards Australia New Zealand",
        },
        jurisdiction: {
            km: "អូស្ត្រាលី និងនូវែលសេឡង់",
            en: "Australia and New Zealand",
        },
        version: "Consumer guidance, accessed 2026-09-10",
        retrievedAt: "2026-09-10",
    },
    {
        id: "nutri-score-sante-publique-france",
        name: {
            km: "Santé publique France — Nutri-Score (ប្រភពផ្លូវការ)",
            en: "Santé publique France — Nutri-Score (official source)",
        },
        publisher: { km: "Santé publique France", en: "Santé publique France" },
        jurisdiction: {
            km: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied Nutri-Score summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "nutri-score-eren-blog",
        name: {
            km: "EREN Nutri-Score Blog — មូលដ្ឋានវិទ្យាសាស្ត្រ ការប្រើប្រាស់ ដែនកំណត់ និងការធ្វើបច្ចុប្បន្នភាព",
            en: "EREN Nutri-Score Blog — scientific basis, use, limitations, and update",
        },
        publisher: { km: "EREN Nutri-Score Blog", en: "EREN Nutri-Score Blog" },
        jurisdiction: {
            km: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied Nutri-Score summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "nova-monteiro-2016",
        name: {
            km: "Monteiro et al. (2016) — NOVA: The star shines bright",
            en: "Monteiro et al. (2016) — NOVA: The star shines bright",
        },
        publisher: { km: "World Nutrition", en: "World Nutrition" },
        jurisdiction: {
            km: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "7(1–3), 28–38",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "nova-monteiro-2018",
        name: {
            km: "Monteiro et al. (2018) — The UN Decade of Nutrition, the NOVA food classification and the trouble with ultra-processing",
            en: "Monteiro et al. (2018) — The UN Decade of Nutrition, the NOVA food classification and the trouble with ultra-processing",
        },
        publisher: {
            km: "Public Health Nutrition",
            en: "Public Health Nutrition",
        },
        jurisdiction: {
            km: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "21(S1), 5–17",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "nova-monteiro-2010",
        name: {
            km: "Monteiro et al. (2010) — A new classification of foods based on the extent and purpose of their processing",
            en: "Monteiro et al. (2010) — A new classification of foods based on the extent and purpose of their processing",
        },
        publisher: {
            km: "Source named in the supplied NOVA summary",
            en: "Source named in the supplied NOVA summary",
        },
        jurisdiction: {
            km: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied NOVA summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "nova-fao-2019",
        name: {
            km: "FAO (2019) — Ultra-processed foods, diet quality, and health using the NOVA classification system",
            en: "FAO (2019) — Ultra-processed foods, diet quality, and health using the NOVA classification system",
        },
        publisher: { km: "FAO", en: "FAO" },
        jurisdiction: {
            km: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied NOVA summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "nova-nupens-overview",
        name: {
            km: "NUPENS / University of São Paulo — NOVA food classification overview",
            en: "NUPENS / University of São Paulo — NOVA food classification overview",
        },
        publisher: {
            km: "NUPENS / University of São Paulo",
            en: "NUPENS / University of São Paulo",
        },
        jurisdiction: {
            km: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied NOVA summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "nova-open-food-facts",
        name: {
            km: "Open Food Facts — NOVA groups and product-level implementation",
            en: "Open Food Facts — NOVA groups and product-level implementation",
        },
        publisher: { km: "Open Food Facts", en: "Open Food Facts" },
        jurisdiction: {
            km: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied NOVA summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "green-score-open-food-facts",
        name: {
            km: "Open Food Facts — Green-Score",
            en: "Open Food Facts — Green-Score",
        },
        publisher: { km: "Open Food Facts", en: "Open Food Facts" },
        jurisdiction: {
            km: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied Green-Score summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "green-score-methodology",
        name: {
            km: "Open Food Facts — Green-Score launch and methodology overview",
            en: "Open Food Facts — Green-Score launch and methodology overview",
        },
        publisher: { km: "Open Food Facts", en: "Open Food Facts" },
        jurisdiction: {
            km: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied Green-Score summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "green-score-agribalyse",
        name: { km: "AGRIBALYSE — ADEME", en: "AGRIBALYSE — ADEME" },
        publisher: { km: "ADEME", en: "ADEME" },
        jurisdiction: {
            km: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied Green-Score summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "green-score-ademe-method",
        name: {
            km: "ADEME — Method and data for the food sector",
            en: "ADEME — Method and data for the food sector",
        },
        publisher: { km: "ADEME", en: "ADEME" },
        jurisdiction: {
            km: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied Green-Score summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "verified-by-gs1",
        name: { km: "សេវា Verified by GS1", en: "Verified by GS1" },
        url: "https://www.gs1.org/services/verified-by-gs1",
        publisher: { km: "GS1", en: "GS1" },
        jurisdiction: {
            km: "សេវាសម្គាល់អន្តរជាតិ",
            en: "Global identifier service",
        },
        version: "GS1 service, accessed 2026-09-05",
        retrievedAt: "2026-09-05",
    },
]

export const LEARN_SOURCE_BY_ID = new Map(
    LEARN_SOURCES.map((source) => [source.id, source]),
)
