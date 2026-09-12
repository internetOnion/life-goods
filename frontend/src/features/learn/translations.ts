import { useSyncExternalStore } from "react"

import type { LearnLocale } from "./types"

export const learnTranslations = {
    kh: {
        learn: {
            title: "ស្វែងយល់",
            intro: "រៀនអានស្លាកកញ្ចប់ និងយល់ថាភស្តុតាងអាចប្រាប់អ្វីបានខ្លះ។",
            guidesTitle: "មគ្គុទ្ទេសក៍អានស្លាក",
            guidesHint: "ជ្រើសប្រធានបទមួយ ដើម្បីមើលតារាងសង្ខេប និងមេរៀនលម្អិត។",
            searchLabel: "ស្វែងរកប្រធានបទ",
            searchPlaceholder: "ស្វែងរកតាមប្រធានបទ ចំណងជើង ឬប្រភព",
            clearSearch: "លុបការស្វែងរក",
            resultsCount: "បង្ហាញ {{count}} មេរៀន",
            noResults: "រកមិនឃើញប្រធានបទដែលត្រូវគ្នាទេ។",
            noResultsHint:
                "សាកល្បងពាក្យផ្សេង ឬសម្អាតតម្រង ដើម្បីមើលមេរៀនទាំងអស់។",
            resetFilters: "សម្អាតតម្រង",
            topicFilterLabel: "តម្រងប្រធានបទ",
            allTopics: "ប្រធានបទទាំងអស់",
            matchingTopics: "មេរៀនដែលត្រូវគ្នា",
            categoriesTitle: "មេរៀនតាមប្រភេទ",
            categoriesHint:
                "មេរៀនដែលមានប្រភពត្រូវបានរៀបចំតាមប្រធានបទ ដើម្បីងាយស្វែងរក។",
            startHere: "ចាប់ផ្តើមនៅទីនេះ",
            startHereHint: "មូលដ្ឋានសម្រាប់អានស្លាក និងពិនិត្យប្រភព។",
            matchingHint: "លទ្ធផលពីមគ្គុទ្ទេសក៍ និងឯកសារគាំទ្រ។",
            supportingTitle: "ប្រភព និងស្តង់ដារ",
            supportingHint:
                "ឯកសារច្បាប់ ស្តង់ដារ និងមេរៀនអំពីប្រភពដែលរក្សាទុកដាច់ដោយឡែកពីមគ្គុទ្ទេសក៍អានស្លាក។",
            guideLessonsTitle: "មេរៀនក្នុងមគ្គុទ្ទេសក៍នេះ",
            stepProgress: "ជំហាន {{current}} នៃ {{total}}",
            lessonNavigationLabel: "ការរុករកមេរៀន",
            previousLesson: "មេរៀនមុន",
            nextLesson: "មេរៀនបន្ទាប់",
            firstLesson: "មេរៀនដំបូង",
            lastLesson: "មេរៀនចុងក្រោយ",
            lessonNumber: "មេរៀន {{page}}",
            unavailableGuideTitle: "រកមិនឃើញមគ្គុទ្ទេសក៍នេះទេ",
            backToLearn: "ត្រឡប់ទៅស្វែងយល់",
            englishContent: "មាតិកានេះជាភាសាអង់គ្លេសដែលបានពិនិត្យ",
            learningOutcomeTitle: "អ្វីដែលអ្នកនឹងយល់",
            doesNotProveTitle: "អ្វីដែលភស្តុតាងនេះមិនអាចបញ្ជាក់បាន",
            relatedTitle: "មេរៀនពាក់ព័ន្ធ",
            scanCta: "ស្កេនកញ្ចប់មួយ",
            simulatedDisclosure:
                "អត្ថបទនេះជាគំរូសាកល្បងសម្រាប់បង្ហាញរបៀបរៀបចំមាតិកាសិក្សា ហើយមិនទាន់មានប្រភពឯកសារយោងទេ។",
            explanationTitle: "សេចក្ដីសង្ខេប",
            sourceSummaryTitle: "សេចក្ដីសង្ខេបពីប្រភព",
            sourceSummaryHint:
                "ចំណុចខាងក្រោមត្រូវបានសង្ខេបពីឯកសារប្រភពដែលបានរាយខាងក្រោមសម្រាប់មេរៀននេះ។",
            allergenIngredientsTitle: "គ្រឿងផ្សំតាមក្រុមអាលែហ្សែន",
            commonIngredientNames: "ឈ្មោះគ្រឿងផ្សំទូទៅ",
            labelMeaning: "អត្ថន័យលើស្លាក",
            ingredientNote: "ចំណាំ",
            keyPointsTitle: "ចំណុចសំខាន់ៗពីប្រភព",
            unavailableTitle: "រកមិនឃើញអត្ថបទនេះទេ",
            unavailableBody:
                "តំណនេះមិនត្រូវនឹងអត្ថបទដែលមានទេ។ អ្នកអាចត្រឡប់ទៅមើលប្រធានបទទាំងអស់បាន។",
            publisherLabel: "បោះពុម្ពផ្សាយដោយ",
            issuingAgencyLabel: "ស្ថាប័នចេញផ្សាយ",
            documentReferenceLabel: "លេខឯកសារយោង",
            jurisdictionLabel: "ដែនសមត្ថកិច្ច",
            sourceDocumentsTitle: "ប្រភព និងឯកសារ",
            sectionLabel: "ផ្នែក",
            versionLabel: "កំណែប្រភព",
            internationalDisclosure:
                "ឯកសារយោងអន្តរជាតិមិនមែនជាសេចក្តីសន្និដ្ឋានអំពីច្បាប់កម្ពុជា ឬការវាយតម្លៃ Product ណាមួយទេ។",
            recordLink: "ទិន្នន័យច្បាប់នៅ Open Development Cambodia",
            khmerResourceLink: "ធនធាន PDF ភាសាខ្មែរ",
            englishResourceLink: "ធនធាន PDF ភាសាអង់គ្លេស",
            demoNoticeTitle: "កំពុងបង្ហាញទិន្នន័យសាកល្បង",
            demoNoticeBody:
                "ខ្លឹមសារនេះគឺសម្រាប់ការបង្ហាញសាកល្បងប៉ុណ្ណោះ មិនមែនជាព័ត៌មានកញ្ចប់ពិតទេ។",
            topics: {
                laws: "មូលដ្ឋានស្លាក",
                declarations: "អាលែហ្សែន និងការប្រកាស",
                halal: "ភស្តុតាង Halal",
                evidence: "ភស្តុតាង និងប្រភព",
                ingredients: "គ្រឿងផ្សំ និងសារធាតុបន្ថែម",
                dates: "កាលបរិច្ឆេទ និងសញ្ញាកញ្ចប់",
            },
        },
    },
    en: {
        learn: {
            title: "Learn",
            intro: "Learn how to read package labels and understand what the evidence can—and cannot—tell you.",
            guidesTitle: "Label-reading guides",
            guidesHint:
                "Choose a guide for a quick comparison table and detailed lessons.",
            searchLabel: "Search topics",
            searchPlaceholder: "Search by topic, title, or source",
            clearSearch: "Clear search",
            resultsCount: "Showing {{count}} lessons",
            noResults: "No topics match your search.",
            noResultsHint:
                "Try another word or clear the filters to browse every lesson.",
            resetFilters: "Reset filters",
            topicFilterLabel: "Filter by topic",
            allTopics: "All topics",
            matchingTopics: "Matching lessons",
            categoriesTitle: "Lessons by category",
            categoriesHint:
                "Browse the source-backed lessons grouped by the label topic they explain.",
            startHere: "Start here",
            startHereHint:
                "A short path into labels, identifiers, and source evidence.",
            matchingHint:
                "Results from the guides and supporting source library.",
            supportingTitle: "Sources and standards",
            supportingHint:
                "Legal documents, standards, and source-literacy lessons kept separate from the practical guides.",
            guideLessonsTitle: "Lessons in this guide",
            stepProgress: "Step {{current}} of {{total}}",
            lessonNavigationLabel: "Lesson navigation",
            previousLesson: "Previous lesson",
            nextLesson: "Next lesson",
            firstLesson: "First lesson",
            lastLesson: "Last lesson",
            lessonNumber: "Lesson {{page}}",
            unavailableGuideTitle: "Guide not found",
            backToLearn: "Back to Learn",
            englishContent: "Reviewed English content",
            learningOutcomeTitle: "What you will understand",
            doesNotProveTitle: "What this evidence does not prove",
            relatedTitle: "Related lessons",
            scanCta: "Scan a package",
            simulatedDisclosure:
                "This article is a simulated fixture that demonstrates the learning-content format. It does not yet have a supporting source.",
            explanationTitle: "Summary",
            sourceSummaryTitle: "Summary from the source",
            sourceSummaryHint:
                "The points below are summarized from the source document listed below for this lesson.",
            allergenIngredientsTitle: "Ingredients by allergen group",
            commonIngredientNames: "Common ingredient names",
            labelMeaning: "What the label can indicate",
            ingredientNote: "Note",
            keyPointsTitle: "Key points from the source",
            unavailableTitle: "Article not found",
            unavailableBody:
                "This link does not match an available article. You can return to all topics.",
            publisherLabel: "Published by",
            issuingAgencyLabel: "Issuing agency",
            documentReferenceLabel: "Document reference",
            jurisdictionLabel: "Jurisdiction",
            sourceDocumentsTitle: "Sources and documents",
            sectionLabel: "Section",
            versionLabel: "Source version",
            internationalDisclosure:
                "An international reference is not a conclusion about Cambodian law or an assessment of any Product.",
            recordLink: "Open Development Cambodia law record",
            khmerResourceLink: "Khmer PDF resource",
            englishResourceLink: "English PDF resource",
            demoNoticeTitle: "Demo data is active",
            demoNoticeBody:
                "This content is for demonstration only and is not real package information.",
            topics: {
                laws: "Label basics",
                declarations: "Allergens and declarations",
                halal: "Halal evidence",
                evidence: "Evidence and sources",
                ingredients: "Ingredients and additives",
                dates: "Dates and package marks",
            },
        },
    },
} as const

