import { useLocale, type AppLocale } from "@/i18n/locale"
import labelsTaxonomyTranslations from "@shared/labels-taxonomy-km.json"
import packagingTaxonomyTranslations from "@shared/packaging-taxonomy-km.json"

import { GEOGRAPHIC_NAMES_KM } from "./geographicNames.generated"

const englishProduct = {
    backToSearch: "Back to search",
    noPackageRecord: "No Package Record Found",
    scanAnotherBarcode: "Scan Another Barcode",
    unableToLoadProduct: "Unable to Load Product",
    unexpectedProductError:
        "An unexpected network or service error occurred while retrieving package data.",
    tryAgain: "Try Again",
    productDetails: "Product Details",
    browseCategorizedSections: "Browse categorized sections",
    summary: "Summary",
    ingredients: "Ingredients",
    nutrition: "Nutrition",
    labelsPackaging: "Labels & packaging",
    productDetailSections: "Product detail sections",
    sourceDataUnavailable: "Source Data Unavailable",
    sourceDataUnavailableDetail:
        "The Source Record did not include this information.",
    translationUnavailable:
        "Khmer Translation unavailable; Original Text shown",
    selectedAllergensFound: "Selected allergens found",
    productLabelHighlights: "Product label highlights",
    barcodePageTitle: "Barcode {{barcode}}",
    productLookupTitle: "Product Lookup",
    unlabeledProduct: "Unlabeled Product",
    productImage: "product",
    frontImage: "front",
    ingredientsImage: "ingredients",
    nutritionImage: "nutrition",
    packagingImage: "packaging",
    categories: "Categories",
    onTheLabel: "On the label",
    halal: "Halal",
    additive: "Additive",
    viewProductImage: "View {{name}} {{role}} image",
    selectProductImage: "Select {{role}} product image",
    barcodeCopied: "Barcode copied",
    copyBarcode: "Copy barcode",
    copyBarcodeTitle: "Copy Barcode",
    brand: "Brand",
    barcode: "Barcode",
    quantity: "Quantity",
    gs1AllocationRegion: "Barcode country",
    gs1AllocationRegionUnavailable: "Not derivable from this Barcode",
    openImage: "Open product image",
    photoAttribution: "Photo attribution",
    sourceAssessments: "Source Assessments",
    sourceAssessmentsDescription:
        "Open Food Facts calculations; not Life Goods judgments or purchase recommendations.",
    openFoodFactsSourceAssessments: "Open Food Facts Source Assessments",
    ingredientsList: "Ingredients List",
    ingredientsCount: "{{count}} Ingredients",
    ingredientLanguage: "Ingredient language",
    ingredient: "Ingredient",
    details: "Details",
    includedIn: "Included in {{parent}}",
    subComponents: "Sub-components",
    packagingDeclarations: "Packaging Declarations & Claims:",
    sourcePackageLabel: "Source: Package Label Declaration",
    hideSourceEvidence: "Hide source evidence",
    viewIngredientEvidence: "View ingredient evidence",
    viewWordingAndSourceContext: "View wording and source context",
    ingredientsAtAGlance: "Ingredients at a glance",
    allergenIngredients: "Allergen ingredients",
    dietaryIngredientAnalysis: "Dietary & Ingredient Analysis",
    palmOil: "Palm Oil",
    palmOilFree: "Palm Oil Free",
    palmOilStatus: "Palm Oil Status",
    vegan: "Vegan",
    veganStatus: "Vegan Status",
    vegetarian: "Vegetarian",
    vegetarianStatus: "Vegetarian Status",
    yes: "Yes",
    no: "No",
    maybe: "Maybe",
    statusUnknown: "Status Unknown",
    allergenAnalysis: "Allergen Analysis",
    contains: "Contains",
    ingredientEvidence: "Ingredient evidence",
    selectedAllergenNotice: "Selected allergens found",
    noAllergenEvidence: "No completed allergen evidence is available.",
    foodAdditives: "Food Additives & E-Numbers",
    listed: "Listed",
    functions: "Functions",
    taxonomyReference: "Taxonomy reference",
    nutritionFacts: "Nutrition Facts",
    nutritionFactsTable: "Nutrition Facts Table",
    nutritionFactsTableLabel: "Nutrition facts table",
    declared: "Declared",
    per100g: "Per 100g / 100ml",
    perServing: "Per Serving",
    prepared100g: "Prepared (100g)",
    nutritionSource:
        "Source: Nutrition facts table transcribed from the physical product package.",
    nutrientLevels: "Nutrient Levels",
    fat: "Fat",
    totalFat: "Total Fat",
    saturatedFat: "Saturated Fat",
    transFat: "Trans Fat",
    cholesterol: "Cholesterol",
    totalCarbohydrates: "Total Carbohydrates",
    dietaryFiber: "Dietary Fiber",
    protein: "Protein",
    sodium: "Sodium",
    calcium: "Calcium",
    iron: "Iron",
    vitaminC: "Vitamin C",
    vitaminD: "Vitamin D",
    energyCalories: "Energy (Calories)",
    energyKj: "Energy (kJ)",
    sugars: "Sugars",
    salt: "Salt",
    low: "Low",
    medium: "Medium",
    high: "High",
    officialNutritionalStandards: "Official Nutritional Standards",
    expandAll: "Expand all",
    collapseAll: "Collapse all",
    officialStandardsDescription:
        "Nutritional benchmark standards were established from official guidance and are shown for context only.",
    officialGuidance: "Official UK guidance",
    nutrient: "Nutrient",
    ukFsaPer100g: "UK FSA per 100g",
    nutritionalStandardsTable: "Nutritional benchmark standards table",
    nutritionalStandardsExplanation:
        "Nutritional benchmark standards were established by the UK Food Standards Agency (FSA) and UK Health Ministers for front-of-pack guidance. Thresholds are evaluated strictly per 100g of solid food.",
    veryGoodNutritionalQuality: "Very good nutritional quality",
    goodNutritionalQuality: "Good nutritional quality",
    averageNutritionalQuality: "Average nutritional quality",
    poorNutritionalQuality: "Poor nutritional quality",
    veryPoorNutritionalQuality: "Very poor nutritional quality",
    veryLowEnvironmentalImpact: "Very low environmental impact",
    lowEnvironmentalImpact: "Low environmental impact",
    moderateEnvironmentalImpact: "Moderate environmental impact",
    highEnvironmentalImpact: "High environmental impact",
    veryHighEnvironmentalImpact: "Very high environmental impact",
    novaGroup: "NOVA group {{group}}",
    ultraProcessingMarker: "ultra-processing marker",
    ultraProcessingMarkers: "ultra-processing markers",
    unprocessedFoods: "Unprocessed or minimally processed foods",
    processedIngredients: "Processed culinary ingredients",
    processedFoods: "Processed foods",
    ultraProcessedFoods: "Ultra-processed foods",
    packagingComponents: "Packaging Components & Materials",
    packagingDescription: "Packaging description",
    recyclingInstructions: "Recycling instructions",
    storageInstructions: "Storage instructions",
    packagingComponentsTable: "Packaging components and materials table",
    part: "Part",
    parts: "Parts",
    material: "Material",
    component: "Component",
    weight: "Weight",
    disposalRecycling: "Disposal / Recycling",
    unspecified: "Unspecified",
    recycling: "Recycling",
    sourceDataUnavailablePackaging:
        "No itemized packaging parts declared in the dataset snapshot record.",
    labelsCertificationsAwards: "Labels, Certifications & Awards",
    dataSourceCitation: "Data Source & Citation",
    attribution: "Attribution",
    dataImageLicenses: "Data & Image Licenses",
    snapshotSha256: "Snapshot SHA-256",
    openFoodFacts: "Open Food Facts",
    openFoodFactsContributors: "Open Food Facts contributors",
    unknownPackaging: "Unknown packaging",
    allergensAndTraces: "Allergens and traces",
    ingredientWordingEvidence: "Ingredient and wording evidence",
    item: "item",
    items: "items",
    ingredientMatches: "Ingredient matches",
    mayContain: "May contain",
    incompleteAllergenChecks: "Some allergen checks are missing or incomplete.",
    missingDoesNotMeanFree:
        "Missing information does not mean that the Product is free from an allergen.",
    containsPalmOil: "Contains Palm Oil",
    palmOilFreeStatus: "Palm Oil Free",
    mayContainPalmOil: "May Contain Palm Oil",
    palmOilStatusUnknown: "Palm Oil Status Unknown",
    nonVegan: "Non-Vegan",
    maybeVegan: "Maybe Vegan",
    veganStatusUnknown: "Vegan Status Unknown",
    nonVegetarian: "Non-Vegetarian",
    maybeVegetarian: "Maybe Vegetarian",
    vegetarianStatusUnknown: "Vegetarian Status Unknown",
    datasetUnavailable:
        "The Product dataset is temporarily unavailable. Try again in a moment.",
    rateLimitExceeded:
        "Too many requests were made. Wait a moment, then try again.",
    invalidBarcode: "This Barcode is not supported.",
    sourceImageUnavailable: "Source Image Unavailable",
    close: "Close",
    openFoodFactsLogo: "Open Food Facts logo",
    sourceAnalysisDisclaimer:
        "Source analysis from Open Food Facts; not a Life Goods judgment.",
    level: "Level: {{value}}",
    seeOfficialGuidance: "See the",
    countriesSold: "Countries Sold",
    manufacturingPlaces: "Manufacturing Places",
    storageInstructionLabel: "Storage Instructions",
    storesRetailers: "Stores / Retailers",
    productWebsite: "Product Website",
    traceabilityCodes: "Traceability / EMB Codes:",
    service: "Service",
    languagesRecordedOnLabel: "Languages recorded on the label",
    languagesRecordedDescription:
        "Open Food Facts lists these languages for the Product label. This does not mean that every Product field is available in each language.",
    photoArchive: "Photo Archive",
    photoArchiveTitle: "Photo Archive & Packaging Scans",
    total: "Total",
    noPackagePhotographs:
        "No package photographs archived in the source record.",
    highResOriginalAvailable: "High-res original available",
    photoId: "Photo ID",
    categoriesCount: "Categories ({{count}})",
    benchmarkScale:
        "{{label}} benchmark scale: {{ticks}}. Current rating: {{status}}. {{low}}; {{medium}}; {{high}}.",
    amountPer100g: "{{value}}{{unit}} per 100g",
    copied: "Copied",
    copyJson: "Copy JSON",
    hideInspector: "Hide Inspector",
    inspectJson: "Inspect JSON",
    apiRoute: "Route: /api/v1/products/:barcode",
    snapshotLabel: "Snapshot: {{version}}",
    rawRecordDescription:
        "Full verbatim response payload returned by the local Open Food Facts database.",
    rawRecordTitle: "Raw API Data & Developer Inspector",
    productCharacteristics: "Product Characteristics & Classification",
    starch: "Starch",
    monounsaturatedFat: "Monounsaturated Fat",
    polyunsaturatedFat: "Polyunsaturated Fat",
    alcohol: "Alcohol",
    vitaminA: "Vitamin A",
    vitaminB1: "Vitamin B1",
    vitaminB2: "Vitamin B2",
    vitaminB6: "Vitamin B6",
    vitaminB9: "Vitamin B9",
    vitaminB12: "Vitamin B12",
    vitaminE: "Vitamin E",
    vitaminK: "Vitamin K",
    magnesium: "Magnesium",
    phosphorus: "Phosphorus",
    potassium: "Potassium",
    zinc: "Zinc",
    copper: "Copper",
    manganese: "Manganese",
    selenium: "Selenium",
    iodine: "Iodine",
    caffeine: "Caffeine",
    taurine: "Taurine",
} as const

