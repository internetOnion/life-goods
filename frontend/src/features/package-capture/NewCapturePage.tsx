import { FocusedPlaceholderPage } from "@/ui/FocusedPlaceholderPage"
import { useTranslation } from "react-i18next"

import { appRoutes } from "@/app/routes"

export function NewCapturePage() {
    const { t } = useTranslation()

    return (
        <FocusedPlaceholderPage
            title={t("placeholder.captureNew.title")}
            body={t("placeholder.captureNew.body")}
            actionLabel={t("capture.exit")}
            actionIcon="exit"
            actionTo={appRoutes.home}
        />
    )
}
