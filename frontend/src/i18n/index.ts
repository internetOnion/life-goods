import i18n from "i18next"
import { initReactI18next } from "react-i18next"

export const resources = {
    km: {
        translation: {
            brand: "LifeGoods",
            homeLink: "ទៅទំព័រដើម LifeGoods",
            switchToEnglish: "ប្តូរទៅភាសាអង់គ្លេស",
            switchToKhmer: "ប្តូរទៅភាសាខ្មែរ",
            primaryNavigation: "ការរុករកចម្បង",
            nav: {
                home: "ទំព័រដើម",
                learn: "ស្វែងយល់",
                history: "ប្រវត្តិ",
                allergies: "អាឡែស៊ី",
            },
            title: "ពិនិត្យបាកូដលើកញ្ចប់",
            homeIntro: "បញ្ចូលលេខបាកូដ ដើម្បីរកព័ត៌មានកញ្ចប់ពីប្រភព។",
            cameraTitle: "ស្កេនដោយកាមេរ៉ា",
            cameraIdle: "ចុចចាប់ផ្តើម ដើម្បីស្កេនលេខបាកូដលើកញ្ចប់។",
            cameraStart: "ចាប់ផ្តើមកាមេរ៉ា",
            cameraStarting: "កំពុងបើកកាមេរ៉ា…",
            cameraScanning: "ដាក់លេខបាកូដក្នុងប្រអប់ស្កេន។",
            cameraStop: "បិទកាមេរ៉ា",
            cameraTryAgain: "ព្យាយាមបើកម្ដងទៀត",
            cameraUnavailable: "មិនអាចប្រើកាមេរ៉ា",
            cameraDelayed: "មិនទាន់រកឃើញលេខបាកូដទេ។ អ្នកអាចបញ្ចូលលេខខាងក្រោម។",
            cameraInvalid:
                "លេខដែលបានរកឃើញមិនមែនជាបាកូដដែល LifeGoods គាំទ្រទេ។ សូមសាកល្បងម្ដងទៀត។",
            cameraErrorPermission:
                "កាមេរ៉ាត្រូវបានបដិសេធ។ អនុញ្ញាតកាមេរ៉ាក្នុងការកំណត់កម្មវិធី ឬបញ្ចូលលេខបាកូដខាងក្រោម។",
            cameraErrorNoDevice:
                "រកមិនឃើញកាមេរ៉ាទេ។ សូមបញ្ចូលលេខបាកូដខាងក្រោម។",
            cameraErrorBusy:
                "កាមេរ៉ាកំពុងប្រើដោយកម្មវិធីផ្សេង។ សូមបិទកម្មវិធីនោះ ហើយព្យាយាមម្ដងទៀត។",
            cameraErrorPreview:
                "កាមេរ៉ាបានបើក ប៉ុន្តែរូបភាពមើលជាមុនមិនបានចាប់ផ្តើមទេ។ សូមបើកទំព័រឡើងវិញ ហើយព្យាយាមម្ដងទៀត ឬបញ្ចូលលេខបាកូដខាងក្រោម។",
            cameraErrorGeneric:
                "មិនអាចបើកកាមេរ៉ាបាន ទោះបីបានអនុញ្ញាតក៏ដោយ។ សូមបិទកម្មវិធីផ្សេងដែលកំពុងប្រើកាមេរ៉ា បើកទំព័រឡើងវិញ ហើយសាកល្បងម្ដងទៀត ឬបញ្ចូលលេខបាកូដខាងក្រោម។",
            cameraErrorInsecure:
                "កាមេរ៉ាត្រូវការ HTTPS។ សូមបើក Network URL ដែល Vite បង្ហាញ ហើយទទួលយកវិញ្ញាបនបត្រនៅលើទូរស័ព្ទ។",
            cameraErrorUnsupported:
                "កម្មវិធីរុករកនេះមិនអាចប្រើការកំណត់កាមេរ៉ានេះបានទេ។ សូមបើកទំព័រតាម HTTPS ក្នុង Safari ឬបញ្ចូលលេខបាកូដខាងក្រោម។",
            cameraErrorInterrupted:
                "ការបើកកាមេរ៉ាត្រូវបានរំខាន។ សូមត្រឡប់មកទំព័រនេះ បើកទំព័រឡើងវិញ ហើយសាកល្បងម្ដងទៀត ឬបញ្ចូលលេខបាកូដខាងក្រោម។",
            fieldLabel: "លេខបាកូដ",
            fieldPlaceholder: "លេខបាកូដ",
            fieldHint:
                "គាំទ្រលេខ GTIN, EAN និង UPC ដែលមាន ៨, ១២, ១៣ ឬ ១៤ ខ្ទង់។ អ្នកអាចដាក់ដកឃ្លា ឬសញ្ញាដកបាន។",
            fieldHintShow: "បង្ហាញព័ត៌មានអំពីលេខបាកូដ",
            fieldHintHide: "លាក់ព័ត៌មានអំពីលេខបាកូដ",
            submit: "ពិនិត្យបាកូដ",
            loading: "កំពុងពិនិត្យព័ត៌មានកញ្ចប់…",
            loadingBody:
                "LifeGoods កំពុងស្វែងរក Package Match តាមសេវាផ្នែកខាងក្រោយ។",
            noMatchTitle: "រកមិនឃើញព័ត៌មានកញ្ចប់",
            noMatchBody:
                "ឥឡូវនេះ LifeGoods និង Open Food Facts មិនមាន Package Match សម្រាប់បាកូដនេះទេ។ នេះមិនបញ្ជាក់អ្វីអំពីផលិតផលនៅក្នុងដៃអ្នកឡើយ។",
            matchTitle: "មានព័ត៌មានកញ្ចប់ពី Open Food Facts",
            failureTitle: "មិនអាចពិនិត្យបានឥឡូវនេះ",
            failureBody:
                "សេវាមិនអាចពិនិត្យបាកូដនេះបានឥឡូវនេះទេ។ សូមព្យាយាមម្ដងទៀត។ កម្មវិធីនេះត្រូវការអ៊ីនធឺណិត។",
            unsupportedTitle: "មាន Package Match ប្រភេទផ្សេង",
            unsupportedBody:
                "លទ្ធផលនេះមិនមែនជាទិន្នន័យ Open Food Facts ទេ ហើយមិនទាន់មានទម្រង់បង្ហាញក្នុងផ្នែកនេះ។ វាមិនមែនជាលទ្ធផលថារកមិនឃើញទេ។",
            retry: "ព្យាយាមម្ដងទៀត",
            tryAnother: "សាកល្បងបាកូដផ្សេង",
            backHome: "ត្រឡប់ទៅទំព័រដើម",
            resultDialogLabel: "លទ្ធផលពិនិត្យបាកូដ",
            closeResult: "បិទលទ្ធផល",
            identifierLabel: "បាកូដដែលបានពិនិត្យ",
            candidateChooserTitle: "រកឃើញ Package Match ច្រើន",
            candidateChooserBody:
                "ជ្រើសរើសបេក្ខភាពមួយដើម្បីមើលព័ត៌មានប្រភព។ បេក្ខភាពទាំងនេះមិនបញ្ជាក់ថាជា Package Revision ដូចគ្នានឹងកញ្ចប់នៅក្នុងដៃអ្នកទេ។",
            reviewedCatalogSourceLabel: "កាតាឡុកដែល LifeGoods បានពិនិត្យ",
            openFoodFactsSourceLabel: "ទិន្នន័យសហគមន៍ Open Food Facts",
            candidateNameUnavailable: "មិនមានឈ្មោះកញ្ចប់",
            backToCandidates: "ត្រឡប់ទៅបេក្ខភាពទាំងអស់",
            reviewedCatalogTitle: "មានកំណត់ត្រាក្នុងកាតាឡុក LifeGoods",
            reviewedCatalogBody:
                "បាកូដនេះភ្ជាប់ទៅនឹង Product និង Package Variant ក្នុងកាតាឡុកដែលបានពិនិត្យ។ Package Match នេះមិនមែនជាភស្តុតាងថាកញ្ចប់នៅក្នុងដៃអ្នកជាកំណែដូចគ្នាទេ។",
            productIdLabel: "លេខសម្គាល់ Product",
            packageVariantIdLabel: "លេខសម្គាល់ Package Variant",
            reviewedCatalogDetailsUnavailable:
                "កំណត់ត្រានេះមិនទាន់មានឈ្មោះ រូបភាព បរិមាណ ឬព័ត៌មានស្លាកសម្រាប់បង្ហាញទេ។ ព័ត៌មានដែលខ្វះមិនមានន័យថាគ្មានការប្រកាសលើកញ្ចប់ទេ។",
            catalogValueUnavailable: "មិនមានក្នុងកំណត់ត្រាកាតាឡុកនេះ",
            placeholder: {
                learn: {
                    title: "ស្វែងយល់",
                    body: "អត្ថបទស្វែងយល់ដែលមានប្រភពកំពុងត្រូវបានរៀបចំ។ មិនទាន់មានខ្លឹមសារបោះពុម្ពនៅក្នុងកំណែនេះទេ។",
                },
                history: {
                    title: "ប្រវត្តិ",
                    body: "ប្រវត្តិស្កេនសម្រាប់សម័យប្រើប្រាស់បច្ចុប្បន្នមិនទាន់មាននៅក្នុងកំណែនេះទេ។ LifeGoods មិនត្រូវការគណនីអ្នកប្រើទេ។",
                },
                allergies: {
                    title: "អាឡែស៊ី",
                    body: "ចំណូលចិត្តអាឡែស៊ីមិនទាន់មាននៅក្នុងកំណែនេះទេ។ LifeGoods មិនប្រកាសថាផលិតផលណាមួយគ្មានអាលែហ្សែនទេ។",
                },
            },
            sourceStatusLabel: "ស្ថានភាពប្រភព",
            externalDisclosure:
                "ទិន្នន័យសហគមន៍ពី Open Food Facts — មិនទាន់ត្រូវបានពិនិត្យដោយគម្រោងនេះទេ។",
            externalPackageName: "មិនមានឈ្មោះកញ្ចប់ពី Open Food Facts",
            referenceImageAlt: "រូបភាពកញ្ចប់យោងសម្រាប់ {{name}} ពី {{source}}",
            referenceImageAltUnnamed: "រូបភាពកញ្ចប់យោងពី {{source}}",
            imageUnavailable: "មិនមានរូបភាពកញ្ចប់យោង",
            referenceImageDetails: "ព័ត៌មានប្រភពរូបភាពយោង",
            openReferenceImageSource: "បើកទំព័រប្រភពសម្រាប់រូបភាពយោងនេះ",
            brandLabel: "ម៉ាក",
            nameLabel: "ឈ្មោះកញ្ចប់",
            quantityLabel: "បរិមាណ",
            alternateNamesTitle: "ឈ្មោះផ្សេងៗពីប្រភព",
            alternateNamesBody: "ឈ្មោះទាំងនេះត្រូវបានបង្ហាញជាមួយភាសាដើមរបស់វា។",
            ingredientsTitle: "អត្ថបទគ្រឿងផ្សំ",
            ingredientsBody:
                "បង្ហាញអត្ថបទពីប្រភពតាមភាសាដើម។ វាមិនមែនជាការវាយតម្លៃសុវត្ថិភាពទេ។",
            allergensTitle: "ការប្រកាសអាលែហ្សែន",
            allergensBody:
                "បង្ហាញតែអ្វីដែលប្រភពមាន។ ការមិនមានទិន្នន័យមិនមានន័យថាគ្មានអាលែហ្សែនទេ។",
            tracesTitle: "ការប្រកាសអាចមានសំណល់",
            tracesBody:
                "ទិន្នន័យអាចមានសំណល់ត្រូវបានរក្សាដាច់ដោយឡែកពីការប្រកាសថាមាន។",
            nutritionTitle: "ការប្រកាសអាហារូបត្ថម្ភ",
            nutritionBody:
                "តម្លៃពីប្រភពត្រូវបានបង្ហាញដោយគ្មានពិន្ទុ ឬសេចក្តីវិនិច្ឆ័យល្អ/អាក្រក់។",
            packagingLanguagesTitle: "ភាសាលើកញ្ចប់",
            countriesSoldTitle: "ប្រទេសដែលបានរាយក្នុងប្រភព",
            allergenDeclarationLabel: "អត្ថបទប្រកាស",
            allergenTagsLabel: "ស្លាកអាលែហ្សែនពីប្រភព",
            traceDeclarationLabel: "អត្ថបទអាចមានសំណល់",
            traceTagsLabel: "ស្លាកអាចមានសំណល់ពីប្រភព",
            nutritionValueLabel: "តម្លៃដែលបានប្រកាស",
            unavailableEvidence: "មិនមានពី Open Food Facts",
            fieldDetailsFor: "ព័ត៌មានប្រភពសម្រាប់ {{field}}",
            languageLabel: "ភាសា",
            notSpecified: "មិនបានបញ្ជាក់",
            sourceFieldLabel: "វាលនៅប្រភព",
            sourceValueLabel: "តម្លៃដើមពីប្រភព",
            sourceLabel: "ប្រភព",
            retrievedLabel: "បានយកទិន្នន័យនៅ",
            openEvidenceSource: "បើកទំព័រប្រភពសម្រាប់ {{field}}",
            sourceDetailsTitle: "ប្រភព និងការផ្តល់កិត្តិយស",
            freshnessLabel: "ភាពថ្មីនៃទិន្នន័យ",
            currentEvidence: "បានយកទិន្នន័យក្នុងរយៈពេល ២៤ ម៉ោងចុងក្រោយ",
            notCurrentEvidence: "ទិន្នន័យមិនត្រូវបានសម្គាល់ថាថ្មីទេ",
            sourceRevisionLabel: "កំណែប្រភព",
            attributionLabel: "ការផ្តល់កិត្តិយស",
            licenseLabel: "អាជ្ញាបណ្ណ",
            sourceLink: "មើលកំណត់ត្រាប្រភព",
            nutritionEnergyLabel: "ថាមពល",
            nutritionEnergyKjLabel: "ថាមពល (kJ)",
            nutritionEnergyKcalLabel: "ថាមពល (kcal)",
            nutritionSugarsLabel: "ស្ករ",
            nutritionFatLabel: "ខ្លាញ់",
            nutritionSaturatedFatLabel: "ខ្លាញ់ឆ្អែត",
            nutritionCarbohydratesLabel: "កាបូអ៊ីដ្រាត",
            nutritionProteinLabel: "ប្រូតេអ៊ីន",
            nutritionFiberLabel: "ជាតិសរសៃ",
            nutritionSaltLabel: "អំបិល",
            nutritionSodiumLabel: "សូដ្យូម",
            nutritionPer100g: "ក្នុង ១០០ ក្រាម",
            nutritionPreparedPer100g: "ក្នុង ១០០ ក្រាម បន្ទាប់ពីរៀបចំ",
            nutritionPerServing: "ក្នុងមួយចំណែកបរិភោគ",
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
            homeLink: "Go to LifeGoods home",
            switchToEnglish: "Switch to English",
            switchToKhmer: "Switch to Khmer",
            primaryNavigation: "Primary navigation",
            nav: {
                home: "Home",
                learn: "Learn",
                history: "History",
                allergies: "Allergies",
            },
            title: "Check a package barcode",
            homeIntro:
                "Enter the digits below a barcode to find source-scoped package information.",
            cameraTitle: "Scan with the camera",
            cameraIdle: "Tap start to scan the barcode on the package.",
            cameraStart: "Start camera",
            cameraStarting: "Starting camera…",
            cameraScanning: "Place the barcode inside the scan frame.",
            cameraStop: "Stop camera",
            cameraTryAgain: "Try camera again",
            cameraUnavailable: "Camera unavailable",
            cameraDelayed: "No barcode yet. You can enter the number below.",
            cameraInvalid:
                "That code is not a barcode format LifeGoods supports. Try again.",
            cameraErrorPermission:
                "Camera access was denied. Allow camera access in your browser settings or enter the barcode below.",
            cameraErrorNoDevice:
                "No camera was found. Enter the barcode number below.",
            cameraErrorBusy:
                "The camera is being used by another app. Close it and try again.",
            cameraErrorPreview:
                "The camera opened, but the video preview did not start. Reload this page and try again—or enter the barcode number below.",
            cameraErrorGeneric:
                "The camera could not start even though access is allowed. Close other apps using the camera, reload this page, and try again—or enter the barcode number below.",
            cameraErrorInsecure:
                "Camera access requires HTTPS. Open the Network URL printed by Vite and accept the certificate on your phone.",
            cameraErrorUnsupported:
                "This browser cannot use the requested camera mode. Open this page in Safari over HTTPS, or enter the barcode number below.",
            cameraErrorInterrupted:
                "Camera startup was interrupted. Return to this page, reload it, and try again—or enter the barcode number below.",
            fieldLabel: "Barcode number",
            fieldPlaceholder: "Barcode number",
            fieldHint:
                "Supports 8, 12, 13, and 14-digit GTIN, EAN, and UPC identifiers. Spaces and hyphens are okay.",
            fieldHintShow: "Show barcode format information",
            fieldHintHide: "Hide barcode format information",
            submit: "Check barcode",
            loading: "Checking package information…",
            loadingBody:
                "LifeGoods is looking for a Package Match through its backend service.",
            noMatchTitle: "No package information found",
            noMatchBody:
                "LifeGoods and Open Food Facts do not currently have a Package Match for this barcode. This says nothing conclusive about the Product in your hand.",
            matchTitle: "Open Food Facts package information is available",
            failureTitle: "Could not check right now",
            failureBody:
                "The service could not check this barcode right now. Try again. This online app requires an internet connection.",
            unsupportedTitle: "A different Package Match is available",
            unsupportedBody:
                "This result is not Open Food Facts data and its presentation is outside this slice. It has not been treated as a no-match.",
            retry: "Retry",
            tryAnother: "Try another barcode",
            backHome: "Back to Home",
            resultDialogLabel: "Barcode check result",
            closeResult: "Close result",
            identifierLabel: "Checked barcode",
            candidateChooserTitle: "Several Package Matches were found",
            candidateChooserBody:
                "Choose a candidate to inspect its source information. These candidates do not prove that the package in your hand is the same Package Revision.",
            reviewedCatalogSourceLabel: "LifeGoods reviewed catalog",
            openFoodFactsSourceLabel: "Open Food Facts community data",
            candidateNameUnavailable: "Package name unavailable",
            backToCandidates: "Back to all candidates",
            reviewedCatalogTitle: "A LifeGoods catalog record is available",
            reviewedCatalogBody:
                "This barcode is linked to a Product and Package Variant in the reviewed catalog. This Package Match does not prove that the package in your hand is the same revision.",
            productIdLabel: "Product ID",
            packageVariantIdLabel: "Package Variant ID",
            reviewedCatalogDetailsUnavailable:
                "This record does not yet contain a display name, image, quantity, or label evidence. Missing information does not mean the package makes no declaration.",
            catalogValueUnavailable: "Unavailable in this catalog record",
            placeholder: {
                learn: {
                    title: "Learn",
                    body: "Source-cited Learn content is being prepared. No articles are published in this version yet.",
                },
                history: {
                    title: "History",
                    body: "Current-session scan history is not available in this version yet. LifeGoods does not require an account.",
                },
                allergies: {
                    title: "Allergies",
                    body: "Allergy preferences are not available in this version yet. LifeGoods never declares a Product allergen-free.",
                },
            },
            sourceStatusLabel: "Source status",
            externalDisclosure:
                "Community data from Open Food Facts—not yet reviewed by this project.",
            externalPackageName:
                "Package name unavailable from Open Food Facts",
            referenceImageAlt:
                "Reference package image for {{name}} from {{source}}",
            referenceImageAltUnnamed: "Reference package image from {{source}}",
            imageUnavailable: "Reference package image unavailable",
            referenceImageDetails: "Reference image source details",
            openReferenceImageSource:
                "Open the source page for this reference image",
            brandLabel: "Brand",
            nameLabel: "Package name",
            quantityLabel: "Quantity",
            alternateNamesTitle: "Other source names",
            alternateNamesBody:
                "These names remain associated with their original languages.",
            ingredientsTitle: "Ingredient text",
            ingredientsBody:
                "Source text is shown in its available languages. It is not a safety assessment.",
            allergensTitle: "Allergen declarations",
            allergensBody:
                "Only source evidence is shown. Missing data does not mean allergen-free.",
            tracesTitle: "Trace declarations",
            tracesBody:
                "May-contain evidence remains separate from contains declarations.",
            nutritionTitle: "Nutrition declaration",
            nutritionBody:
                "Source values are shown without a score or positive/negative judgment.",
            packagingLanguagesTitle: "Packaging languages",
            countriesSoldTitle: "Countries listed by the source",
            allergenDeclarationLabel: "Declaration text",
            allergenTagsLabel: "Source allergen tags",
            traceDeclarationLabel: "Trace declaration text",
            traceTagsLabel: "Source trace tags",
            nutritionValueLabel: "Declared value",
            unavailableEvidence: "Unavailable from Open Food Facts",
            fieldDetailsFor: "Source details for {{field}}",
            languageLabel: "Language",
            notSpecified: "Not specified",
            sourceFieldLabel: "Source field",
            sourceValueLabel: "Original source value",
            sourceLabel: "Source",
            retrievedLabel: "Retrieved",
            openEvidenceSource: "Open the source page for {{field}}",
            sourceDetailsTitle: "Source and attribution",
            freshnessLabel: "Freshness",
            currentEvidence: "Retrieved within the last 24 hours",
            notCurrentEvidence: "Not marked as current evidence",
            sourceRevisionLabel: "Source revision",
            attributionLabel: "Attribution",
            licenseLabel: "Licenses",
            sourceLink: "View source record",
            nutritionEnergyLabel: "Energy",
            nutritionEnergyKjLabel: "Energy (kJ)",
            nutritionEnergyKcalLabel: "Energy (kcal)",
            nutritionSugarsLabel: "Sugars",
            nutritionFatLabel: "Fat",
            nutritionSaturatedFatLabel: "Saturated fat",
            nutritionCarbohydratesLabel: "Carbohydrates",
            nutritionProteinLabel: "Protein",
            nutritionFiberLabel: "Fiber",
            nutritionSaltLabel: "Salt",
            nutritionSodiumLabel: "Sodium",
            nutritionPer100g: "per 100 g",
            nutritionPreparedPer100g: "per 100 g prepared",
            nutritionPerServing: "per serving",
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

export const i18nReady = i18n.use(initReactI18next).init({
    resources,
    lng: "km",
    fallbackLng: "km",
    initImmediate: false,
    interpolation: { escapeValue: false },
})

export default i18n