type ProductTranslations = { [Key in keyof typeof englishProduct]: string }

const khmerProduct: ProductTranslations = {
    backToSearch: "ត្រឡប់ទៅការស្វែងរក",
    noPackageRecord: "រកមិនឃើញកំណត់ត្រាកញ្ចប់ទេ",
    scanAnotherBarcode: "ស្កេនបាកូដមួយទៀត",
    unableToLoadProduct: "មិនអាចផ្ទុកផលិតផលបាន",
    unexpectedProductError:
        "មានបញ្ហាបណ្តាញ ឬសេវាកម្មដែលមិនបានរំពឹងទុក ខណៈពេលទាញយកទិន្នន័យកញ្ចប់។",
    tryAgain: "សាកល្បងម្តងទៀត",
    productDetails: "ព័ត៌មានលម្អិតផលិតផល",
    browseCategorizedSections: "មើលផ្នែកដែលបានចាត់ជាក្រុម",
    summary: "សង្ខេប",
    ingredients: "គ្រឿងផ្សំ",
    nutrition: "អាហារូបត្ថម្ភ",
    labelsPackaging: "ស្លាក និងវេចខ្ចប់",
    productDetailSections: "ផ្នែកព័ត៌មានលម្អិតផលិតផល",
    sourceDataUnavailable: "មិនមានទិន្នន័យ",
    sourceDataUnavailableDetail: "មិនមានព័ត៌មាននេះក្នុងទិន្នន័យទេ។",
    translationUnavailable: "មិនអាចបកប្រែជាភាសាខ្មែរ; កំពុងបង្ហាញអត្ថបទដើម",
    selectedAllergensFound: "រកឃើញអាលែហ្ស៊ីដែលបានជ្រើសរើស",
    productLabelHighlights: "ចំណុចសំខាន់លើស្លាកផលិតផល",
    barcodePageTitle: "បាកូដ {{barcode}}",
    productLookupTitle: "ការស្វែងរកផលិតផល",
    unlabeledProduct: "ផលិតផលគ្មានឈ្មោះ",
    productImage: "ផលិតផល",
    frontImage: "មុខ",
    ingredientsImage: "គ្រឿងផ្សំ",
    nutritionImage: "អាហារូបត្ថម្ភ",
    packagingImage: "វេចខ្ចប់",
    categories: "ប្រភេទផលិតផល",
    onTheLabel: "លើស្លាក",
    halal: "ហាឡាល់",
    additive: "សារធាតុបន្ថែម",
    viewProductImage: "មើលរូបភាព {{role}} របស់ {{name}}",
    selectProductImage: "ជ្រើសរូបភាពផលិតផល {{role}}",
    barcodeCopied: "បានចម្លងបាកូដ",
    copyBarcode: "ចម្លងបាកូដ",
    copyBarcodeTitle: "ចម្លងបាកូដ",
    brand: "ម៉ាក",
    barcode: "បាកូដ",
    quantity: "បរិមាណ",
    gs1AllocationRegion: "ប្រទេសតាមបាកូដ",
    gs1AllocationRegionUnavailable: "មិនអាចកំណត់បានពីបាកូដនេះ",
    openImage: "បើករូបភាពផលិតផល",
    photoAttribution: "ការបញ្ជាក់រូបថត",
    sourceAssessments: "ការវាយតម្លៃរបស់ Open Food Facts",
    sourceAssessmentsDescription:
        "ការគណនារបស់ Open Food Facts; មិនមែនជាការវិនិច្ឆ័យរបស់ Life Goods ឬការណែនាំឱ្យទិញទេ។",
    openFoodFactsSourceAssessments: "ការវាយតម្លៃរបស់ Open Food Facts",
    ingredientsList: "បញ្ជីគ្រឿងផ្សំ",
    ingredientsCount: "គ្រឿងផ្សំ {{count}} មុខ",
    ingredientLanguage: "ភាសាគ្រឿងផ្សំ",
    ingredient: "គ្រឿងផ្សំ",
    details: "ព័ត៌មានលម្អិត",
    includedIn: "រួមបញ្ចូលក្នុង {{parent}}",
    subComponents: "សមាសធាតុរង",
    packagingDeclarations: "ការបញ្ជាក់ និងការអះអាងលើវេចខ្ចប់៖",
    sourcePackageLabel: "ការបញ្ជាក់លើស្លាកកញ្ចប់",
    hideSourceEvidence: "លាក់ភស្តុតាង",
    viewIngredientEvidence: "មើលភស្តុតាងគ្រឿងផ្សំ",
    viewWordingAndSourceContext: "មើលពាក្យ និងបរិបទ",
    ingredientsAtAGlance: "គ្រឿងផ្សំសង្ខេប",
    allergenIngredients: "គ្រឿងផ្សំដែលបង្កអាលែហ្ស៊ី",
    dietaryIngredientAnalysis: "ការវិភាគអាហារ និងគ្រឿងផ្សំ",
    palmOil: "ប្រេងដូង",
    palmOilFree: "គ្មានប្រេងដូង",
    palmOilStatus: "ស្ថានភាពប្រេងដូង",
    vegan: "វីហ្គែន",
    veganStatus: "ស្ថានភាពវីហ្គែន",
    vegetarian: "បួស",
    vegetarianStatus: "ស្ថានភាពបួស",
    yes: "បាទ/ចាស",
    no: "ទេ",
    maybe: "ប្រហែល",
    statusUnknown: "មិនមានទិន្នន័យស្ថានភាព",
    allergenAnalysis: "ការវិភាគអាលែហ្ស៊ី",
    contains: "មាន",
    ingredientEvidence: "ភស្តុតាងពីគ្រឿងផ្សំ",
    selectedAllergenNotice: "រកឃើញអាលែហ្ស៊ីដែលបានជ្រើសរើស",
    noAllergenEvidence: "មិនមានភស្តុតាងអាលែហ្ស៊ីដែលបានបញ្ចប់ទេ។",
    foodAdditives: "សារធាតុបន្ថែម និងលេខ E",
    listed: "បានរាយ",
    functions: "មុខងារ",
    taxonomyReference: "ឯកសារយោងចំណាត់ថ្នាក់",
    nutritionFacts: "ព័ត៌មានអាហារូបត្ថម្ភ",
    nutritionFactsTable: "តារាងព័ត៌មានអាហារូបត្ថម្ភ",
    nutritionFactsTableLabel: "តារាងព័ត៌មានអាហារូបត្ថម្ភ",
    declared: "បានប្រកាស",
    per100g: "ក្នុង 100g / 100ml",
    perServing: "ក្នុងមួយចំណែក",
    prepared100g: "បានរៀបចំ (100g)",
    nutritionSource:
        "តារាងព័ត៌មានអាហារូបត្ថម្ភដែលបានចម្លងពីកញ្ចប់ផលិតផលជាក់ស្តែង។",
    nutrientLevels: "កម្រិតសារធាតុចិញ្ចឹម",
    fat: "ខ្លាញ់",
    totalFat: "ខ្លាញ់សរុប",
    saturatedFat: "ខ្លាញ់ឆ្អែត",
    sugars: "ស្ករ",
    salt: "អំបិល",
    transFat: "ខ្លាញ់បំប្លែង",
    cholesterol: "កូឡេស្តេរ៉ុល",
    totalCarbohydrates: "កាបូអ៊ីដ្រាតសរុប",
    dietaryFiber: "ជាតិសរសៃអាហារ",
    protein: "ប្រូតេអ៊ីន",
    sodium: "សូដ្យូម",
    calcium: "កាល់ស្យូម",
    iron: "ជាតិដែក",
    vitaminC: "វីតាមីន C",
    vitaminD: "វីតាមីន D",
    energyCalories: "ថាមពល (កាឡូរី)",
    energyKj: "ថាមពល (kJ)",
    low: "ទាប",
    medium: "មធ្យម",
    high: "ខ្ពស់",
    officialNutritionalStandards: "ស្តង់ដារអាហារូបត្ថម្ភផ្លូវការ",
    expandAll: "ពង្រីកទាំងអស់",
    collapseAll: "បង្រួមទាំងអស់",
    officialStandardsDescription:
        "ស្តង់ដារគោលសម្រាប់អាហារូបត្ថម្ភនេះយោងតាមការណែនាំផ្លូវការ ហើយបង្ហាញសម្រាប់បរិបទប៉ុណ្ណោះ។",
    officialGuidance: "ការណែនាំផ្លូវការរបស់ចក្រភពអង់គ្លេស",
    nutrient: "សារធាតុចិញ្ចឹម",
    ukFsaPer100g: "FSA ចក្រភពអង់គ្លេស ក្នុង 100g",
    nutritionalStandardsTable: "តារាងស្តង់ដារគោលអាហារូបត្ថម្ភ",
    nutritionalStandardsExplanation:
        "ស្តង់ដារគោលអាហារូបត្ថម្ភនេះបង្កើតឡើងដោយទីភ្នាក់ងារស្តង់ដារអាហាររបស់ចក្រភពអង់គ្លេស (FSA) និងរដ្ឋមន្ត្រីសុខាភិបាលចក្រភពអង់គ្លេសសម្រាប់ការណែនាំលើមុខកញ្ចប់។ កម្រិតត្រូវបានវាយតម្លៃយ៉ាងតឹងរឹងក្នុង 100g នៃអាហាររឹង។",
    veryGoodNutritionalQuality: "គុណភាពអាហារូបត្ថម្ភល្អខ្លាំង",
    goodNutritionalQuality: "គុណភាពអាហារូបត្ថម្ភល្អ",
    averageNutritionalQuality: "គុណភាពអាហារូបត្ថម្ភមធ្យម",
    poorNutritionalQuality: "គុណភាពអាហារូបត្ថម្ភទាប",
    veryPoorNutritionalQuality: "គុណភាពអាហារូបត្ថម្ភទាបខ្លាំង",
    veryLowEnvironmentalImpact: "ផលប៉ះពាល់បរិស្ថានទាបខ្លាំង",
    lowEnvironmentalImpact: "ផលប៉ះពាល់បរិស្ថានទាប",
    moderateEnvironmentalImpact: "ផលប៉ះពាល់បរិស្ថានមធ្យម",
    highEnvironmentalImpact: "ផលប៉ះពាល់បរិស្ថានខ្ពស់",
    veryHighEnvironmentalImpact: "ផលប៉ះពាល់បរិស្ថានខ្ពស់ខ្លាំង",
    novaGroup: "ក្រុម NOVA {{group}}",
    ultraProcessingMarker: "សញ្ញាកែច្នៃខ្លាំង",
    ultraProcessingMarkers: "សញ្ញាកែច្នៃខ្លាំង",
    unprocessedFoods: "អាហារមិនកែច្នៃ ឬកែច្នៃតិចតួច",
    processedIngredients: "គ្រឿងផ្សំសម្រាប់ចម្អិនដែលបានកែច្នៃ",
    processedFoods: "អាហារកែច្នៃ",
    ultraProcessedFoods: "អាហារកែច្នៃខ្លាំង",
    packagingComponents: "សមាសធាតុ និងសម្ភារៈវេចខ្ចប់",
    packagingDescription: "ការពិពណ៌នាវេចខ្ចប់",
    recyclingInstructions: "ការណែនាំអំពីការកែច្នៃឡើងវិញ",
    storageInstructions: "ការណែនាំអំពីការរក្សាទុក",
    packagingComponentsTable: "តារាងសមាសធាតុ និងសម្ភារៈវេចខ្ចប់",
    part: "ផ្នែក",
    parts: "ផ្នែក",
    material: "សម្ភារៈ",
    component: "សមាសធាតុ",
    weight: "ទម្ងន់",
    disposalRecycling: "ការបោះចោល / កែច្នៃឡើងវិញ",
    unspecified: "មិនបានបញ្ជាក់",
    recycling: "ការកែច្នៃឡើងវិញ",
    sourceDataUnavailablePackaging:
        "កំណត់ត្រា Dataset Snapshot មិនបានបញ្ជាក់ផ្នែកវេចខ្ចប់ជាក់លាក់ទេ។",
    labelsCertificationsAwards: "ស្លាក វិញ្ញាបនបត្រ និងរង្វាន់",
    dataSourceCitation: "ទិន្នន័យ និងការដកស្រង់",
    attribution: "ការបញ្ជាក់",
    dataImageLicenses: "អាជ្ញាបណ្ណទិន្នន័យ និងរូបភាព",
    snapshotSha256: "SHA-256 របស់ Snapshot",
    openFoodFacts: "Open Food Facts",
    openFoodFactsContributors: "អ្នកចូលរួម Open Food Facts",
    unknownPackaging: "វេចខ្ចប់មិនស្គាល់",
    allergensAndTraces: "អាលែហ្ស៊ី និងដានសារធាតុ",
    ingredientWordingEvidence: "ភស្តុតាងគ្រឿងផ្សំ និងពាក្យពេចន៍",
    item: "មុខ",
    items: "មុខ",
    ingredientMatches: "ការផ្គូផ្គងគ្រឿងផ្សំ",
    mayContain: "អាចមាន",
    incompleteAllergenChecks: "ការត្រួតពិនិត្យអាលែហ្ស៊ីខ្លះបាត់ ឬមិនពេញលេញ។",
    missingDoesNotMeanFree: "ការបាត់ព័ត៌មានមិនមានន័យថាផលិតផលគ្មានអាលែហ្ស៊ីទេ។",
    containsPalmOil: "មានប្រេងដូង",
    palmOilFreeStatus: "គ្មានប្រេងដូង",
    mayContainPalmOil: "អាចមានប្រេងដូង",
    palmOilStatusUnknown: "មិនមានទិន្នន័យស្ថានភាពប្រេងដូង",
    nonVegan: "មិនមែនវីហ្គែន",
    maybeVegan: "ប្រហែលវីហ្គែន",
    veganStatusUnknown: "មិនមានទិន្នន័យស្ថានភាពវីហ្គែន",
    nonVegetarian: "មិនមែនអាហារបួស",
    maybeVegetarian: "ប្រហែលអាហារបួស",
    vegetarianStatusUnknown: "មិនមានទិន្នន័យស្ថានភាពបួស",
    datasetUnavailable:
        "សំណុំទិន្នន័យផលិតផលមិនអាចប្រើបានជាបណ្តោះអាសន្នទេ។ សាកល្បងម្តងទៀតបន្តិចទៀត។",
    rateLimitExceeded: "មានសំណើច្រើនពេក។ រង់ចាំបន្តិច រួចសាកល្បងម្តងទៀត។",
    invalidBarcode: "បាកូដនេះមិនត្រូវបានគាំទ្រទេ។",
    sourceImageUnavailable: "មិនមានរូបភាព",
    close: "បិទ",
    openFoodFactsLogo: "ឡូហ្គោ Open Food Facts",
    sourceAnalysisDisclaimer:
        "ការវិភាគរបស់ Open Food Facts; មិនមែនជាការវិនិច្ឆ័យរបស់ Life Goods ទេ។",
    level: "កម្រិត៖ {{value}}",
    seeOfficialGuidance: "មើល",
    countriesSold: "ប្រទេសដែលលក់",
    manufacturingPlaces: "ទីកន្លែងផលិត",
    storageInstructionLabel: "ការណែនាំអំពីការរក្សាទុក",
    storesRetailers: "ហាង / អ្នកលក់រាយ",
    productWebsite: "គេហទំព័រផលិតផល",
    traceabilityCodes: "លេខកូដតាមដាន៖",
    service: "សេវាកម្ម",
    languagesRecordedOnLabel: "ភាសាដែលបានកត់ត្រាលើស្លាក",
    languagesRecordedDescription:
        "Open Food Facts រាយភាសាទាំងនេះសម្រាប់ស្លាកផលិតផល។ នេះមិនមានន័យថាគ្រប់វាលផលិតផលមានជាភាសានីមួយៗទេ។",
    photoArchive: "បណ្ណសាររូបថត",
    photoArchiveTitle: "បណ្ណសាររូបថត និងការស្កេនកញ្ចប់",
    total: "សរុប",
    noPackagePhotographs: "មិនមានរូបថតកញ្ចប់រក្សាទុកក្នុងកំណត់ត្រានេះទេ។",
    highResOriginalAvailable: "មានរូបភាពដើមគុណភាពខ្ពស់",
    photoId: "លេខសម្គាល់រូបថត",
    categoriesCount: "ប្រភេទផលិតផល ({{count}})",
    benchmarkScale:
        "មាត្រដ្ឋានគោល {{label}}៖ {{ticks}}។ កម្រិតបច្ចុប្បន្ន៖ {{status}}។ {{low}}; {{medium}}; {{high}}។",
    amountPer100g: "{{value}}{{unit}} ក្នុង 100g",
    copied: "បានចម្លង",
    copyJson: "ចម្លង JSON",
    hideInspector: "លាក់អ្នកត្រួតពិនិត្យ",
    inspectJson: "ពិនិត្យ JSON",
    apiRoute: "ផ្លូវ៖ /api/v1/products/:barcode",
    snapshotLabel: "Snapshot៖ {{version}}",
    rawRecordDescription:
        "បន្ទុកឆ្លើយតបពេញលេញដើម ដែលបានបញ្ជូនពីមូលដ្ឋានទិន្នន័យ Open Food Facts មូលដ្ឋាន។",
    rawRecordTitle: "ទិន្នន័យ API ដើម និងអ្នកត្រួតពិនិត្យសម្រាប់អ្នកអភិវឌ្ឍន៍",
    productCharacteristics: "លក្ខណៈ និងចំណាត់ថ្នាក់ផលិតផល",
    starch: "ម្សៅ",
    monounsaturatedFat: "ខ្លាញ់មិនឆ្អែតមួយចំណង",
    polyunsaturatedFat: "ខ្លាញ់មិនឆ្អែតច្រើនចំណង",
    alcohol: "អាល់កុល",
    vitaminA: "វីតាមីន A",
    vitaminB1: "វីតាមីន B1",
    vitaminB2: "វីតាមីន B2",
    vitaminB6: "វីតាមីន B6",
    vitaminB9: "វីតាមីន B9",
    vitaminB12: "វីតាមីន B12",
    vitaminE: "វីតាមីន E",
    vitaminK: "វីតាមីន K",
    magnesium: "ម៉ាញេស្យូម",
    phosphorus: "ផូស្វ័រ",
    potassium: "ប៉ូតាស្យូម",
    zinc: "ស័ង្កសី",
    copper: "ទង់ដែង",
    manganese: "ម៉ង់ហ្គាណែស",
    selenium: "សេលេញ៉ូម",
    iodine: "អ៊ីយ៉ូត",
    caffeine: "កាហ្វេអ៊ីន",
    taurine: "តូរីន",
}

