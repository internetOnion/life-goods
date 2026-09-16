import { useLocale, type AppLocale } from "@/i18n/locale"

import { isConcernId, type ConcernId } from "./allergens"

const englishConcerns = {
    pageTitle: "Allergy Concerns",
    pageDescription:
        "Select dietary concerns and allergens to highlight when looking up Products.",
    storageError:
        "Your choices could not be saved. They will last only for this visit.",
    activeConcerns: "Active Concerns ({{count}})",
    resetAll: "Reset all",
    removeConcern: "Remove {{name}}",
    noSelectedConcerns:
        "No concerns selected yet. Tap any item below to flag it.",
    availableConcerns: "Available Allergens & Ingredients",
    selectConcerns: "Select allergy and dietary concerns",
} as const

type ConcernTranslations = {
    [Key in keyof typeof englishConcerns]: string
}

const khmerConcerns: ConcernTranslations = {
    pageTitle: "កង្វល់អាលែហ្ស៊ី",
    pageDescription:
        "ជ្រើសរើសកង្វល់អាហារ និងអាលែហ្ស៊ី ដើម្បីបន្លិចនៅពេលស្វែងរកផលិតផល។",
    storageError:
        "មិនអាចរក្សាទុកជម្រើសរបស់អ្នកបានទេ។ ជម្រើសទាំងនេះនឹងមានសម្រាប់តែការចូលមើលនេះប៉ុណ្ណោះ។",
    activeConcerns: "កង្វល់សកម្ម ({{count}})",
    resetAll: "កំណត់ឡើងវិញទាំងអស់",
    removeConcern: "ដក {{name}} ចេញ",
    noSelectedConcerns:
        "មិនទាន់បានជ្រើសរើសកង្វល់ទេ។ អ្នកអាចជ្រេីសរេីសពីខាងក្រោម។",
    availableConcerns: "អាលែហ្ស៊ី និងគ្រឿងផ្សំដែលមាន",
    selectConcerns: "ជ្រើសរើសកង្វល់អាលែហ្ស៊ី និងអាហារ",
}

const khmerConcernLabels: Record<ConcernId, string> = {
    celery: "សេលេរី",
    crustaceans: "សត្វសមុទ្រមានសំបក",
    eggs: "ស៊ុត",
    fish: "ត្រី",
    gluten: "គ្លុយតែន",
    lupin: "លូពីន",
    milk: "ទឹកដោះគោ",
    molluscs: "សត្វមូល្លុស",
    mustard: "មេស្តាត",
    nuts: "គ្រាប់ធញ្ញជាតិមានសំបក",
    peanuts: "សណ្តែកដី",
    sesameSeeds: "គ្រាប់ល្ង",
    soybeans: "សណ្តែកសៀង",
}

export const concernTranslations = {
    en: englishConcerns,
    km: khmerConcerns,
} as const satisfies Record<AppLocale, ConcernTranslations>

export type ConcernTranslationKey = keyof typeof englishConcerns
export type ConcernTranslationValues = Record<string, string | number>

export const concernTranslationKeys = Object.keys(
    englishConcerns,
) as ConcernTranslationKey[]

function interpolate(
    template: string,
    values?: ConcernTranslationValues,
): string {
    return template.replace(/{{\s*(\w+)\s*}}/g, (_, name: string) =>
        values?.[name] === undefined ? `{{${name}}}` : String(values[name]),
    )
}

export function translateConcern(
    locale: AppLocale,
    key: ConcernTranslationKey,
    values?: ConcernTranslationValues,
): string {
    return interpolate(concernTranslations[locale][key], values)
}

export function translateConcernLabel(
    locale: AppLocale,
    concernId: string,
    fallback: string,
): string {
    if (locale !== "km" || !isConcernId(concernId)) return fallback
    return khmerConcernLabels[concernId]
}

export function useConcernTranslation() {
    const { locale } = useLocale()

    return {
        locale,
        t: (key: ConcernTranslationKey, values?: ConcernTranslationValues) =>
            translateConcern(locale, key, values),
    }
}
