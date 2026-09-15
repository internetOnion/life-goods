import { useLocale } from "@/i18n/locale"

const englishTranslations = {
    primaryNavigation: "Primary navigation",
    scan: "Scan",
    compare: "Compare",
    learn: "Learn",
    concerns: "Concerns",
    languageTrigger: "Language: English",
    languageShort: "EN",
    chooseLanguage: "Choose language",
    english: "English",
    khmer: "Khmer (ខ្មែរ)",
    comingSoon: "Coming soon",
    backToTop: "Back to top",
    backToScanner: "Back to scanner",
} as const

const khmerTranslations: Record<keyof typeof englishTranslations, string> = {
    primaryNavigation: "ការរុករកចម្បង",
    scan: "ស្កេន",
    compare: "ប្រៀបធៀប",
    learn: "ស្វែងយល់",
    concerns: "កង្វល់",
    languageTrigger: "ភាសា៖ ខ្មែរ",
    languageShort: "ខ្មែរ",
    chooseLanguage: "ជ្រើសរើសភាសា",
    english: "អង់គ្លេស",
    khmer: "ខ្មែរ",
    comingSoon: "មកដល់ឆាប់ៗនេះ",
    backToTop: "ត្រឡប់ទៅខាងលើ",
    backToScanner: "ត្រឡប់ទៅម៉ាស៊ីនស្កេន",
}

export const appTranslations = {
    en: englishTranslations,
    km: khmerTranslations,
} as const

export type AppTranslationKey = keyof typeof englishTranslations

export function translateApp(
    locale: keyof typeof appTranslations,
    key: AppTranslationKey,
) {
    return appTranslations[locale][key] ?? englishTranslations[key]
}

export function useAppTranslation() {
    const { locale } = useLocale()

    return {
        t: (key: AppTranslationKey) => translateApp(locale, key),
    }
}