export interface AdditiveReference {
    name?: string
    description?: string
    functions?: string[]
}

const ADDITIVE_REFERENCES_EN: Record<string, AdditiveReference> = {
    e322: {
        name: "Lecithins",
        description:
            "Lecithins are a generic term for yellow-brownish fatty substances occurring in animal and plant tissues. They are used for smoothing food textures, dissolving powders, emulsifying and homogenizing liquid mixtures, and repelling sticking materials. Lecithin refers to a group of compounds found in every living organism and is commercially isolated mainly from soybeans or egg yolk.",
        functions: ["Antioxidant", "Emulsifier"],
    },
    e322i: { name: "Lecithin", functions: ["Antioxidant", "Emulsifier"] },
    e500: {
        name: "Sodium carbonates",
        description:
            "Sodium carbonates are the generic term for a Na and CO3 combination.",
        functions: ["Stabiliser", "Thickener"],
    },
    e500ii: {
        name: "Sodium hydrogen carbonate (Baking soda)",
        description:
            "Sodium bicarbonate (sodium hydrogen carbonate), commonly known as baking soda, is a chemical compound with the formula NaHCO3.",
        functions: ["Stabiliser", "Thickener"],
    },
    e503: { name: "Ammonium carbonates" },
    e503ii: {
        name: "Ammonium hydrogen carbonate",
        description:
            "Ammonium bicarbonate is an inorganic compound with the formula NH4HCO3. It is used in the food industry as a raising agent for flat baked goods such as cookies and crackers, and in China in steamed buns and Chinese almond cookies. It was commonly used at home before modern baking powder became available.",
    },
    e471: {
        name: "Mono- and diglycerides of fatty acids",
        description:
            "Mono- and diglycerides of fatty acids (E471) are a food additive composed of diglycerides and monoglycerides, used as an emulsifier.",
        functions: ["Emulsifier", "Stabiliser"],
    },
    e472e: {
        name: "Mono- and diacetyl tartaric acid esters of mono- and diglycerides of fatty acids",
        functions: ["Emulsifier", "Sequestrant", "Stabiliser"],
    },
    e330: { name: "Citric acid", functions: ["Antioxidant", "Sequestrant"] },
    e415: {
        name: "Xanthan gum",
        description:
            "Xanthan gum is a polysaccharide with many industrial uses, including as a common food additive.",
        functions: ["Emulsifier", "Stabiliser", "Thickener"],
    },
    e412: {
        name: "Guar gum",
        functions: ["Emulsifier", "Stabiliser", "Thickener"],
    },
    e407: {
        name: "Carrageenan",
        functions: [
            "Carrier",
            "Emulsifier",
            "Humectant",
            "Stabiliser",
            "Thickener",
        ],
    },
    e440: { name: "Pectins" },
    e150a: {
        name: "Plain caramel",
        description:
            "Caramel color or caramel coloring is a water-soluble food coloring.",
        functions: ["Colour"],
    },
    e150d: { name: "Sulphite ammonia caramel", functions: ["Colour"] },
    e160a: { name: "Carotenes", functions: ["Colour"] },
    e100: { name: "Curcumin", functions: ["Colour"] },
    e101: { name: "Riboflavin", functions: ["Colour"] },
    e202: {
        name: "Potassium sorbate",
        description:
            "Potassium sorbate is the potassium salt of sorbic acid, with the chemical formula CH3CH=CH−CH=CH−CO2K.",
        functions: ["Preservative"],
    },
    e211: {
        name: "Sodium benzoate",
        description:
            "Sodium benzoate is a substance with the chemical formula NaC7H5O2.",
        functions: ["Preservative"],
    },
    e282: {
        name: "Calcium propionate",
        description:
            "Calcium propionate has the formula Ca-C2H5COO-2. It is used as a preservative in a wide variety of products, including bread, other baked goods, processed meat, whey, and other dairy products.",
        functions: ["Preservative"],
    },
    e300: {
        name: "Ascorbic acid (Vitamin C)",
        functions: ["Antioxidant", "Sequestrant"],
    },
    e306: { name: "Tocopherol-rich extract (Vitamin E)" },
    e450: {
        name: "Diphosphates",
        functions: [
            "Emulsifier",
            "Humectant",
            "Sequestrant",
            "Stabiliser",
            "Thickener",
        ],
    },
    e452: {
        name: "Polyphosphates",
        functions: [
            "Emulsifier",
            "Humectant",
            "Sequestrant",
            "Stabiliser",
            "Thickener",
        ],
    },
    e621: {
        name: "Monosodium glutamate (MSG)",
        description:
            "Monosodium glutamate (MSG), also known as sodium glutamate, is the sodium salt of glutamic acid, one of the most abundant naturally occurring non-essential amino acids.",
        functions: ["Flavour enhancer"],
    },
}

