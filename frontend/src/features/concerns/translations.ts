import { useLocale, type AppLocale } from "@/i18n/locale"

import { isConcernId, type ConcernId } from "./allergens"

const englishConcerns = {
    pageTitle: "Allergy",
    pageDescription: "Select allergens to highlight when looking up Products.",
    storageError:
        "Your choices could not be saved. They will last only for this visit.",
    activeConcerns: "Selected allergens ({{count}})",
    resetAll: "Reset all",
    removeConcern: "Remove {{name}}",
    noSelectedConcerns:
        "No allergens selected yet. Choose from the list below.",
    availableConcerns: "Available allergens",
    selectConcerns: "Select allergens to highlight",
} as const

type ConcernTranslations = {
    [Key in keyof typeof englishConcerns]: string
}

const khmerConcerns: ConcernTranslations = {
    pageTitle: "អាលែហ្ស៊ី",
    pageDescription:
        "ជ្រើសរើសសារធាតុបង្កអាលែហ្ស៊ី ដើម្បីបន្លិចនៅពេលស្វែងរកផលិតផល។",
    storageError:
        "មិនអាចរក្សាទុកជម្រើសរបស់អ្នកបានទេ។ ជម្រើសទាំងនេះនឹងមានសម្រាប់តែការចូលមើលនេះប៉ុណ្ណោះ។",
    activeConcerns: "សារធាតុបង្កអាលែហ្ស៊ីដែលបានជ្រើសរើស ({{count}})",
    resetAll: "កំណត់ឡើងវិញទាំងអស់",
    removeConcern: "ដក {{name}} ចេញ",
    noSelectedConcerns:
        "មិនទាន់បានជ្រើសរើសសារធាតុបង្កអាលែហ្ស៊ីទេ។ ជ្រើសរើសពីបញ្ជីខាងក្រោម។",
    availableConcerns: "សារធាតុបង្កអាលែហ្ស៊ីដែលមាន",
    selectConcerns: "ជ្រើសរើសសារធាតុបង្កអាលែហ្ស៊ីដើម្បីបន្លិច",
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
