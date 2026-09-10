import type { LearnSource } from "./types"

const retrievedAt = "2026-09-02"

export const LEARN_SOURCES: LearnSource[] = [
    {
        id: "codex-label-2026",
        name: {
            kh: "ស្តង់ដារទូទៅសម្រាប់ការដាក់ស្លាកអាហារវេចខ្ចប់ទុកជាមុន",
            en: "General Standard for the Labelling of Pre-packaged Foods",
        },
        url: "https://www.fao.org/fao-who-codexalimentarius/sh-proxy/en/?lnk=1&url=https://workspace.fao.org/sites/codex/Standards/CXS+1-1985/CXS_001e.pdf",
        publisher: {
            kh: "គណៈកម្មការ Codex Alimentarius របស់ FAO/WHO",
            en: "FAO/WHO Codex Alimentarius Commission",
        },
        jurisdiction: {
            kh: "ឯកសារយោងអន្តរជាតិ",
            en: "International reference",
        },
        version: "CXS 1-1985 (2026 revision)",
        retrievedAt,
    },
    {
        id: "codex-halal-1997",
        name: {
            kh: "គោលការណ៍ណែនាំទូទៅសម្រាប់ការប្រើពាក្យ «Halal»",
            en: "General Guidelines for Use of the Term “Halal”",
        },
        url: "https://www.fao.org/4/y2770e/y2770e08.htm#TopOfPage",
        publisher: {
            kh: "គណៈកម្មការ Codex Alimentarius របស់ FAO/WHO",
            en: "FAO/WHO Codex Alimentarius Commission",
        },
        jurisdiction: {
            kh: "ឯកសារយោងអន្តរជាតិ",
            en: "International reference",
        },
        version: "CXG 24-1997",
        retrievedAt,
    },
    {
        id: "codex-gsfa-2025",
        name: {
            kh: "មូលដ្ឋានទិន្នន័យ GSFA Online",
            en: "GSFA Online database",
        },
        url: "https://www.fao.org/gsfaonline/index.html",
        publisher: {
            kh: "គណៈកម្មការ Codex Alimentarius របស់ FAO/WHO",
            en: "FAO/WHO Codex Alimentarius Commission",
        },
        jurisdiction: {
            kh: "ឯកសារយោងអន្តរជាតិ",
            en: "International reference",
        },
        version: "GSFA Online, updated through CAC48 (2025)",
        retrievedAt,
    },
    {
        id: "gs1-prefix",
        name: { kh: "ការណែនាំអំពីលេខបុព្វបទ GS1", en: "GS1 prefix guidance" },
        url: "https://support.gs1.org/support/solutions/articles/43000734188-does-the-gs1-prefix-first-3-digits-of-the-ean-13-barcode-number-show-the-country-of-origin-",
        publisher: { kh: "GS1", en: "GS1" },
        jurisdiction: {
            kh: "ប្រព័ន្ធសម្គាល់អន្តរជាតិ",
            en: "Global identifier system",
        },
        version: "GS1 guidance, accessed 2026-09-02",
        retrievedAt,
    },
    {
        id: "cambodia-ccf-halal",
        name: {
            kh: "ឯកសារ និងបទប្បញ្ញត្តិហាឡាល់",
            en: "Halal documents and regulations",
        },
        url: "https://www.ccfdg.gov.kh/en/laws-regulations/prakas/",
        publisher: {
            kh: "អគ្គនាយកដ្ឋាន ក.ប.ប. ក្រសួងពាណិជ្ជកម្ម",
            en: "Consumer Protection, Competition and Fraud Repression Directorate-General, Ministry of Commerce",
        },
        jurisdiction: { kh: "កម្ពុជា", en: "Cambodia" },
        version: "CCF official regulations index, accessed 2026-09-02",
        retrievedAt,
    },
    {
        id: "eu-food-contact",
        name: {
            kh: "ការណែនាំសម្ភារៈប៉ះអាហារ",
            en: "Food-contact materials guidance",
        },
        url: "https://food.ec.europa.eu/food-safety/chemical-safety/food-contact-materials_en",
        publisher: { kh: "គណៈកម្មការអឺរ៉ុប", en: "European Commission" },
        jurisdiction: { kh: "សហភាពអឺរ៉ុប", en: "European Union" },
        version: "European Commission guidance, accessed 2026-09-02",
        retrievedAt,
    },
    {
        id: "us-epa-recycling",
        name: {
            kh: "ការណែនាំអំពីកូដជ័រ និងការកែច្នៃ",
            en: "Resin code and recycling guidance",
        },
        url: "https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables",
        publisher: {
            kh: "ទីភ្នាក់ងារការពារបរិស្ថានសហរដ្ឋអាមេរិក",
            en: "U.S. Environmental Protection Agency",
        },
        jurisdiction: { kh: "សហរដ្ឋអាមេរិក", en: "United States" },
        version: "EPA guidance, accessed 2026-09-02",
        retrievedAt,
    },
    {
        id: "cambodian-food-safety-law-2022",
        name: {
            kh: "ច្បាប់កម្ពុជាស្តីពីសុវត្ថិភាពម្ហូបអាហារ",
            en: "Cambodian Law on Food Safety",
        },
        url: "https://data.opendevelopmentcambodia.net/laws_record/law-on-food-safety",
        publisher: {
            kh: "Open Development Cambodia",
            en: "Open Development Cambodia",
        },
        jurisdiction: { kh: "កម្ពុជា", en: "Cambodia" },
        version: "Signed 2022-06-08",
        retrievedAt,
    },
    {
        id: "cambodian-standard-cs-001-2000",
        name: {
            kh: "ស្តង់ដារកម្ពុជាស្តីពីការដាក់ស្លាកផលិតផលម្ហូបអាហារ",
            en: "Cambodian Standard CS 001-2000: Labelling of Food Product",
        },
        url: "https://cambodiantr.gov.kh/en/document/?title=prakas-no-1045-isc-cs001-2000-labeling-of-food-product",
        publisher: {
            kh: "National Trade Repository កម្ពុជា",
            en: "Cambodia National Trade Repository",
        },
        jurisdiction: { kh: "កម្ពុជា", en: "Cambodia" },
        version: "Prakas No. 1045, signed 2000-12-28",
        retrievedAt,
    },
    {
        id: "cambodian-prakas-0059",
        name: {
            kh: "ប្រកាសលេខ ០០៥៩ ស្តីពីព័ត៌មានអាហារូបត្ថម្ភ",
            en: "Prakas No. 0059: Nutrition Information Requirements",
        },
        url: "https://data.opendevelopmentcambodia.net/en/laws_record/prakas-n-0059-on-nutrition-information-requirements-for-the-labelling-of-pre-packaging-food-product",
        publisher: {
            kh: "Open Development Cambodia",
            en: "Open Development Cambodia",
        },
        jurisdiction: { kh: "កម្ពុជា", en: "Cambodia" },
        version: "Signed 2022-02-22",
        retrievedAt,
    },
    {
        id: "fda-food-allergies",
        name: {
            kh: "ការណែនាំរបស់ FDA អំពីអាឡែហ្ស៊ីអាហារ",
            en: "FDA Food Allergies: What You Need to Know",
        },
        url: "https://www.fda.gov/food/buy-store-serve-safe-food/food-allergies-what-you-need-know",
        publisher: {
            kh: "រដ្ឋបាលចំណីអាហារ និងឱសថសហរដ្ឋអាមេរិក",
            en: "U.S. Food and Drug Administration",
        },
        jurisdiction: { kh: "សហរដ្ឋអាមេរិក", en: "United States" },
        version: "Consumer guidance, accessed 2026-09-05",
        retrievedAt: "2026-09-05",
    },
    {
        id: "nutri-score-sante-publique-france",
        name: {
            kh: "Santé publique France — Nutri-Score (ប្រភពផ្លូវការ)",
            en: "Santé publique France — Nutri-Score (official source)",
        },
        publisher: { kh: "Santé publique France", en: "Santé publique France" },
        jurisdiction: {
            kh: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied Nutri-Score summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "nutri-score-eren-blog",
        name: {
            kh: "EREN Nutri-Score Blog — មូលដ្ឋានវិទ្យាសាស្ត្រ ការប្រើប្រាស់ ដែនកំណត់ និងការធ្វើបច្ចុប្បន្នភាព",
            en: "EREN Nutri-Score Blog — scientific basis, use, limitations, and update",
        },
        publisher: { kh: "EREN Nutri-Score Blog", en: "EREN Nutri-Score Blog" },
        jurisdiction: {
            kh: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied Nutri-Score summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "nova-monteiro-2016",
        name: {
            kh: "Monteiro et al. (2016) — NOVA: The star shines bright",
            en: "Monteiro et al. (2016) — NOVA: The star shines bright",
        },
        publisher: { kh: "World Nutrition", en: "World Nutrition" },
        jurisdiction: {
            kh: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "7(1–3), 28–38",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "nova-monteiro-2018",
        name: {
            kh: "Monteiro et al. (2018) — The UN Decade of Nutrition, the NOVA food classification and the trouble with ultra-processing",
            en: "Monteiro et al. (2018) — The UN Decade of Nutrition, the NOVA food classification and the trouble with ultra-processing",
        },
        publisher: {
            kh: "Public Health Nutrition",
            en: "Public Health Nutrition",
        },
        jurisdiction: {
            kh: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "21(S1), 5–17",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "nova-monteiro-2010",
        name: {
            kh: "Monteiro et al. (2010) — A new classification of foods based on the extent and purpose of their processing",
            en: "Monteiro et al. (2010) — A new classification of foods based on the extent and purpose of their processing",
        },
        publisher: {
            kh: "Source named in the supplied NOVA summary",
            en: "Source named in the supplied NOVA summary",
        },
        jurisdiction: {
            kh: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied NOVA summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "nova-fao-2019",
        name: {
            kh: "FAO (2019) — Ultra-processed foods, diet quality, and health using the NOVA classification system",
            en: "FAO (2019) — Ultra-processed foods, diet quality, and health using the NOVA classification system",
        },
        publisher: { kh: "FAO", en: "FAO" },
        jurisdiction: {
            kh: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied NOVA summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "nova-nupens-overview",
        name: {
            kh: "NUPENS / University of São Paulo — NOVA food classification overview",
            en: "NUPENS / University of São Paulo — NOVA food classification overview",
        },
        publisher: {
            kh: "NUPENS / University of São Paulo",
            en: "NUPENS / University of São Paulo",
        },
        jurisdiction: {
            kh: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied NOVA summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "nova-open-food-facts",
        name: {
            kh: "Open Food Facts — NOVA groups and product-level implementation",
            en: "Open Food Facts — NOVA groups and product-level implementation",
        },
        publisher: { kh: "Open Food Facts", en: "Open Food Facts" },
        jurisdiction: {
            kh: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied NOVA summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "green-score-open-food-facts",
        name: {
            kh: "Open Food Facts — Green-Score",
            en: "Open Food Facts — Green-Score",
        },
        publisher: { kh: "Open Food Facts", en: "Open Food Facts" },
        jurisdiction: {
            kh: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied Green-Score summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "green-score-methodology",
        name: {
            kh: "Open Food Facts — Green-Score launch and methodology overview",
            en: "Open Food Facts — Green-Score launch and methodology overview",
        },
        publisher: { kh: "Open Food Facts", en: "Open Food Facts" },
        jurisdiction: {
            kh: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied Green-Score summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "green-score-agribalyse",
        name: { kh: "AGRIBALYSE — ADEME", en: "AGRIBALYSE — ADEME" },
        publisher: { kh: "ADEME", en: "ADEME" },
        jurisdiction: {
            kh: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied Green-Score summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "green-score-ademe-method",
        name: {
            kh: "ADEME — Method and data for the food sector",
            en: "ADEME — Method and data for the food sector",
        },
        publisher: { kh: "ADEME", en: "ADEME" },
        jurisdiction: {
            kh: "ប្រភពសម្រាប់ការអប់រំ",
            en: "Educational reference",
        },
        version: "Source named in the supplied Green-Score summary",
        retrievedAt: "2026-09-07",
        plainText: true,
    },
    {
        id: "verified-by-gs1",
        name: { kh: "សេវា Verified by GS1", en: "Verified by GS1" },
        url: "https://www.gs1.org/services/verified-by-gs1",
        publisher: { kh: "GS1", en: "GS1" },
        jurisdiction: {
            kh: "សេវាសម្គាល់អន្តរជាតិ",
            en: "Global identifier service",
        },
        version: "GS1 service, accessed 2026-09-05",
        retrievedAt: "2026-09-05",
    },
]

export const LEARN_SOURCE_BY_ID = new Map(
    LEARN_SOURCES.map((source) => [source.id, source]),
)