const ADDITIVE_REFERENCES_KM: Record<string, AdditiveReference> = {
    e322: {
        name: "លេស៊ីទីន",
        description:
            "លេស៊ីទីនជាសារធាតុខ្លាញ់ពណ៌លឿងត្នោតដែលមាននៅក្នុងជាលិកាសត្វ និងរុក្ខជាតិ។ វាជួយធ្វើឱ្យវាយនភាពរលូន រំលាយម្សៅ និងធ្វើឱ្យល្បាយចូលគ្នា។ លេស៊ីទីនអាចមានប្រភពពីសណ្តែកសៀង ឬពងមាន់។",
        functions: ["សារធាតុប្រឆាំងអុកស៊ីតកម្ម", "សារធាតុធ្វើឱ្យចូលគ្នា"],
    },
    e322i: {
        name: "លេស៊ីទីន",
        functions: ["សារធាតុប្រឆាំងអុកស៊ីតកម្ម", "សារធាតុធ្វើឱ្យចូលគ្នា"],
    },
    e500: {
        name: "សូដ្យូមកាបូណាត",
        description: "សូដ្យូមកាបូណាតជាសមាសធាតុដែលផ្សំពីសូដ្យូម និងកាបូណាត។",
        functions: ["សារធាតុរក្សាស្ថិរភាព", "សារធាតុធ្វើឱ្យខាប់"],
    },
    e500ii: {
        name: "សូដ្យូមអ៊ីដ្រូសែនកាបូណាត (ម្សៅសូដា)",
        description:
            "សូដ្យូមប៊ីកាបូណាត ឬសូដ្យូមអ៊ីដ្រូសែនកាបូណាត ដែលហៅថាម្សៅសូដា មានរូបមន្តគីមី NaHCO3។",
        functions: ["សារធាតុរក្សាស្ថិរភាព", "សារធាតុធ្វើឱ្យខាប់"],
    },
    e503: { name: "អាម៉ូញ៉ូមកាបូណាត" },
    e503ii: {
        name: "អាម៉ូញ៉ូមអ៊ីដ្រូសែនកាបូណាត",
        description:
            "អាម៉ូញ៉ូមប៊ីកាបូណាតជាសមាសធាតុអសរីរាង្គដែលមានរូបមន្ត NH4HCO3។ វាប្រើជាសារធាតុធ្វើឱ្យម្សៅឡើង។",
    },
    e471: {
        name: "ម៉ូណូ- និងឌីគ្លីសេរីដនៃអាស៊ីតខ្លាញ់",
        description:
            "ម៉ូណូ- និងឌីគ្លីសេរីដនៃអាស៊ីតខ្លាញ់ (E471) ជាសារធាតុបន្ថែមអាហារដែលប្រើជាសារធាតុធ្វើឱ្យចូលគ្នា។",
        functions: ["សារធាតុធ្វើឱ្យចូលគ្នា", "សារធាតុរក្សាស្ថិរភាព"],
    },
    e472e: {
        name: "អេស្ទែរអាស៊ីតតាតារិកនៃម៉ូណូ- និងឌីគ្លីសេរីដ",
        functions: [
            "សារធាតុធ្វើឱ្យចូលគ្នា",
            "សារធាតុចងលោហៈ",
            "សារធាតុរក្សាស្ថិរភាព",
        ],
    },
    e330: {
        name: "អាស៊ីតស៊ីទ្រិច",
        functions: ["សារធាតុប្រឆាំងអុកស៊ីតកម្ម", "សារធាតុចងលោហៈ"],
    },
    e415: {
        name: "ស្ករកៅស៊ូសង់ថាន",
        description:
            "ស្ករកៅស៊ូសង់ថានជាប៉ូលីសាក់ការីតដែលប្រើជាសារធាតុបន្ថែមអាហារ។",
        functions: [
            "សារធាតុធ្វើឱ្យចូលគ្នា",
            "សារធាតុរក្សាស្ថិរភាព",
            "សារធាតុធ្វើឱ្យខាប់",
        ],
    },
    e412: {
        name: "ស្ករកៅស៊ូហ្គួរ",
        functions: [
            "សារធាតុធ្វើឱ្យចូលគ្នា",
            "សារធាតុរក្សាស្ថិរភាព",
            "សារធាតុធ្វើឱ្យខាប់",
        ],
    },
    e407: {
        name: "ការ៉ាជីណង់",
        functions: [
            "សារធាតុជំនួយដឹកជញ្ជូន",
            "សារធាតុធ្វើឱ្យចូលគ្នា",
            "សារធាតុរក្សាសំណើម",
            "សារធាតុរក្សាស្ថិរភាព",
            "សារធាតុធ្វើឱ្យខាប់",
        ],
    },
    e440: { name: "ប៉ិចទីន" },
    e150a: {
        name: "ពណ៌ការ៉ាមែលធម្មតា",
        description: "ពណ៌ការ៉ាមែលជាពណ៌អាហារដែលរលាយក្នុងទឹក។",
        functions: ["ពណ៌"],
    },
    e150d: { name: "ការ៉ាមែលអាម៉ូញ៉ូមស៊ុលហ្វីត", functions: ["ពណ៌"] },
    e160a: { name: "ការ៉ូទីន", functions: ["ពណ៌"] },
    e100: { name: "ខឺរគុយមីន", functions: ["ពណ៌"] },
    e101: { name: "រីបូហ្វ្លាវីន", functions: ["ពណ៌"] },
    e202: {
        name: "ប៉ូតាស្យូមស័របាត",
        description:
            "ប៉ូតាស្យូមស័របាតជាអំបិលប៉ូតាស្យូមរបស់អាស៊ីតស័របិច ដែលមានរូបមន្ត CH3CH=CH−CH=CH−CO2K។",
        functions: ["សារធាតុរក្សាទុក"],
    },
    e211: {
        name: "សូដ្យូមបេនហ្សូអាត",
        description: "សូដ្យូមបេនហ្សូអាតជាសារធាតុដែលមានរូបមន្តគីមី NaC7H5O2។",
        functions: ["សារធាតុរក្សាទុក"],
    },
    e282: {
        name: "កាល់ស្យូមប្រូប្យូណាត",
        description:
            "កាល់ស្យូមប្រូប្យូណាតមានរូបមន្ត Ca-C2H5COO-2 និងប្រើជាសារធាតុរក្សាទុកក្នុងអាហារជាច្រើន។",
        functions: ["សារធាតុរក្សាទុក"],
    },
    e300: {
        name: "អាស៊ីតអាស្ករប៊ីក (វីតាមីន C)",
        functions: ["សារធាតុប្រឆាំងអុកស៊ីតកម្ម", "សារធាតុចងលោហៈ"],
    },
    e306: { name: "សារធាតុសម្បូរតូកូហ្វេរ៉ុល (វីតាមីន E)" },
    e450: {
        name: "ឌីផូស្វាត",
        functions: [
            "សារធាតុធ្វើឱ្យចូលគ្នា",
            "សារធាតុរក្សាសំណើម",
            "សារធាតុចងលោហៈ",
            "សារធាតុរក្សាស្ថិរភាព",
            "សារធាតុធ្វើឱ្យខាប់",
        ],
    },
    e452: {
        name: "ប៉ូលីផូស្វាត",
        functions: [
            "សារធាតុធ្វើឱ្យចូលគ្នា",
            "សារធាតុរក្សាសំណើម",
            "សារធាតុចងលោហៈ",
            "សារធាតុរក្សាស្ថិរភាព",
            "សារធាតុធ្វើឱ្យខាប់",
        ],
    },
    e621: {
        name: "ម៉ូណូសូដ្យូមគ្លូតាម៉ាត (MSG)",
        description:
            "ម៉ូណូសូដ្យូមគ្លូតាម៉ាត (MSG) ឬសូដ្យូមគ្លូតាម៉ាត ជាអំបិលសូដ្យូមរបស់អាស៊ីតគ្លូតាមិច។",
        functions: ["សារធាតុបង្កើនរសជាតិ"],
    },
}