type LearnTranslationValues = Record<string, string | number>
type LearnTranslationListener = () => void

let activeLocale: LearnLocale = "en"
const listeners = new Set<LearnTranslationListener>()

function subscribe(listener: LearnTranslationListener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

function getSnapshot() {
    return activeLocale
}

function lookupTranslation(key: string, locale: LearnLocale): unknown {
    return key
        .split(".")
        .reduce<unknown>(
            (value, segment) =>
                typeof value === "object" && value !== null
                    ? (value as Record<string, unknown>)[segment]
                    : undefined,
            learnTranslations[locale],
        )
}

function translate(key: string, values?: LearnTranslationValues) {
    const translated = lookupTranslation(key, activeLocale)
    const fallback = lookupTranslation(key, "en")
    const text =
        typeof translated === "string"
            ? translated
            : typeof fallback === "string"
              ? fallback
              : key

    return text.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) =>
        values?.[name] === undefined
            ? "{{" + name + "}}"
            : String(values[name]),
    )
}

export const learnI18n = {
    get resolvedLanguage() {
        return activeLocale
    },
    changeLanguage(language: string) {
        activeLocale = language === "kh" || language === "km" ? "kh" : "en"
        listeners.forEach((listener) => listener())
        return Promise.resolve(learnI18n)
    },
    getSnapshot,
    subscribe,
}

export function useLearnTranslation() {
    useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
    return { i18n: learnI18n, t: translate }
}

export default learnI18n
