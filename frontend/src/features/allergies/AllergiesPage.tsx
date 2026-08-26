import { PlaceholderPage } from "@/ui/PlaceholderPage"
import { useTranslation } from "react-i18next"

export function AllergiesPage() {
    const { t } = useTranslation()

    return (
        <PlaceholderPage
            title={t("placeholder.allergies.title")}
            body={t("placeholder.allergies.body")}
        />
    )
}