const COUNTRY_TRANSLATIONS_KM: Record<string, string> = {
    france: "បារាំង",
    bulgaria: "ប៊ុលហ្គារី",
    slovenia: "ស្លូវេនី",
    croatia: "ក្រូអាស៊ី",
    germany: "អាល្លឺម៉ង់",
    japan: "ជប៉ុន",
    "united kingdom": "ចក្រភពអង់គ្លេស",
    italy: "អ៊ីតាលី",
    spain: "អេស្ប៉ាញ",
    portugal: "ព័រទុយហ្គាល់",
    denmark: "ដាណឺម៉ាក",
    poland: "ប៉ូឡូញ",
    romania: "រូម៉ានី",
    hungary: "ហុងគ្រី",
    "south africa": "អាហ្វ្រិកខាងត្បូង",
    finland: "ហ្វាំងឡង់",
    china: "ចិន",
    norway: "ន័រវែស",
    israel: "អ៊ីស្រាអែល",
    sweden: "ស៊ុយអែត",
    mexico: "ម៉ិកស៊ិក",
    canada: "កាណាដា",
    colombia: "កូឡុំប៊ី",
    uruguay: "អ៊ុយរូហ្គាយ",
    peru: "ប៉េរូ",
    argentina: "អាហ្សង់ទីន",
    chile: "ឈីលី",
    paraguay: "ប៉ារ៉ាហ្គាយ",
    ecuador: "អេក្វាឌ័រ",
    brazil: "ប្រេស៊ីល",
    slovakia: "ស្លូវ៉ាគី",
    "czech republic": "សាធារណរដ្ឋឆេក",
    serbia: "ស៊ែប៊ី",
    mongolia: "ម៉ុងហ្គោលី",
    türkiye: "តួកគី",
    netherlands: "ហូឡង់",
    "south korea": "កូរ៉េខាងត្បូង",
    cambodia: "កម្ពុជា",
    thailand: "ថៃ",
    singapore: "សិង្ហបុរី",
    india: "ឥណ្ឌា",
    vietnam: "វៀតណាម",
    pakistan: "ប៉ាគីស្ថាន",
    indonesia: "ឥណ្ឌូណេស៊ី",
    austria: "អូទ្រីស",
    australia: "អូស្ត្រាលី",
    "new zealand": "នូវែលសេឡង់",
    malaysia: "ម៉ាឡេស៊ី",
    macau: "ម៉ាកាវ",
    greece: "ក្រិក",
    morocco: "ម៉ារ៉ុក",
    algeria: "អាល់ហ្សេរី",
    switzerland: "ស្វីស",
    "united states": "សហរដ្ឋអាមេរិក",
}

