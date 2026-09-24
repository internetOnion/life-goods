import { useMemo } from "react"

import { useLocale, type AppLocale } from "@/i18n/locale"

type TranslationValues = Record<string, string | number>

const en = {
    pageTitle: "Compare Nutrition",
    pageDescription: "Compare nutrition from label photos for two Products.",
    pageSubtitle: "Compare nutrition from two label photos.",
    productA: "Product A",
    productB: "Product B",
    editProducts: "Edit Products",
    resetSession: "Reset session",
    guidedCapture: "Guided Product capture",
    choosePhotosA: "Choose photos for Product A",
    choosePhotosB: "Choose photos for Product B",
    takePhotoA: "Take a photo for Product A",
    takePhotoB: "Take a photo for Product B",
    replacePhotoA: "Replace Product A photo {{number}}",
    replacePhotoB: "Replace Product B photo {{number}}",
    captureNavigation: "Photo capture navigation",
    back: "Back",
    backToStart: "Back to start",
    backToProductA: "Back to Product A",
    continueToProductB: "Continue to Product B",
    returnToResults: "Return to comparison results",
    next: "Next",
    results: "Results",
    comparisonResults: "Comparison results",
    comparisonBasisLabel: "Comparison basis: {{basis}}",
    nutritionComparisonDescription:
        "Compare the nutrition values shown on both labels.",
    readingProduct: "Reading {{product}}…",
    readingProductPhotos: "Reading {{product}} photos…",
    comparing: "Comparing…",
    comparingNutrition: "Comparing nutrition…",
    retryComparison: "Retry comparison",
    compareProducts: "Compare Nutrition",
    compareAgain: "Compare again",
    basedOnEvidence: "Based on Photo Evidence.",
    addEachProduct: "Add a photo for each Product.",
    readyToCompare: "Ready to compare.",
    comparisonCancelled: "Comparison cancelled. Your photos are still here.",
    maxPhotos: "Maximum of {{count}} photos per Product reached.",
    unsupportedFormat:
        "Unsupported file format: only JPEG, PNG and HEIC photos are supported. Choose another photo.",
    fileTooLarge:
        "{{files}} exceeds the 10 MiB limit. Choose a smaller photo or retake it at standard resolution.",
    noValidImages: "No valid JPEG, PNG or HEIC photos were selected.",
    photoErrorTitle: "This photo could not be used",
    labelReadingErrorTitle: "We couldn’t read this label",
    comparisonErrorTitle: "The comparison could not be completed",
    invalidPhotoRequest:
        "Choose a valid JPEG, PNG or HEIC photo, then try again.",
    photoUnreadableOnDevice:
        "This photo could not be read from your device. It may not be fully downloaded — open it in your photo app first, or choose another photo.",
    photoRequestTooLarge:
        "The submitted photos are too large. Choose smaller photos and try again.",
    photoPreviewUnavailable:
        "This photo could not be opened. Replace it or remove it before comparing.",
    photoPreviewUnsupported:
        "Preview not available in this browser. The photo will still be read.",
    otherSideNeedsAttention:
        "{{product}} could not be read. Go back to {{product}} to fix its photos.",
    retryReadingProduct: "Retry reading {{product}}",
    retryPhotoGuidance:
        "Try a clearer, well-lit photo showing the complete Nutrition Facts panel.",
    comparisonErrorGuidance:
        "Your photos are still here. Check your connection and try the comparison again.",
    extractionFailed:
        "The label could not be read. Check your connection and try again.",
    comparisonFailed:
        "The comparison could not be prepared. Try again when both labels are ready.",
    readingLabels: "Reading your labels",
    preparingLabels: "Preparing your labels",
    buildingComparison: "Building your comparison",
    preparingPhotos: "Preparing your photos…",
    readLabel: "Read {{product}} label",
    compareNutrition: "Compare nutrition",
    comparisonProgress: "Comparison progress",
    statusPrefix: "Status",
    complete: "complete",
    inProgress: "in progress",
    waiting: "waiting",
    keepOpen: "Keep this page open. You can cancel without losing your photos.",
    providerPrivacy:
        "Photos are sent to the configured processing provider. Life Goods does not save your photos or comparison history.",
    cancelComparison: "Cancel comparison",
    comparisonSteps: "Comparison steps",
    productDisplayName: "{{product}} display name",
    photos: "Photos",
    selectedCount: "{{count}} of {{total}} selected",
    addNutritionPhoto: "Add a Nutrition Facts photo",
    clearPhotoHint:
        "Start with one clear, well-lit photo of the complete panel.",
    takePhoto: "Take photo",
    fileRequirements: "JPEG, PNG or HEIC · up to {{count}} photos",
    chooseLibrary: "Choose from library",
    optionalPhotos:
        "Optional photos can show the Product front, package quantity, or a wrapped or additional nutrition panel.",
    addAnotherPhoto: "Add another photo",
    addFromLibrary: "Add from library",
    inspectPhoto: "Inspect {{product}} photo {{number}}",
    photoNumber: "Photo {{number}}",
    replacePhoto: "Replace photo {{number}}",
    removePhoto: "Remove photo {{number}}",
    clearPhotos: "Clear photos",
    readingPhotos: "Reading photos…",
    reextract: "Re-extract",
    retryExtraction: "Retry extraction",
    extractVisibleFacts: "Extract visible facts",
    configuredModel: "Configured model",
    photosReady: "Photos ready",
    addPhotoToBegin: "Add a photo to begin",
    ready: "Ready",
    someUnreadable: "Some values could not be read",
    retakePhoto: "Retake photo",
    retakeGuidance: "Add a clear close-up of the Nutrition Facts panel.",
    partialGuidance: "Readable values can still be compared.",
    technicalMetadata: "Technical metadata",
    model: "Model",
    provider: "Provider",
    configuration: "Configuration",
    detectedDetails: "Detected details",
    showDetails: "Show",
    hideDetails: "Hide",
    detectedProduct: "Detected product",
    useAsTitle: "Use as title",
    packageWeight: "Package quantity",
    preparation: "Preparation",
    evidenceImages: "Evidence images",
    usingBasis: "Using {{basis}} · {{preparation}}",
    retakeSuggestions: "Retake suggestions",
    notVisible: "Not visible in these photos",
    noVisibleColumn: "No visible nutrients in this column",
    details: "Details",
    providerNote:
        "The provider could not read enough visible information. Use the guidance above and retry.",
    active: "Active",
    mixedBases: "Mixed label bases",
    someDifferentBases:
        "Some nutrients use different bases. Exceptions are explained in the results.",
    commonBasis: "Values use a common basis.",
    perServingContext:
        "Both Products use the per-serving values shown on their labels.",
    packageSizesDiffer: "Package sizes may differ.",
    basisUnspecified: "The reported basis is not fully specified.",
    nutritionComparison: "Nutrition Comparison",
    nutrient: "Nutrient",
    labelPercentages: "Label Percentages",
    percentageNote:
        "Daily value percentages are label reference values and may use different serving bases.",
    dailyValue: "% Daily Value",
    couldNotRead: "Could not read this value",
    notFoundPhotos: "Not found in these photos",
    conflictingValues: "Conflicting values on label:",
    preparationSame: "Preparation: {{value}}.",
    preparationDifferent:
        "Preparation: {{leftProduct}} — {{left}}; {{rightProduct}} — {{right}}.",
    packageQuantities:
        "Package quantities: {{leftProduct}} — {{left}}; {{rightProduct}} — {{right}}.",
    viewPhoto: "View photo {{number}}",
    readFromPhotos: "Read from",
    photoShort: "Photo {{number}}",
    photoInspection: "{{product}} photo inspection",
    photoOf: "Photo {{current}} of {{total}}",
    fitScreen: "Fit to screen",
    zoomIn: "Zoom in",
    closePreview: "Close preview",
    previousPhoto: "Previous photo",
    nextPhoto: "Next photo",
    jumpPhoto: "Jump to photo {{number}}",
    thumbnail: "Thumbnail {{number}}",
    livePreview: "Live camera preview",
    captureProduct: "Capture {{product}}",
    panelStep: "Product {{number}} of 2 · Nutrition Facts panel",
    capturedPreview: "{{product}} captured label preview",
    captureFailedTitle: "Photo capture failed",
    avoidGlare: "Fill the frame with the complete panel and avoid glare.",
    onePhotoEnough:
        "One clear photo is enough. Add another only if the label wraps around the package or the package quantity is out of view.",
    usePhoto: "Use this photo",
    retake: "Retake",
    tryAgain: "Try again",
    closeCamera: "Close camera",
    cameraUnavailableTitle: "Camera preview unavailable",
    cameraUnavailable:
        "Live camera preview is unavailable here. Use your device camera or choose a photo instead.",
    cameraDidNotStart:
        "Live camera preview did not start. Use your device camera or choose an existing photo.",
    cameraDenied:
        "Camera access was not granted. Use your device camera or choose an existing photo.",
    cameraStarting: "Starting camera…",
    cameraStillStarting:
        "The camera is still starting. Hold steady and try again.",
    cameraCaptureFailed:
        "This camera could not create a photo. Use your device camera instead.",
    readyForPhoto: "Ready to take photo",
    frameLabel: "Fill the frame with the complete panel",
    takingPhoto: "Taking photo…",
    useDeviceCamera: "Use device camera",
    perPackage: "Per package",
    perServing: "Per serving",
    per100g: "Per 100 g",
    per100ml: "Per 100 ml",
    notSpecified: "Not specified",
    dry: "Dry",
    asSold: "As sold",
    asPrepared: "As prepared",
    preparationNotStated: "Preparation not stated",
    stateUnknown: "unknown",
    providerOutputInvalid:
        "We couldn’t reliably read this label. Try a clearer photo and tap Retry.",
    providerTimeout:
        "Photo processing request timed out. Please check your connection and tap Retry.",
    providerUnavailable:
        "Photo processing is temporarily unavailable. Check your connection and retry.",
    providerCapacity:
        "Processing capacity has been reached. Wait a moment and retry.",
    requestFailed: "The request failed. Please retry.",
    // Nutrition Labels section and Read This Label (SPEC §29)
    labelsPageTitle: "Nutrition Labels",
    labelsPageDescription:
        "Read one Product's package label or compare two nutrition labels, from your photos.",
    labelsIntro:
        "Photograph one package to read its ingredients, allergen statement, and nutrition, or photograph two nutrition labels to compare them.",
    readModeTitle: "Read This Label",
    readModeDescription:
        "Photograph a package to read its ingredients, allergen statement, and nutrition as printed.",
    compareModeTitle: "Compare Nutrition",
    compareModeDescription:
        "Photograph two Products' nutrition panels and see how their values differ.",
    readPageTitle: "Read This Label",
    readPageDescription:
        "Read the ingredients, allergen statement, and nutrition printed on one Product's package, from your photos.",
    readSubjectTitle: "This Product",
    readThisLabelAction: "Read this label",
    readAgainAction: "Read again",
    unmatchedBarcodeContext:
        "Barcode {{barcode}} has no Source Record in the selected Dataset Snapshot, so its label is read from your photos instead.",
    labelReadingTitle: "Label Reading",
    photoEvidenceBadge: "Photo Evidence",
    photoEvidenceNotice:
        "Read from your photos by the configured AI provider. This is Photo Evidence, not an Open Food Facts Source Record. Life Goods has not verified these values and does not keep them.",
    noColumnsRead: "No nutrition columns could be read from these photos.",
    notReadableInPhoto: "Not readable in your photo",
    notPrintedOnPhoto: "Not printed on the part you photographed",
    unclearInPhoto: "Unclear in your photo",
    compareInsteadPrompt: "Comparing two Products?",
    compareInsteadLink: "Compare Nutrition",
    backToLabels: "Nutrition Labels",
    resetReading: "Start over",
    providerDisclosure:
        "Your photos are sent to the configured AI provider for processing. Life Goods does not keep your photos, readings, or comparisons.",
    biggestDifferences: "Biggest differences",
    biggestDifferencesNote:
        "Ordered by the size of the gap, not by which amount is preferable.",
    differenceSentence:
        "{{more}} has {{amount}} more {{nutrient}} {{basis}} than {{less}}.",
    differenceConditional:
        "Preparation is not stated on both labels, so this assumes both are measured the same way.",
    sameInBoth: "Same in both: {{list}}",
    noDifferencesToShow:
        "No amounts could be lined up on a common basis. Every value read is listed below.",
    allValues: "All values",
    differenceChip: "+{{amount}}",
    sameChip: "Same",
    phrasePer100g: "per 100 g",
    phrasePer100ml: "per 100 ml",
    phrasePerServing: "per serving",
    phrasePerPackage: "per package",
    versus: "vs",
    editProduct: "Edit",
} as const

