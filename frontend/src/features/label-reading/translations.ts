import { useMemo } from "react"

import { useLocale, type AppLocale } from "@/i18n/locale"

type TranslationValues = Record<string, string | number>

/** Guided capture copy for Read This Label (SPEC section 29.1-29.2). */
const en = {
    captureIntroTitle: "Photograph the package",
    captureIntroBody:
        "Take up to three photos. The front shows the Product name; the back usually has the ingredients, allergen statement, nutrition table, and Barcode. Skip any step that does not apply.",
    captureStepsLabel: "Label photos",
    stepFrontTitle: "Front of package",
    stepFrontTip: "Fit the Product name and brand inside the frame.",
    stepBackTitle: "Back of package",
    stepBackTip:
        "Include the ingredients and nutrition table. Tilt the package away from glare.",
    stepSideTitle: "Side panel",
    stepSideTip:
        "Only if more ingredients or nutrition are printed on the side.",
    stepOptional: "Optional",
    stepNotTaken: "Not photographed",
    stepPhotoAlt: "{{step}} photo",
    stepPhotoUnsupportedPreview: "Preview not available in this browser",
    takeStepPhoto: "Take photo",
    chooseStepPhoto: "Choose from library",
    retakeStepPhoto: "Retake",
    removeStepPhoto: "Remove {{step}} photo",
    guidedStepProgress: "Step {{current}} of {{total}}",
    guidedCaptureTitle: "{{step}}",
    skipStep: "Skip",
    doneCapturing: "Done",
    qualityDark:
        "Looks dark. Retake in brighter light, or use it if the text is readable.",
    qualityBlurry:
        "Looks blurry. Hold steady and retake, or use it if the text is readable.",
    qualityGlare:
        "Glare may hide some text. Tilt the package and retake, or use it if the text is readable.",
    photosNeeded: "Add at least one photo to read the label.",
    offerTitle: "This Barcode has a Product page",
    offerBody:
        "Barcode {{barcode}} in your photo has a Source Record in the Dataset Snapshot. Its Product page shows attributed Open Food Facts information instead of a reading of your photos.",
    openProductPage: "Open Product page",
    keepReadingLabel: "Keep reading the label",
    ingredientsHeading: "Ingredients as printed",
    noIngredientsRead: "No ingredients list was read from these photos.",
    allergenHeading: "Allergen statement printed on the label",
    statementContains: "Contains",
    statementMayContain: "May contain",
    statementOther: "Allergen wording",
    noAllergenStatementRead:
        "No allergen statement was read from these photos.",
    concernMatchesHeading: "Your selected allergens found in the text we read",
    concernMatchContains: "Mentioned: {{text}}",
    concernMatchMayContain: "May contain: {{text}}",
    onlyReadableChecked:
        "Only text that could be read from your photos was checked. An allergen not listed here may still be in the Product.",
    allergensNotCheckedEnglish:
        "Your selected allergens could not be checked: allergen checking works on English text only.",
    allergensNotChecked:
        "Your selected allergens could not be checked against this text.",
    chooseAllergensPrompt: "Choose allergens to highlight",
    nutritionHeading: "Nutrition as printed",
    nutrientColumn: "Nutrient",
    nutritionTableLabel: "Nutrition values read from your photos",
    factsHeading: "Other printed details",
    factServingSize: "Serving size",
    factServingsPerPackage: "Servings per package",
    factStorageInstructions: "Storage",
    factCountryOfOrigin: "Country of origin",
    factManufacturer: "Manufacturer",
    factImporter: "Importer or distributor",
    showHowRead: "How this was read",
    hideHowRead: "Hide how this was read",
    readBy: "Read by {{provider}} {{model}} ({{configuration}})",
    readingProgress: "Reading the label. This usually takes 20 to 40 seconds.",
    showInKhmer: "Show in Khmer",
    writingKhmer: "Writing Khmer…",
    khmerByAi: "Khmer by AI, from your photo",
    khmerUnavailableForText: "A Khmer version is not available for this text.",
    khmerFailed: "The Khmer version could not be written. {{reason}}",
    retryKhmer: "Try Khmer again",
}

