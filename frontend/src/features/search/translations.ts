import { useLocale, type AppLocale } from "@/i18n/locale"

const englishSearch = {
    pageTitle: "Search",
    pageDescription: "Search products or enter a Barcode on Life Goods.",
    backToScanner: "Back to scanner",
    searchLabel: "Search",
    searchPlaceholder: "barcode, product, or brand",
    recentActivity: "Recent activity",
    seeAll: "See all",
    clearAll: "Clear all",
    searchAgainFor: "Search again for {{query}}",
    searchTerm: "Search term",
    removeFromSearchHistory: "Remove {{query}} from search history",
    viewProduct: "View Product {{barcode}}",
    product: "Product",
    removeProductFromRecentActivity:
        "Remove Product {{barcode}} from recent activity",
    startSearchHistory: "Search for a Product to start your history.",
    searchingProducts: "Searching Products",
    products: "Products",
    foundCount: "{{count}} Products shown",
    productType: "Product type",
    barcode: "Barcode",
    sourceDataUnavailable: "Source Data Unavailable",
    imageUnavailable: "Image unavailable",
    loadingProducts: "Loading Products…",
    loadMoreProducts: "Load more Products",
    noProductsFound: "No Products found",
    noProductsHint: "Try a different Product name, company, or country.",
    noBarcodeMatchHint:
        "No Product with this Barcode was found in the Dataset Snapshot.",
    viewedProductsPageTitle: "Viewed Products",
    viewedProductsPageDescription:
        "Products viewed recently in this Life Goods session.",
    backToSearch: "Back to search",
    productsYouViewed: "Products you viewed",
    sessionOnly: "Saved only for this browser session.",
    noViewedProducts: "You haven't viewed any Products yet.",
    searchProducts: "Search Products",
    invalidScan:
        "That scan was not a supported Barcode. Check the digits below.",
    required: "Enter digits to search.",
    characters: "Use digits only. Spaces and hyphens are allowed.",
    length: "Life Goods supports 8, 12, 13, or 14 digit Barcodes.",
    checkDigit:
        "That Barcode has an invalid check digit. Check the digits and try again.",
    minimumCharacters: "Enter at least two characters to search.",
    searchUnavailable:
        "Product search is temporarily unavailable. Try again in a moment.",
    moreUnavailable:
        "More Products are temporarily unavailable. Try again in a moment.",
    viewNamedProduct: "View {{name}}",
    viewNamedProductWithBarcode: "View {{name}} Product {{barcode}}",
} as const

type SearchTranslations = {
    [Key in keyof typeof englishSearch]: string
}

