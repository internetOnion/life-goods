import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"

export function LanguageSwitchButton() {
    const { i18n, t } = useTranslation()
    const currentLanguage = i18n.resolvedLanguage === "en" ? "en" : "km"
    const targetLanguage = currentLanguage === "km" ? "en" : "km"

    return (
        <Button
            className="border-primary/45 bg-background text-foreground hover:bg-primary/10 hover:text-foreground size-11 rounded-full p-0"
            variant="outline"
            type="button"
            aria-label={t(
                targetLanguage === "en" ? "switchToEnglish" : "switchToKhmer",
            )}
            onClick={() => void i18n.changeLanguage(targetLanguage)}
        >
            <LanguageFlag language={currentLanguage} />
        </Button>
    )
}

function LanguageFlag({ language }: { language: "en" | "km" }) {
    if (language === "km") {
        return (
            <svg
                aria-hidden="true"
                className="size-7 overflow-hidden rounded-full"
                data-language-flag="km"
                preserveAspectRatio="xMidYMid slice"
                viewBox="0 0 30 20"
            >
                <rect width="30" height="20" fill="#032ea1" />
                <rect width="30" height="10" y="5" fill="#e00025" />
                <path
                    d="M7 14h16v-1H21v-1.3h-1V9.6l-1.6-1.4-1.5 1.4v1.1h-1V7.8L15 6.4l-.9 1.4v2.9h-1V9.6l-1.5-1.4L10 9.6v2.1H9V13H7v1Z"
                    fill="#fff"
                />
            </svg>
        )
    }

    return (
        <svg
            aria-hidden="true"
            className="size-7 overflow-hidden rounded-full"
            data-language-flag="en"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 30 20"
        >
            <rect width="30" height="20" fill="#012169" />
            <path d="M0 0 30 20M30 0 0 20" stroke="#fff" strokeWidth="5" />
            <path d="M0 0 30 20M30 0 0 20" stroke="#c8102e" strokeWidth="2.2" />
            <path d="M15 0v20M0 10h30" stroke="#fff" strokeWidth="6" />
            <path d="M15 0v20M0 10h30" stroke="#c8102e" strokeWidth="3.4" />
        </svg>
    )
}