const km: Record<keyof typeof en, string> = {
    pageTitle: "ប្រៀបធៀបអាហារូបត្ថម្ភ",
    pageDescription: "ប្រៀបធៀបព័ត៌មានអាហារូបត្ថម្ភពីរូបថតស្លាករបស់ផលិតផលពីរ។",
    pageSubtitle: "ប្រៀបធៀបអាហារូបត្ថម្ភពីរូបថតស្លាកពីរ។",
    productA: "ផលិតផល ក",
    productB: "ផលិតផល ខ",
    editProducts: "កែសម្រួលផលិតផល",
    resetSession: "ចាប់ផ្តើមការប្រៀបធៀបថ្មី",
    guidedCapture: "ជំហានថតរូបផលិតផល",
    choosePhotosA: "ជ្រើសរូបថតសម្រាប់ផលិតផល ក",
    choosePhotosB: "ជ្រើសរូបថតសម្រាប់ផលិតផល ខ",
    takePhotoA: "ថតរូបសម្រាប់ផលិតផល ក",
    takePhotoB: "ថតរូបសម្រាប់ផលិតផល ខ",
    replacePhotoA: "ប្ដូររូបទី {{number}} របស់ផលិតផល ក",
    replacePhotoB: "ប្ដូររូបទី {{number}} របស់ផលិតផល ខ",
    captureNavigation: "ការរុករកជំហានថតរូប",
    back: "ត្រឡប់ក្រោយ",
    backToStart: "ត្រឡប់ទៅដើម",
    backToProductA: "ត្រឡប់ទៅផលិតផល ក",
    continueToProductB: "បន្តទៅផលិតផល ខ",
    returnToResults: "ត្រឡប់ទៅលទ្ធផលប្រៀបធៀប",
    next: "បន្ទាប់",
    results: "លទ្ធផល",
    comparisonResults: "លទ្ធផលប្រៀបធៀប",
    comparisonBasisLabel: "មូលដ្ឋានប្រៀបធៀប៖ {{basis}}",
    nutritionComparisonDescription:
        "ប្រៀបធៀបតម្លៃអាហារូបត្ថម្ភដែលបង្ហាញលើស្លាកទាំងពីរ។",
    readingProduct: "កំពុងអាន {{product}}…",
    readingProductPhotos: "កំពុងអានរូបថត {{product}}…",
    comparing: "កំពុងប្រៀបធៀប…",
    comparingNutrition: "កំពុងប្រៀបធៀបអាហារូបត្ថម្ភ…",
    retryComparison: "សាកល្បងប្រៀបធៀបម្ដងទៀត",
    compareProducts: "ប្រៀបធៀបអាហារូបត្ថម្ភ",
    compareAgain: "ប្រៀបធៀបម្ដងទៀត",
    basedOnEvidence: "ផ្អែកលើ Photo Evidence។",
    addEachProduct: "បន្ថែមរូបថតសម្រាប់ផលិតផលនីមួយៗ។",
    readyToCompare: "រួចរាល់សម្រាប់ប្រៀបធៀប។",
    comparisonCancelled: "បានបោះបង់ការប្រៀបធៀប។ រូបថតរបស់អ្នកនៅដដែល។",
    maxPhotos: "អាចបន្ថែមបានច្រើនបំផុត {{count}} រូបសម្រាប់ផលិតផលនីមួយៗ។",
    unsupportedFormat:
        "ទម្រង់ឯកសារនេះមិនគាំទ្រទេ។ ជ្រើសរូប JPEG, PNG ឬ HEIC ឬថតរូបថ្មី។",
    fileTooLarge:
        "{{files}} លើសទំហំកំណត់ 10 MiB។ ជ្រើសរូបតូចជាងនេះ ឬថតម្ដងទៀត។",
    noValidImages: "មិនមានរូប JPEG, PNG ឬ HEIC ត្រឹមត្រូវត្រូវបានជ្រើសទេ។",
    photoErrorTitle: "មិនអាចប្រើរូបថតនេះបានទេ",
    labelReadingErrorTitle: "មិនអាចអានស្លាកនេះបានទេ",
    comparisonErrorTitle: "មិនអាចបញ្ចប់ការប្រៀបធៀបបានទេ",
    invalidPhotoRequest:
        "ជ្រើសរូប JPEG, PNG ឬ HEIC ត្រឹមត្រូវ ហើយសាកល្បងម្ដងទៀត។",
    photoUnreadableOnDevice:
        "មិនអាចអានរូបថតនេះពីឧបករណ៍របស់អ្នកបានទេ។ វាប្រហែលមិនទាន់ទាញយកពេញលេញ។ សាកបើកវាក្នុងកម្មវិធីរូបថតជាមុនសិន ឬជ្រើសរូបផ្សេង។",
    photoRequestTooLarge:
        "រូបថតដែលបានផ្ញើមានទំហំធំពេក។ ជ្រើសរូបតូចជាងនេះ ហើយសាកល្បងម្ដងទៀត។",
    photoPreviewUnavailable:
        "មិនអាចបើករូបថតនេះបានទេ។ ប្ដូរ ឬលុបវាមុនពេលប្រៀបធៀប។",
    photoPreviewUnsupported:
        "កម្មវិធីរុករកនេះមិនអាចបង្ហាញរូបមើលជាមុនបានទេ។ រូបថតនៅតែនឹងត្រូវបានអាន។",
    otherSideNeedsAttention:
        "មិនអាចអាន {{product}} បានទេ។ ត្រឡប់ទៅ {{product}} ដើម្បីកែរូបថតរបស់វា។",
    retryReadingProduct: "សាកអាន {{product}} ម្ដងទៀត",
    retryPhotoGuidance:
        "សាកថតរូបថ្មីដែលច្បាស់ មានពន្លឺល្អ និងបង្ហាញផ្ទាំងព័ត៌មានអាហារូបត្ថម្ភទាំងមូល។",
    comparisonErrorGuidance:
        "រូបថតរបស់អ្នកនៅដដែល។ ពិនិត្យអ៊ីនធឺណិត ហើយសាកប្រៀបធៀបម្ដងទៀត។",
    extractionFailed:
        "មិនអាចអានស្លាកបានទេ។ ពិនិត្យអ៊ីនធឺណិត ហើយសាកល្បងម្ដងទៀត។",
    comparisonFailed:
        "មិនអាចរៀបចំការប្រៀបធៀបបានទេ។ សាកល្បងម្ដងទៀតពេលស្លាកទាំងពីររួចរាល់។",
    readingLabels: "កំពុងអានស្លាករបស់អ្នក",
    preparingLabels: "កំពុងរៀបចំស្លាករបស់អ្នក",
    buildingComparison: "កំពុងរៀបចំលទ្ធផលប្រៀបធៀប",
    preparingPhotos: "កំពុងរៀបចំរូបថត…",
    readLabel: "អានស្លាក {{product}}",
    compareNutrition: "ប្រៀបធៀបអាហារូបត្ថម្ភ",
    comparisonProgress: "ដំណើរការប្រៀបធៀប",
    statusPrefix: "ស្ថានភាព",
    complete: "បានបញ្ចប់",
    inProgress: "កំពុងដំណើរការ",
    waiting: "កំពុងរង់ចាំ",
    keepOpen: "សូមទុកទំព័រនេះឱ្យបើក។ អ្នកអាចបោះបង់ដោយមិនបាត់រូបថត។",
    providerPrivacy:
        "រូបថតត្រូវបានផ្ញើទៅអ្នកផ្ដល់សេវាដំណើរការ។ Life Goods មិនរក្សាទុករូបថត ឬប្រវត្តិប្រៀបធៀបរបស់អ្នកទេ។",
    cancelComparison: "បោះបង់ការប្រៀបធៀប",
    comparisonSteps: "ជំហានប្រៀបធៀប",
    productDisplayName: "ឈ្មោះបង្ហាញរបស់ {{product}}",
    photos: "រូបថត",
    selectedCount: "បានជ្រើស {{count}} ក្នុងចំណោម {{total}}",
    addNutritionPhoto: "បន្ថែមរូបថតព័ត៌មានអាហារូបត្ថម្ភ",
    clearPhotoHint:
        "ចាប់ផ្តើមដោយរូបថតច្បាស់ មានពន្លឺល្អ និងបង្ហាញផ្ទាំងទាំងមូល។",
    takePhoto: "ថតរូប",
    fileRequirements: "JPEG, PNG ឬ HEIC · រហូតដល់ {{count}} រូប",
    chooseLibrary: "ជ្រើសពីឧបករណ៍",
    optionalPhotos:
        "រូបបន្ថែមអាចបង្ហាញផ្នែកខាងមុខ ទម្ងន់កញ្ចប់ ឬផ្ទាំងអាហារូបត្ថម្ភបន្ថែម។",
    addAnotherPhoto: "បន្ថែមរូបមួយទៀត",
    addFromLibrary: "បន្ថែមពីឧបករណ៍",
    inspectPhoto: "ពិនិត្យរូបទី {{number}} របស់ {{product}}",
    photoNumber: "រូបទី {{number}}",
    replacePhoto: "ប្ដូររូបទី {{number}}",
    removePhoto: "លុបរូបទី {{number}}",
    clearPhotos: "លុបរូបទាំងអស់",
    readingPhotos: "កំពុងអានរូបថត…",
    reextract: "អានឡើងវិញ",
    retryExtraction: "សាកអានឡើងវិញ",
    extractVisibleFacts: "អានព័ត៌មានដែលមើលឃើញ",
    configuredModel: "ម៉ូដែលដែលបានកំណត់",
    photosReady: "រូបថតរួចរាល់",
    addPhotoToBegin: "បន្ថែមរូបថតដើម្បីចាប់ផ្តើម",
    ready: "រួចរាល់",
    someUnreadable: "តម្លៃខ្លះមិនអាចអានបាន",
    retakePhoto: "ថតរូបម្ដងទៀត",
    retakeGuidance: "បន្ថែមរូបថតជិត និងច្បាស់នៃផ្ទាំងព័ត៌មានអាហារូបត្ថម្ភ។",
    partialGuidance: "តម្លៃដែលអាចអានបាននៅតែអាចប្រៀបធៀបបាន។",
    technicalMetadata: "ព័ត៌មានបច្ចេកទេស",
    model: "ម៉ូដែល",
    provider: "អ្នកផ្ដល់សេវា",
    configuration: "ការកំណត់",
    detectedDetails: "ព័ត៌មានដែលបានអាន",
    showDetails: "បង្ហាញ",
    hideDetails: "លាក់",
    detectedProduct: "ផលិតផលដែលបានអាន",
    useAsTitle: "ប្រើជាឈ្មោះ",
    packageWeight: "បរិមាណកញ្ចប់",
    preparation: "ការរៀបចំ",
    evidenceImages: "រូបថតភស្តុតាង",
    usingBasis: "កំពុងប្រើ {{basis}} · {{preparation}}",
    retakeSuggestions: "ការណែនាំសម្រាប់ថតម្ដងទៀត",
    notVisible: "មិនឃើញក្នុងរូបថតទាំងនេះ",
    noVisibleColumn: "មិនឃើញសារធាតុចិញ្ចឹមក្នុងជួរឈរនេះ",
    details: "ព័ត៌មានលម្អិត",
    providerNote:
        "អ្នកផ្ដល់សេវាមិនអាចអានព័ត៌មានច្បាស់បានគ្រប់គ្រាន់ទេ។ ប្រើការណែនាំខាងលើ ហើយសាកល្បងម្ដងទៀត។",
    active: "កំពុងប្រើ",
    mixedBases: "មូលដ្ឋានស្លាកខុសគ្នា",
    someDifferentBases:
        "សារធាតុចិញ្ចឹមខ្លះប្រើមូលដ្ឋានខុសគ្នា។ ករណីលើកលែងត្រូវបានពន្យល់ក្នុងលទ្ធផល។",
    commonBasis: "តម្លៃប្រើមូលដ្ឋានរួម។",
    perServingContext:
        "ផលិតផលទាំងពីរប្រើតម្លៃក្នុងមួយចំណែកបរិភោគដែលបង្ហាញលើស្លាករបស់ពួកវា។",
    packageSizesDiffer: "ទំហំកញ្ចប់អាចខុសគ្នា។",
    basisUnspecified: "មូលដ្ឋានដែលបានបង្ហាញមិនទាន់ច្បាស់លាស់។",
    nutritionComparison: "ការប្រៀបធៀបអាហារូបត្ថម្ភ",
    nutrient: "សារធាតុចិញ្ចឹម",
    labelPercentages: "ភាគរយលើស្លាក",
    percentageNote:
        "ភាគរយតម្លៃប្រចាំថ្ងៃគឺសម្រាប់យោង ហើយអាចប្រើមូលដ្ឋានចំណែកបរិភោគខុសគ្នា។",
    dailyValue: "% តម្លៃប្រចាំថ្ងៃ",
    couldNotRead: "មិនអាចអានតម្លៃនេះបាន",
    notFoundPhotos: "រកមិនឃើញក្នុងរូបថតទាំងនេះ",
    conflictingValues: "តម្លៃលើស្លាកមិនត្រូវគ្នា៖",
    preparationSame: "ការរៀបចំ៖ {{value}}។",
    preparationDifferent:
        "ការរៀបចំ៖ {{leftProduct}} — {{left}}; {{rightProduct}} — {{right}}។",
    packageQuantities:
        "បរិមាណកញ្ចប់៖ {{leftProduct}} — {{left}}; {{rightProduct}} — {{right}}។",
    viewPhoto: "មើលរូបទី {{number}}",
    readFromPhotos: "អានពី",
    photoShort: "រូបទី {{number}}",
    photoInspection: "ពិនិត្យរូបថត {{product}}",
    photoOf: "រូបទី {{current}} ក្នុងចំណោម {{total}}",
    fitScreen: "បង្ហាញឱ្យសមអេក្រង់",
    zoomIn: "ពង្រីក",
    closePreview: "បិទការមើលរូប",
    previousPhoto: "រូបមុន",
    nextPhoto: "រូបបន្ទាប់",
    jumpPhoto: "ទៅរូបទី {{number}}",
    thumbnail: "រូបតូចទី {{number}}",
    livePreview: "រូបភាពផ្ទាល់ពីកាមេរ៉ា",
    captureProduct: "ថតរូប {{product}}",
    panelStep: "ផលិតផល {{number}} ក្នុងចំណោម 2 · ផ្ទាំងព័ត៌មានអាហារូបត្ថម្ភ",
    capturedPreview: "រូបថតស្លាករបស់ {{product}}",
    captureFailedTitle: "ការថតរូបបានបរាជ័យ",
    avoidGlare: "ដាក់ផ្ទាំងទាំងមូលក្នុងស៊ុម និងជៀសវាងពន្លឺចាំង។",
    onePhotoEnough:
        "រូបថតច្បាស់មួយគឺគ្រប់គ្រាន់។ បន្ថែមរូបទៀតតែពេលស្លាករុំជុំវិញកញ្ចប់ ឬមិនឃើញបរិមាណកញ្ចប់។",
    usePhoto: "ប្រើរូបនេះ",
    retake: "ថតម្ដងទៀត",
    tryAgain: "សាកល្បងម្ដងទៀត",
    closeCamera: "បិទកាមេរ៉ា",
    cameraUnavailableTitle: "មិនអាចបង្ហាញកាមេរ៉ាបាន",
    cameraUnavailable:
        "មិនអាចប្រើរូបភាពផ្ទាល់ពីកាមេរ៉ានៅទីនេះបានទេ។ ប្រើកាមេរ៉ាឧបករណ៍ ឬជ្រើសរូបដែលមានស្រាប់។",
    cameraDidNotStart:
        "កាមេរ៉ាមិនបានចាប់ផ្តើមទេ។ ប្រើកាមេរ៉ាឧបករណ៍ ឬជ្រើសរូបដែលមានស្រាប់។",
    cameraDenied:
        "មិនបានអនុញ្ញាតឱ្យប្រើកាមេរ៉ាទេ។ ប្រើកាមេរ៉ាឧបករណ៍ ឬជ្រើសរូបដែលមានស្រាប់។",
    cameraStarting: "កំពុងបើកកាមេរ៉ា…",
    cameraStillStarting:
        "កាមេរ៉ាកំពុងចាប់ផ្តើម។ សូមកាន់ឱ្យនឹង ហើយសាកល្បងម្ដងទៀត។",
    cameraCaptureFailed:
        "កាមេរ៉ានេះមិនអាចបង្កើតរូបថតបានទេ។ ប្រើកាមេរ៉ាឧបករណ៍ជំនួស។",
    readyForPhoto: "រួចរាល់សម្រាប់ថតរូប",
    frameLabel: "ដាក់ផ្ទាំងទាំងមូលនៅក្នុងស៊ុម",
    takingPhoto: "កំពុងថត…",
    useDeviceCamera: "ប្រើកាមេរ៉ាឧបករណ៍",
    perPackage: "ក្នុងមួយកញ្ចប់",
    perServing: "ក្នុងមួយចំណែកបរិភោគ",
    per100g: "ក្នុង 100 ក្រាម",
    per100ml: "ក្នុង 100 មីលីលីត្រ",
    notSpecified: "មិនបានបញ្ជាក់",
    dry: "ស្ងួត",
    asSold: "តាមដែលបានលក់",
    asPrepared: "បន្ទាប់ពីរៀបចំ",
    preparationNotStated: "មិនបានបញ្ជាក់ការរៀបចំ",
    stateUnknown: "មិនដឹង",
    providerOutputInvalid:
        "យើងមិនអាចអានស្លាកនេះបានច្បាស់ទេ។ បន្ថែមរូបច្បាស់ជាងនេះ ហើយសាកល្បងម្ដងទៀត។",
    providerTimeout:
        "ការអានរូបថតប្រើពេលយូរពេក។ ពិនិត្យអ៊ីនធឺណិត ហើយសាកល្បងម្ដងទៀត។",
    providerUnavailable:
        "មិនអាចប្រើសេវាអានរូបថតបានបណ្ដោះអាសន្ន។ ពិនិត្យអ៊ីនធឺណិត ហើយសាកល្បងម្ដងទៀត។",
    providerCapacity: "សេវាកំពុងមមាញឹក។ រង់ចាំបន្តិច ហើយសាកល្បងម្ដងទៀត។",
    requestFailed: "សំណើបានបរាជ័យ។ សូមសាកល្បងម្ដងទៀត។",
    labelsPageTitle: "ស្លាកអាហារូបត្ថម្ភ",
    labelsPageDescription:
        "អានស្លាកលើកញ្ចប់របស់ផលិតផលមួយ ឬប្រៀបធៀបស្លាកអាហារូបត្ថម្ភពីរ ពីរូបថតរបស់អ្នក។",
    labelsIntro:
        "ថតរូបកញ្ចប់មួយ ដើម្បីអានគ្រឿងផ្សំ សេចក្តីថ្លែងអំពីអាឡែហ្ស៊ី និងអាហារូបត្ថម្ភ ឬថតរូបស្លាកអាហារូបត្ថម្ភពីរ ដើម្បីប្រៀបធៀប។",
    readModeTitle: "អានស្លាកនេះ",
    readModeDescription:
        "ថតរូបកញ្ចប់ ដើម្បីអានគ្រឿងផ្សំ សេចក្តីថ្លែងអំពីអាឡែហ្ស៊ី និងអាហារូបត្ថម្ភ ដូចដែលបានបោះពុម្ព។",
    compareModeTitle: "ប្រៀបធៀបអាហារូបត្ថម្ភ",
    compareModeDescription:
        "ថតរូបផ្ទាំងអាហារូបត្ថម្ភរបស់ផលិតផលពីរ ហើយមើលភាពខុសគ្នានៃតម្លៃ។",
    readPageTitle: "អានស្លាកនេះ",
    readPageDescription:
        "អានគ្រឿងផ្សំ សេចក្តីថ្លែងអំពីអាឡែហ្ស៊ី និងអាហារូបត្ថម្ភដែលបានបោះពុម្ពលើកញ្ចប់របស់ផលិតផលមួយ ពីរូបថតរបស់អ្នក។",
    readSubjectTitle: "ផលិតផលនេះ",
    readThisLabelAction: "អានស្លាកនេះ",
    readAgainAction: "អានម្ដងទៀត",
    unmatchedBarcodeContext:
        "បាកូដ {{barcode}} មិនមានកំណត់ត្រាប្រភពក្នុង Dataset Snapshot ដែលបានជ្រើសរើសទេ ដូច្នេះស្លាករបស់វាត្រូវបានអានពីរូបថតរបស់អ្នកជំនួសវិញ។",
    labelReadingTitle: "ការអានស្លាក",
    photoEvidenceBadge: "ភស្តុតាងពីរូបថត",
    photoEvidenceNotice:
        "អានពីរូបថតរបស់អ្នកដោយអ្នកផ្ដល់សេវា AI ដែលបានកំណត់។ នេះជាភស្តុតាងពីរូបថត មិនមែនជាកំណត់ត្រាប្រភព Open Food Facts ទេ។ Life Goods មិនបានផ្ទៀងផ្ទាត់តម្លៃទាំងនេះ ហើយមិនរក្សាទុកវាទេ។",
    noColumnsRead: "មិនអាចអានជួរអាហារូបត្ថម្ភពីរូបថតទាំងនេះបានទេ។",
    notReadableInPhoto: "មិនអាចអានបានក្នុងរូបថតរបស់អ្នក",
    notPrintedOnPhoto: "មិនមានបោះពុម្ពលើផ្នែកដែលអ្នកបានថត",
    unclearInPhoto: "មិនច្បាស់ក្នុងរូបថតរបស់អ្នក",
    compareInsteadPrompt: "កំពុងប្រៀបធៀបផលិតផលពីរ?",
    compareInsteadLink: "ប្រៀបធៀបអាហារូបត្ថម្ភ",
    backToLabels: "ស្លាកអាហារូបត្ថម្ភ",
    resetReading: "ចាប់ផ្តើមឡើងវិញ",
    providerDisclosure:
        "រូបថតរបស់អ្នកត្រូវបានផ្ញើទៅអ្នកផ្ដល់សេវា AI ដែលបានកំណត់ ដើម្បីដំណើរការ។ Life Goods មិនរក្សាទុករូបថត ការអាន ឬការប្រៀបធៀបរបស់អ្នកទេ។",
    biggestDifferences: "ភាពខុសគ្នាធំបំផុត",
    biggestDifferencesNote:
        "តម្រៀបតាមទំហំគម្លាត មិនមែនតាមបរិមាណណាដែលល្អជាងនោះទេ។",
    differenceSentence:
        "{{more}} មាន{{nutrient}}ច្រើនជាង {{less}} {{amount}} {{basis}}។",
    differenceConditional:
        "ស្លាកទាំងពីរមិនបានបញ្ជាក់ពីការរៀបចំ ដូច្នេះនេះសន្មតថាទាំងពីរត្រូវបានវាស់តាមរបៀបដូចគ្នា។",
    sameInBoth: "ដូចគ្នាទាំងពីរ៖ {{list}}",
    noDifferencesToShow:
        "មិនអាចតម្រឹមបរិមាណណាមួយលើមូលដ្ឋានរួមបានទេ។ តម្លៃទាំងអស់ដែលបានអានមាននៅខាងក្រោម។",
    allValues: "តម្លៃទាំងអស់",
    differenceChip: "+{{amount}}",
    sameChip: "ដូចគ្នា",
    phrasePer100g: "ក្នុង 100 ក្រាម",
    phrasePer100ml: "ក្នុង 100 មីលីលីត្រ",
    phrasePerServing: "ក្នុងមួយចំណែកបរិភោគ",
    phrasePerPackage: "ក្នុងមួយកញ្ចប់",
    versus: "និង",
    editProduct: "កែ",
}

export const compareTranslations = { en, km } as const
export type CompareTranslationKey = keyof typeof en

function interpolate(template: string, values?: TranslationValues) {
    return template.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) =>
        values?.[name] === undefined ? `{{${name}}}` : String(values[name]),
    )
}

export function translateCompare(
    locale: AppLocale,
    key: CompareTranslationKey,
    values?: TranslationValues,
) {
    return interpolate(compareTranslations[locale][key], values)
}

export function useCompareTranslation() {
    const { locale } = useLocale()
    return useMemo(
        () => ({
            locale,
            numberLocale: locale === "km" ? "km-KH" : "en-US",
            t: (key: CompareTranslationKey, values?: TranslationValues) =>
                translateCompare(locale, key, values),
        }),
        [locale],
    )
}
