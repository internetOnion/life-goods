import i18n from "i18next"
import { initReactI18next } from "react-i18next"

export const resources = {
    km: {
        translation: {
            brand: "LifeGoods",
            language: "ភាសា",
            khmer: "ខ្មែរ",
            english: "English",
            title: "ពិនិត្យបាកូដលើកញ្ចប់",
            guidance: "បញ្ចូលលេខខាងក្រោមបាកូដ។ អ្នកអាចដាក់ដកឃ្លា ឬសញ្ញាដកបាន។",
            fieldLabel: "លេខបាកូដ",
            fieldHint:
                "គាំទ្រលេខ GTIN, EAN និង UPC ដែលមាន ៨, ១២, ១៣ ឬ ១៤ ខ្ទង់។",
            submit: "ពិនិត្យបាកូដ",
            loading: "កំពុងពិនិត្យព័ត៌មានកញ្ចប់…",
            noMatchTitle: "រកមិនឃើញព័ត៌មានកញ្ចប់",
            noMatchBody:
                "មិនមាន Package Match សម្រាប់បាកូដនេះទេ។ នេះមិនបញ្ជាក់អំពីផលិតផលនៅក្នុងដៃអ្នកឡើយ។",
            matchTitle: "មានព័ត៌មានកញ្ចប់",
            matchBody:
                "មាន Package Match មួយ ប៉ុន្តែព័ត៌មានលម្អិតមិនទាន់មាននៅក្នុងផ្នែកនេះទេ។",
            failureTitle: "មិនអាចពិនិត្យបានឥឡូវនេះ",
            failureBody:
                "សេវាមិនអាចពិនិត្យបាកូដនេះបានឥឡូវនេះទេ។ សូមព្យាយាមម្ដងទៀត។",
            retry: "ព្យាយាមម្ដងទៀត",
            tryAnother: "សាកល្បងបាកូដផ្សេង",
            identifierLabel: "បាកូដដែលបានពិនិត្យ",
            error: {
                required: "សូមបញ្ចូលលេខបាកូដ។",
                characters: "លេខបាកូដអាចមានតែលេខ ដកឃ្លា ឬសញ្ញាដកប៉ុណ្ណោះ។",
                length: "ប្រវែងលេខបាកូដនេះមិនត្រូវបានគាំទ្រទេ។",
                checkDigit: "ខ្ទង់ត្រួតពិនិត្យរបស់លេខបាកូដមិនត្រឹមត្រូវទេ។",
            },
        },
    },
    en: {
        translation: {
            brand: "LifeGoods",
            language: "Language",
            khmer: "ខ្មែរ",
            english: "English",
            title: "Check a package barcode",
            guidance:
                "Enter the digits printed below the barcode. Spaces and hyphens are okay.",
            fieldLabel: "Barcode number",
            fieldHint:
                "Supports 8, 12, 13, and 14-digit GTIN, EAN, and UPC identifiers.",
            submit: "Check barcode",
            loading: "Checking package information…",
            noMatchTitle: "No package information found",
            noMatchBody:
                "No Package Match is available for this barcode. This says nothing about the Product in your hand.",
            matchTitle: "Package information is available",
            matchBody:
                "A Package Match exists, but its details are not included in this slice.",
            failureTitle: "Could not check right now",
            failureBody:
                "The service could not check this barcode right now. Please try again.",
            retry: "Retry",
            tryAnother: "Try another barcode",
            identifierLabel: "Checked barcode",
            error: {
                required: "Enter a barcode number.",
                characters:
                    "A barcode may contain only digits, spaces, or hyphens.",
                length: "This barcode length is not supported.",
                checkDigit: "The barcode check digit is invalid.",
            },
        },
    },
} as const

void i18n.use(initReactI18next).init({
    resources,
    lng: "km",
    fallbackLng: "km",
    interpolation: { escapeValue: false },
})

export default i18n
