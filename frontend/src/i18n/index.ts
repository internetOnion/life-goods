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
                "សូមប្រៀបធៀបព័ត៌មានយោងនេះជាមួយកញ្ចប់នៅក្នុងដៃអ្នក។ ទិន្នន័យនេះមិនទាន់ត្រូវបានពិនិត្យដោយគម្រោងនេះទេ។",
            externalDisclosure:
                "ទិន្នន័យសហគមន៍ពី {{source}} — មិនទាន់ត្រូវបានពិនិត្យដោយគម្រោងនេះទេ។",
            externalPackageName: "ព័ត៌មានកញ្ចប់ពីប្រភពខាងក្រៅ",
            referenceImageAlt: "រូបភាពកញ្ចប់យោងពី {{source}}",
            brandLabel: "ម៉ាក",
            quantityLabel: "បរិមាណ",
            sourceLabel: "ប្រភព",
            retrievedLabel: "បានយកទិន្នន័យនៅ",
            freshnessLabel: "ភាពថ្មីនៃទិន្នន័យ",
            currentEvidence: "បានយកទិន្នន័យក្នុងរយៈពេល ២៤ ម៉ោងចុងក្រោយ",
            attributionLabel: "ការផ្តល់កិត្តិយស",
            licenseLabel: "អាជ្ញាបណ្ណ",
            sourceLink: "មើលកំណត់ត្រាប្រភព",
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
                "Compare this reference information with the package in your hand. This data has not been reviewed by this project.",
            externalDisclosure:
                "Community data from {{source}}—not yet reviewed by this project.",
            externalPackageName: "External package record",
            referenceImageAlt: "Reference package image from {{source}}",
            brandLabel: "Brand",
            quantityLabel: "Quantity",
            sourceLabel: "Source",
            retrievedLabel: "Retrieved",
            freshnessLabel: "Freshness",
            currentEvidence: "Retrieved within the last 24 hours",
            attributionLabel: "Attribution",
            licenseLabel: "Licenses",
            sourceLink: "View source record",
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
