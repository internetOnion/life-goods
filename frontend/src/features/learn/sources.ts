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
]

export const LEARN_SOURCE_BY_ID = new Map(
    LEARN_SOURCES.map((source) => [source.id, source]),
)
