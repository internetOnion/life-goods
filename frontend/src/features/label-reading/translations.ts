import { useMemo } from "react"

import { useLocale, type AppLocale } from "@/i18n/locale"

type TranslationValues = Record<string, string | number>

/** Guided capture copy for Read This Label (SPEC section 29.1-29.2). */
const en = {
    captureIntroTitle: "Photograph the package",
    captureIntroBody:
        "Three photos, about a minute. The camera walks you through each side of the package.",
    introPathLabel: "Photo path",
    introStepFront: "The Product name and brand.",
    introStepBack:
        "Usually the ingredients, allergen statement, nutrition table, and Barcode.",
    introStepSide: "Only if more ingredients or nutrition are printed there.",
    introStepReadTitle: "Read the label",
    introStepReadBody: "Check your photos, then read them together.",
    startPhotos: "Start photos",
    choosePhotosFromLibrary: "Choose photos from library",
    reviewTitle: "Your label photos",
    reviewBody:
        "Check that the text in each photo is sharp, then read the label.",
    captureStepsLabel: "Label photos",
    stepFrontTitle: "Front of package",
    stepFrontShort: "Front",
    stepFrontTip: "Fit the Product name and brand inside the frame.",
    stepBackTitle: "Back of package",
    stepBackShort: "Back",
    stepBackTip:
        "Include the ingredients and nutrition table. Tilt the package away from glare.",
    stepSideTitle: "Side panel",
    stepSideShort: "Side",
    stepSideTip:
        "Only if more ingredients or nutrition are printed on the side.",
    stepOptional: "Optional",
    upNext: "Up next",
    continuePath: "Continue with camera",
    addSidePanel: "Add side panel",
    stepPhotoAlt: "{{step}} photo",
    stepPhotoUnsupportedPreview: "Preview not available in this browser",
    takeStepPhoto: "Take photo",
    chooseStepPhoto: "Choose from library",
    retakeStepPhoto: "Retake",
    removeStepPhoto: "Remove {{step}} photo",
    guidedStepProgress: "Step {{current}} of {{total}}",
    skipStep: "Skip",
    libraryShort: "Library",
    doneCapturing: "Done",
    qualityDark:
        "Looks dark. Retake in brighter light, or use it if the text is readable.",
    qualityBlurry:
        "Looks blurry. Hold steady and retake, or use it if the text is readable.",
    qualityGlare:
        "Glare may hide some text. Tilt the package and retake, or use it if the text is readable.",
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
    writingKhmer: "Writing Khmer…",
    khmerByAi: "Khmer by AI, from your photo",
    khmerUnavailableForText: "A Khmer version is not available for this text.",
    khmerFailed: "The Khmer version could not be written. {{reason}}",
    retryKhmer: "Try Khmer again",
    allergenQuestion: "Your allergens",
    allergenAnswerFound: "{{list}} appear in the label text we read.",
    allergenAnswerMayContain: "{{list}} appear in a “may contain” statement.",
    allergenMatchContains: "Contains",
    allergenMatchMayContain: "May contain",
    printedStatementsHeading: "Printed allergen statement",
    keyNumbersHeading: "Key numbers",
    keyNumbersCaption: "As printed · {{basis}}",
    fullNutritionTable: "Full nutrition table",
    hideFullNutritionTable: "Hide full nutrition table",
    ingredientsQuestion: "What’s in it",
    ingredientsHighlightNote: "Your selected allergens are marked in the text.",
}