const khmerSearch: SearchTranslations = {
    pageTitle: "ស្វែងរក",
    pageDescription: "ស្វែងរកផលិតផល ឬបញ្ចូលបាកូដនៅ Life Goods។",
    backToScanner: "ត្រឡប់ទៅម៉ាស៊ីនស្កេន",
    searchLabel: "ស្វែងរក",
    searchPlaceholder: "បាកូដ ឈ្មោះផលិតផល ឬម៉ាក",
    recentActivity: "សកម្មភាពថ្មីៗ",
    seeAll: "មើលទាំងអស់",
    clearAll: "លុបទាំងអស់",
    searchAgainFor: "ស្វែងរក {{query}} ម្តងទៀត",
    searchTerm: "ពាក្យស្វែងរក",
    removeFromSearchHistory: "លុប {{query}} ចេញពីប្រវត្តិស្វែងរក",
    viewProduct: "មើលផលិតផល {{barcode}}",
    product: "ផលិតផល",
    removeProductFromRecentActivity: "លុបផលិតផល {{barcode}} ចេញពីសកម្មភាពថ្មីៗ",
    startSearchHistory: "ស្វែងរកផលិតផល ដើម្បីចាប់ផ្តើមប្រវត្តិរបស់អ្នក។",
    searchingProducts: "កំពុងស្វែងរកផលិតផល",
    products: "ផលិតផល",
    foundCount: "បង្ហាញផលិតផល {{count}}",
    productType: "ប្រភេទផលិតផល",
    barcode: "បាកូដ",
    sourceDataUnavailable: "មិនមានទិន្នន័យ",
    imageUnavailable: "មិនមានរូបភាព",
    loadingProducts: "កំពុងទាញយកផលិតផល…",
    loadMoreProducts: "ទាញយកផលិតផលបន្ថែម",
    noProductsFound: "រកមិនឃើញផលិតផលទេ",
    noProductsHint: "សាកល្បងឈ្មោះផលិតផល ក្រុមហ៊ុន ឬប្រទេសផ្សេង។",
    noBarcodeMatchHint: "រកមិនឃើញផលិតផលដែលមានបាកូដនេះក្នុងសំណុំទិន្នន័យទេ។",
    viewedProductsPageTitle: "ផលិតផលដែលបានមើល",
    viewedProductsPageDescription:
        "ផលិតផលដែលអ្នកបានមើលថ្មីៗក្នុងវគ្គប្រើប្រាស់ Life Goods នេះ។",
    backToSearch: "ត្រឡប់ទៅការស្វែងរក",
    productsYouViewed: "ផលិតផលដែលអ្នកបានមើល",
    sessionOnly: "រក្សាទុកសម្រាប់វគ្គប្រើប្រាស់កម្មវិធីរុករកនេះប៉ុណ្ណោះ។",
    noViewedProducts: "អ្នកមិនទាន់បានមើលផលិតផលណាមួយទេ។",
    searchProducts: "ស្វែងរកផលិតផល",
    invalidScan: "ការស្កេននេះមិនមែនជាបាកូដដែលគាំទ្រទេ។ ពិនិត្យលេខខាងក្រោម។",
    required: "បញ្ចូលលេខដើម្បីស្វែងរក។",
    characters: "ប្រើតែលេខប៉ុណ្ណោះ។ អាចមានចន្លោះ និងសញ្ញាគូសបាន។",
    length: "Life Goods គាំទ្របាកូដ 8, 12, 13 ឬ 14 ខ្ទង់។",
    checkDigit:
        "បាកូដនេះមានខ្ទង់ត្រួតពិនិត្យមិនត្រឹមត្រូវទេ។ ពិនិត្យលេខ ហើយសាកល្បងម្តងទៀត។",
    minimumCharacters: "បញ្ចូលយ៉ាងហោចណាស់ 2 តួអក្សរ ដើម្បីស្វែងរក។",
    searchUnavailable:
        "ការស្វែងរកផលិតផលមិនអាចប្រើបានជាបណ្តោះអាសន្នទេ។ សាកល្បងម្តងទៀតបន្តិចទៀត។",
    moreUnavailable:
        "ទិន្នន័យផលិតផលបន្ថែមមិនអាចប្រើបានជាបណ្តោះអាសន្នទេ។ សាកល្បងម្តងទៀតបន្តិចទៀត។",
    viewNamedProduct: "មើល {{name}}",
    viewNamedProductWithBarcode: "មើល {{name}} ផលិតផល {{barcode}}",
}

export const searchTranslations = {
    en: { search: englishSearch },
    km: { search: khmerSearch },
} as const satisfies Record<AppLocale, { search: SearchTranslations }>

export type SearchTranslationKey = keyof typeof englishSearch
export type SearchTranslationValues = Record<string, string | number>

function interpolate(
    template: string,
    values?: SearchTranslationValues,
): string {
    return template.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) =>
        values?.[name] === undefined ? `{{${name}}}` : String(values[name]),
    )
}

export function translateSearch(
    locale: AppLocale,
    key: SearchTranslationKey,
    values?: SearchTranslationValues,
) {
    return interpolate(searchTranslations[locale].search[key], values)
}

export function useSearchTranslation() {
    const { locale } = useLocale()

    return {
        t: (key: SearchTranslationKey, values?: SearchTranslationValues) =>
            translateSearch(locale, key, values),
    }
}
