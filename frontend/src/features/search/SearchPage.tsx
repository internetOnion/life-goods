import { PlaceholderPage } from "@/ui/PlaceholderPage"
import { useTranslation } from "react-i18next"

export function SearchPage() {
    const { t } = useTranslation()

    return (
        <PlaceholderPage
            title={t("placeholder.search.title")}
            body={t("placeholder.search.body")}
        />
    )
}
