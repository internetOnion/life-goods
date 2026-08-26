import { PlaceholderPage } from "@/ui/PlaceholderPage"
import { useTranslation } from "react-i18next"

export function LearnPage() {
    const { t } = useTranslation()

    return (
        <PlaceholderPage
            title={t("placeholder.learn.title")}
            body={t("placeholder.learn.body")}
        />
    )
}