const km: Record<keyof typeof en, string> = {
    captureIntroTitle: "ថតកញ្ចប់",
    captureIntroBody:
        "ថតរូបបានរហូតដល់បីសន្លឹក។ ផ្នែកខាងមុខបង្ហាញឈ្មោះផលិតផល ហើយផ្នែកខាងក្រោយជាធម្មតាមានគ្រឿងផ្សំ សេចក្តីថ្លែងអំពីអាឡែហ្ស៊ី តារាងអាហារូបត្ថម្ភ និងបាកូដ។ រំលងជំហានណាដែលមិនពាក់ព័ន្ធ។",
    captureStepsLabel: "រូបថតស្លាក",
    stepFrontTitle: "ផ្នែកខាងមុខកញ្ចប់",
    stepFrontTip: "ដាក់ឈ្មោះផលិតផល និងម៉ាកឱ្យនៅក្នុងស៊ុម។",
    stepBackTitle: "ផ្នែកខាងក្រោយកញ្ចប់",
    stepBackTip:
        "ថតឱ្យឃើញគ្រឿងផ្សំ និងតារាងអាហារូបត្ថម្ភ។ ផ្អៀងកញ្ចប់ដើម្បីជៀសវាងពន្លឺចាំង។",
    stepSideTitle: "ផ្នែកចំហៀង",
    stepSideTip:
        "ថតតែនៅពេលមានគ្រឿងផ្សំ ឬអាហារូបត្ថម្ភបន្ថែមបោះពុម្ពនៅផ្នែកចំហៀងប៉ុណ្ណោះ។",
    stepOptional: "ស្រេចចិត្ត",
    stepNotTaken: "មិនទាន់ថត",
    stepPhotoAlt: "រូបថត{{step}}",
    stepPhotoUnsupportedPreview: "កម្មវិធីរុករកនេះមិនអាចបង្ហាញរូបមើលជាមុនបានទេ",
    takeStepPhoto: "ថតរូប",
    chooseStepPhoto: "ជ្រើសពីបណ្ណាល័យ",
    retakeStepPhoto: "ថតម្ដងទៀត",
    removeStepPhoto: "លុបរូបថត{{step}}",
    guidedStepProgress: "ជំហាន {{current}} នៃ {{total}}",
    guidedCaptureTitle: "{{step}}",
    skipStep: "រំលង",
    doneCapturing: "រួចរាល់",
    qualityDark:
        "មើលទៅងងឹត។ ថតម្ដងទៀតនៅកន្លែងភ្លឺជាងនេះ ឬប្រើវាប្រសិនបើអាចអានអក្សរបាន។",
    qualityBlurry:
        "មើលទៅព្រិល។ កាន់ឱ្យនឹង ហើយថតម្ដងទៀត ឬប្រើវាប្រសិនបើអាចអានអក្សរបាន។",
    qualityGlare:
        "ពន្លឺចាំងអាចបិទបាំងអក្សរខ្លះ។ ផ្អៀងកញ្ចប់ ហើយថតម្ដងទៀត ឬប្រើវាប្រសិនបើអាចអានអក្សរបាន។",
    photosNeeded: "បន្ថែមរូបថតយ៉ាងហោចណាស់មួយ ដើម្បីអានស្លាក។",
    offerTitle: "បាកូដនេះមានទំព័រផលិតផល",
    offerBody:
        "បាកូដ {{barcode}} ក្នុងរូបថតរបស់អ្នកមានកំណត់ត្រាប្រភពក្នុង Dataset Snapshot។ ទំព័រផលិតផលរបស់វាបង្ហាញព័ត៌មាន Open Food Facts ដែលមានការបញ្ជាក់ប្រភព ជំនួសឱ្យការអានរូបថតរបស់អ្នក។",
    openProductPage: "បើកទំព័រផលិតផល",
    keepReadingLabel: "បន្តអានស្លាក",
    ingredientsHeading: "គ្រឿងផ្សំដូចដែលបានបោះពុម្ព",
    noIngredientsRead: "មិនបានអានបញ្ជីគ្រឿងផ្សំពីរូបថតទាំងនេះទេ។",
    allergenHeading: "សេចក្តីថ្លែងអំពីអាឡែហ្ស៊ីដែលបានបោះពុម្ពលើស្លាក",
    statementContains: "មាន",
    statementMayContain: "អាចមាន",
    statementOther: "ពាក្យទាក់ទងនឹងអាឡែហ្ស៊ី",
    noAllergenStatementRead:
        "មិនបានអានសេចក្តីថ្លែងអំពីអាឡែហ្ស៊ីពីរូបថតទាំងនេះទេ។",
    concernMatchesHeading:
        "អាឡែហ្ស៊ីដែលអ្នកបានជ្រើសរើស ដែលរកឃើញក្នុងអត្ថបទដែលយើងបានអាន",
    concernMatchContains: "បានលើកឡើង៖ {{text}}",
    concernMatchMayContain: "អាចមាន៖ {{text}}",
    onlyReadableChecked:
        "យើងបានពិនិត្យតែអត្ថបទដែលអាចអានបានពីរូបថតរបស់អ្នកប៉ុណ្ណោះ។ អាឡែហ្ស៊ីដែលមិនមាននៅទីនេះ អាចនៅតែមានក្នុងផលិតផល។",
    allergensNotCheckedEnglish:
        "មិនអាចពិនិត្យអាឡែហ្ស៊ីដែលអ្នកបានជ្រើសរើសបានទេ៖ ការពិនិត្យអាឡែហ្ស៊ីដំណើរការតែលើអត្ថបទជាភាសាអង់គ្លេសប៉ុណ្ណោះ។",
    allergensNotChecked:
        "មិនអាចពិនិត្យអាឡែហ្ស៊ីដែលអ្នកបានជ្រើសរើសជាមួយអត្ថបទនេះបានទេ។",
    chooseAllergensPrompt: "ជ្រើសរើសអាឡែហ្ស៊ីដើម្បីរំលេច",
    nutritionHeading: "អាហារូបត្ថម្ភដូចដែលបានបោះពុម្ព",
    nutrientColumn: "សារធាតុចិញ្ចឹម",
    nutritionTableLabel: "តម្លៃអាហារូបត្ថម្ភដែលបានអានពីរូបថតរបស់អ្នក",
    factsHeading: "ព័ត៌មានផ្សេងទៀតដែលបានបោះពុម្ព",
    factServingSize: "ទំហំមួយចំណែក",
    factServingsPerPackage: "ចំនួនចំណែកក្នុងមួយកញ្ចប់",
    factStorageInstructions: "ការរក្សាទុក",
    factCountryOfOrigin: "ប្រទេសដើម",
    factManufacturer: "អ្នកផលិត",
    factImporter: "អ្នកនាំចូល ឬអ្នកចែកចាយ",
    showHowRead: "របៀបដែលវាត្រូវបានអាន",
    hideHowRead: "លាក់របៀបដែលវាត្រូវបានអាន",
    readBy: "អានដោយ {{provider}} {{model}} ({{configuration}})",
    readingProgress: "កំពុងអានស្លាក។ ជាធម្មតាចំណាយពេលពី 20 ទៅ 40 វិនាទី។",
    showInKhmer: "បង្ហាញជាភាសាខ្មែរ",
    writingKhmer: "កំពុងសរសេរជាភាសាខ្មែរ…",
    khmerByAi: "ភាសាខ្មែរដោយ AI ពីរូបថតរបស់អ្នក",
    khmerUnavailableForText: "មិនមានកំណែភាសាខ្មែរសម្រាប់អត្ថបទនេះទេ។",
    khmerFailed: "មិនអាចសរសេរកំណែភាសាខ្មែរបានទេ។ {{reason}}",
    retryKhmer: "សាកភាសាខ្មែរម្ដងទៀត",
}

export const labelReadingTranslations = { en, km } as const
export type LabelReadingTranslationKey = keyof typeof en

function interpolate(template: string, values?: TranslationValues) {
    return template.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) =>
        values?.[name] === undefined ? `{{${name}}}` : String(values[name]),
    )
}

export function translateLabelReading(
    locale: AppLocale,
    key: LabelReadingTranslationKey,
    values?: TranslationValues,
) {
    return interpolate(labelReadingTranslations[locale][key], values)
}

export function useLabelReadingTranslation() {
    const { locale } = useLocale()
    return useMemo(
        () => ({
            locale,
            t: (key: LabelReadingTranslationKey, values?: TranslationValues) =>
                translateLabelReading(locale, key, values),
        }),
        [locale],
    )
}