const TAXONOMY_TRANSLATIONS_KM: Record<string, string> = {
    all: "ទាំងអស់",
    front: "មុខ",
    ingredients: "គ្រឿងផ្សំ",
    nutrition: "អាហារូបត្ថម្ភ",
    packaging: "វេចខ្ចប់",
    vegetarian: "អាហារបួស",
    "ponto verde": "សញ្ញា Ponto Verde",
    "sans gluten": "គ្មានគ្លុយតែន",
    "no gluten": "គ្មានគ្លុយតែន",
    "no-gluten": "គ្មានគ្លុយតែន",
    ...COUNTRY_TRANSLATIONS_KM,
    "central america": "អាមេរិកកណ្តាល",
    "switzerland / liechtenstein": "ស្វីស / លិចតិនស្តាញ",
    arabic: "ភាសាអារ៉ាប់",
    german: "ភាសាអាល្លឺម៉ង់",
    english: "ភាសាអង់គ្លេស",
    spanish: "ភាសាអេស្ប៉ាញ",
    french: "ភាសាបារាំង",
    italian: "ភាសាអ៊ីតាលី",
    japanese: "ភាសាជប៉ុន",
    khmer: "ភាសាខ្មែរ",
    korean: "ភាសាកូរ៉េ",
    lao: "ភាសាឡាវ",
    malay: "ភាសាម៉ាឡេ",
    dutch: "ភាសាហូឡង់",
    portuguese: "ភាសាព័រទុយហ្គាល់",
    russian: "ភាសារុស្ស៊ី",
    thai: "ភាសាថៃ",
    vietnamese: "ភាសាវៀតណាម",
    chinese: "ភាសាចិន",
    ...packagingTaxonomyTranslations,
}

