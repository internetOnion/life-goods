import { PlaceholderPage } from "@/ui/PlaceholderPage"
import { useTranslation } from "react-i18next"

export function HistoryPage() {
    const { t } = useTranslation()

    return (
        <PlaceholderPage
            title={t("placeholder.history.title")}
            body={t("placeholder.history.body")}
        />
    )
}
