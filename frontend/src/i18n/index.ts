import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import { appTranslations } from "@/app/translations"
import { allergiesTranslations } from "@/features/allergies/translations"
import { historyTranslations } from "@/features/history/translations"
import { learnTranslations } from "@/features/learn/translations"
import { notFoundTranslations } from "@/features/not-found/translations"
import { packageCaptureTranslations } from "@/features/package-capture/translations"
import { packageMatchTranslations } from "@/features/package-match/translations"
import { searchTranslations } from "@/features/search/translations"

const placeholderTranslations = {
    km: {
        ...searchTranslations.km,
        ...learnTranslations.km,
        ...historyTranslations.km,
        ...allergiesTranslations.km,
        ...packageCaptureTranslations.km.placeholders,
    },
    en: {
        ...searchTranslations.en,
        ...learnTranslations.en,
        ...historyTranslations.en,
        ...allergiesTranslations.en,
        ...packageCaptureTranslations.en.placeholders,
    },
} as const

export const resources = {
    km: {
        translation: {
            ...appTranslations.km,
            ...packageMatchTranslations.km,
            learn: learnTranslations.km.learn,
            search: searchTranslations.km.search,
            allergies: allergiesTranslations.km.allergies,
            capture: packageCaptureTranslations.km.capture,
            ...notFoundTranslations.km,
            placeholder: placeholderTranslations.km,
        },
    },
    en: {
        translation: {
            ...appTranslations.en,
            ...packageMatchTranslations.en,
            learn: learnTranslations.en.learn,
            search: searchTranslations.en.search,
            allergies: allergiesTranslations.en.allergies,
            capture: packageCaptureTranslations.en.capture,
            ...notFoundTranslations.en,
            placeholder: placeholderTranslations.en,
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