const LABEL_TAXONOMY_TRANSLATIONS_KM: Record<string, string> = {
    ...labelsTaxonomyTranslations,
}

export function getAdditiveReference(
    locale: AppLocale,
    code: string,
): AdditiveReference | undefined {
    const references =
        locale === "km" ? ADDITIVE_REFERENCES_KM : ADDITIVE_REFERENCES_EN
    return references[code]
}

export function translateTaxonomyValue(
    locale: AppLocale,
    value: string,
): string {
    if (locale !== "km") return value
    const normalized = value
        .replace(/^(?:[a-z]{2,3}:)+/i, "")
        .replace(/[-_]+/g, " ")
        .trim()
        .toLowerCase()
    return TAXONOMY_TRANSLATIONS_KM[normalized] ?? value
}

function normalizeGeographicName(value: string): string {
    return value
        .replace(/^(?:[a-z]{2,3}:)+/i, "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’‘]/g, "'")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
}

const COUNTRY_OVERRIDES_KM = Object.fromEntries(
    Object.entries(COUNTRY_TRANSLATIONS_KM).map(([name, translation]) => [
        normalizeGeographicName(name),
        translation,
    ]),
)

const GS1_REGION_OVERRIDES_KM: Record<string, string> = {
    "chinese taipei": "ឆាយនីស តៃប៉ិ",
}

export function translateGeographicName(
    locale: AppLocale,
    value: string,
): string {
    if (locale !== "km") return value
    const normalized = normalizeGeographicName(value)
    const direct =
        COUNTRY_OVERRIDES_KM[normalized] ??
        GS1_REGION_OVERRIDES_KM[normalized] ??
        GEOGRAPHIC_NAMES_KM[normalized]
    if (direct) return direct

    const parts = value.split(/\s*\/\s*/)
    if (parts.length < 2) return value
    const translated = parts.map((part) =>
        translateGeographicName(locale, part),
    )
    return translated.every((part, index) => part !== parts[index])
        ? translated.join(" / ")
        : value
}

export function translateManufacturingPlaces(
    locale: AppLocale,
    value: string,
): string {
    if (locale !== "km") return value
    return value
        .split(",")
        .map((place) => translateGeographicName(locale, place.trim()))
        .join(", ")
}

function normalizeLabelValue(value: string): string {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/^(?:[a-z]{2,3}:)+/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/[’']/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
}

export function translateLabelValue(locale: AppLocale, value: string): string {
    if (locale !== "km") return value
    const normalized = normalizeLabelValue(value)
    return LABEL_TAXONOMY_TRANSLATIONS_KM[normalized] ?? value
}

export type ProductTranslationKey = keyof typeof englishProduct
export type ProductTranslationValues = Record<string, string | number>
export const productTranslationKeys = Object.keys(
    englishProduct,
) as ProductTranslationKey[]

function interpolate(
    template: string,
    values?: ProductTranslationValues,
): string {
    return template.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) =>
        values?.[name] === undefined ? `{{${name}}}` : String(values[name]),
    )
}