const km: Record<keyof typeof en, string> = {
    captureIntroTitle: "ថតកញ្ចប់",
    captureIntroBody:
        "រូបថតបីសន្លឹក ប្រហែលមួយនាទី។ កាមេរ៉ានឹងណែនាំអ្នកម្ដងមួយជំហាន សម្រាប់ផ្នែកនីមួយៗនៃកញ្ចប់។",
    introPathLabel: "ជំហានថតរូប",
    introStepFront: "ឈ្មោះផលិតផល និងម៉ាក។",
    introStepBack:
        "ជាធម្មតាមានគ្រឿងផ្សំ សេចក្តីថ្លែងអំពីអាឡែហ្ស៊ី តារាងអាហារូបត្ថម្ភ និងបាកូដ។",
    introStepSide:
        "ថតតែនៅពេលមានគ្រឿងផ្សំ ឬអាហារូបត្ថម្ភបន្ថែមបោះពុម្ពនៅទីនោះប៉ុណ្ណោះ។",
    introStepReadTitle: "អានស្លាក",
    introStepReadBody: "ពិនិត្យរូបថតរបស់អ្នក រួចអានវាទាំងអស់ជាមួយគ្នា។",
    startPhotos: "ចាប់ផ្ដើមថតរូប",
    choosePhotosFromLibrary: "ជ្រើសរូបថតពីឧបករណ៍",
    reviewTitle: "រូបថតស្លាករបស់អ្នក",
    reviewBody: "ពិនិត្យថាអក្សរក្នុងរូបថតនីមួយៗច្បាស់ រួចអានស្លាក។",
    captureStepsLabel: "រូបថតស្លាក",
    stepFrontTitle: "ផ្នែកខាងមុខកញ្ចប់",
    stepFrontShort: "ខាងមុខ",
    stepFrontTip: "ដាក់ឈ្មោះផលិតផល និងម៉ាកឱ្យនៅក្នុងស៊ុម។",
    stepBackTitle: "ផ្នែកខាងក្រោយកញ្ចប់",
    stepBackShort: "ខាងក្រោយ",
    stepBackTip:
        "ថតឱ្យឃើញគ្រឿងផ្សំ និងតារាងអាហារូបត្ថម្ភ។ ផ្អៀងកញ្ចប់ដើម្បីជៀសវាងពន្លឺចាំង។",
    stepSideTitle: "ផ្នែកចំហៀង",
    stepSideShort: "ចំហៀង",
    stepSideTip:
        "ថតតែនៅពេលមានគ្រឿងផ្សំ ឬអាហារូបត្ថម្ភបន្ថែមបោះពុម្ពនៅផ្នែកចំហៀងប៉ុណ្ណោះ។",
    stepOptional: "ស្រេចចិត្ត",
    upNext: "បន្ទាប់",
    continuePath: "បន្តថតជាមួយកាមេរ៉ា",
    addSidePanel: "បន្ថែមផ្នែកចំហៀង",
    stepPhotoAlt: "រូបថត{{step}}",
    stepPhotoUnsupportedPreview: "កម្មវិធីរុករកនេះមិនអាចបង្ហាញរូបមើលជាមុនបានទេ",
    takeStepPhoto: "ថតរូប",
    chooseStepPhoto: "ជ្រើសពីបណ្ណាល័យ",
    retakeStepPhoto: "ថតម្ដងទៀត",
    removeStepPhoto: "លុបរូបថត{{step}}",
    guidedStepProgress: "ជំហាន {{current}} នៃ {{total}}",
    skipStep: "រំលង",
    libraryShort: "រូបភាព",
    doneCapturing: "រួចរាល់",
    qualityDark:
        "មើលទៅងងឹត។ ថតម្ដងទៀតនៅកន្លែងភ្លឺជាងនេះ ឬប្រើវាប្រសិនបើអាចអានអក្សរបាន។",
    qualityBlurry:
        "មើលទៅព្រិល។ កាន់ឱ្យនឹង ហើយថតម្ដងទៀត ឬប្រើវាប្រសិនបើអាចអានអក្សរបាន។",
    qualityGlare:
        "ពន្លឺចាំងអាចបិទបាំងអក្សរខ្លះ។ ផ្អៀងកញ្ចប់ ហើយថតម្ដងទៀត ឬប្រើវាប្រសិនបើអាចអានអក្សរបាន។",
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
    writingKhmer: "កំពុងសរសេរជាភាសាខ្មែរ…",
    khmerByAi: "ភាសាខ្មែរដោយ AI ពីរូបថតរបស់អ្នក",
    khmerUnavailableForText: "មិនមានកំណែភាសាខ្មែរសម្រាប់អត្ថបទនេះទេ។",
    khmerFailed: "មិនអាចសរសេរកំណែភាសាខ្មែរបានទេ។ {{reason}}",
    retryKhmer: "សាកភាសាខ្មែរម្ដងទៀត",
    allergenQuestion: "អាឡែហ្ស៊ីរបស់អ្នក",
    allergenAnswerFound: "{{list}} មាននៅក្នុងអត្ថបទស្លាកដែលយើងបានអាន។",
    allergenAnswerMayContain: "{{list}} មាននៅក្នុងសេចក្តីថ្លែង “អាចមាន”។",
    allergenMatchContains: "មាន",
    allergenMatchMayContain: "អាចមាន",
    printedStatementsHeading: "សេចក្តីថ្លែងអំពីអាឡែហ្ស៊ីដែលបានបោះពុម្ព",
    keyNumbersHeading: "តួលេខសំខាន់ៗ",
    keyNumbersCaption: "ដូចដែលបានបោះពុម្ព · {{basis}}",
    fullNutritionTable: "តារាងអាហារូបត្ថម្ភពេញលេញ",
    hideFullNutritionTable: "លាក់តារាងអាហារូបត្ថម្ភពេញលេញ",
    ingredientsQuestion: "មានអ្វីខ្លះនៅក្នុងនោះ",
    ingredientsHighlightNote:
        "អាឡែហ្ស៊ីដែលអ្នកបានជ្រើសរើសត្រូវបានសម្គាល់ក្នុងអត្ថបទ។",
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