export function translateProduct(
    locale: AppLocale,
    key: ProductTranslationKey,
    values?: ProductTranslationValues,
) {
    const text = locale === "km" ? khmerProduct[key] : englishProduct[key]
    return interpolate(text ?? englishProduct[key], values)
}

export function useProductTranslation() {
    const { locale } = useLocale()

    return {
        locale,
        t: (key: ProductTranslationKey, values?: ProductTranslationValues) =>
            translateProduct(locale, key, values),
    }
}

const NUTRIENT_TRANSLATION_KEYS: Record<string, ProductTranslationKey> = {
    "energy-kcal": "energyCalories",
    energy_kcal: "energyCalories",
    "energy-kj": "energyKj",
    energy_kj: "energyKj",
    fat: "totalFat",
    monounsaturated_fat: "monounsaturatedFat",
    polyunsaturated_fat: "polyunsaturatedFat",
    "saturated-fat": "saturatedFat",
    saturated_fat: "saturatedFat",
    "trans-fat": "transFat",
    trans_fat: "transFat",
    cholesterol: "cholesterol",
    carbohydrates: "totalCarbohydrates",
    sugars: "sugars",
    fiber: "dietaryFiber",
    starch: "starch",
    proteins: "protein",
    protein: "protein",
    salt: "salt",
    sodium: "sodium",
    calcium: "calcium",
    iron: "iron",
    "vitamin-a": "vitaminA",
    vitamin_a: "vitaminA",
    "vitamin-b1": "vitaminB1",
    vitamin_b1: "vitaminB1",
    "vitamin-b2": "vitaminB2",
    vitamin_b2: "vitaminB2",
    "vitamin-b6": "vitaminB6",
    vitamin_b6: "vitaminB6",
    "vitamin-b9": "vitaminB9",
    vitamin_b9: "vitaminB9",
    "vitamin-b12": "vitaminB12",
    vitamin_b12: "vitaminB12",
    "vitamin-c": "vitaminC",
    vitamin_c: "vitaminC",
    "vitamin-d": "vitaminD",
    vitamin_d: "vitaminD",
    "vitamin-e": "vitaminE",
    vitamin_e: "vitaminE",
    "vitamin-k": "vitaminK",
    vitamin_k: "vitaminK",
    magnesium: "magnesium",
    phosphorus: "phosphorus",
    potassium: "potassium",
    zinc: "zinc",
    copper: "copper",
    manganese: "manganese",
    selenium: "selenium",
    iodine: "iodine",
    caffeine: "caffeine",
    taurine: "taurine",
    alcohol: "alcohol",
}

export function translateNutrientLabel(
    locale: AppLocale,
    key: string,
    fallback: string,
): string {
    const translationKey = NUTRIENT_TRANSLATION_KEYS[key]
    return translationKey ? translateProduct(locale, translationKey) : fallback
}

export function translateProductError(
    locale: AppLocale,
    error: unknown,
): string {
    const candidate = error as
        | { code?: unknown; status?: unknown; error?: { code?: unknown } }
        | null
        | undefined
    const code =
        typeof candidate?.code === "string"
            ? candidate.code
            : typeof candidate?.error?.code === "string"
              ? candidate.error.code
              : ""

    if (code === "dataset_unavailable" || candidate?.status === 503) {
        return translateProduct(locale, "datasetUnavailable")
    }
    if (code === "rate_limit_exceeded" || candidate?.status === 429) {
        return translateProduct(locale, "rateLimitExceeded")
    }
    if (code === "invalid_barcode" || candidate?.status === 422) {
        return translateProduct(locale, "invalidBarcode")
    }
    if (locale === "en" && error instanceof Error && error.message) {
        return error.message
    }
    return translateProduct(locale, "unexpectedProductError")
}
