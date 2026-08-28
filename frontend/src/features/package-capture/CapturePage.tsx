import { FocusedPlaceholderPage } from "@/ui/FocusedPlaceholderPage"
import { useTranslation } from "react-i18next"

import { appRoutes } from "@/app/routes"

export function CapturePage() {
    const { t } = useTranslation()

    return (
        <FocusedPlaceholderPage
            title={t("placeholder.captureDetail.title")}
            body={t("placeholder.captureDetail.body")}
            actionLabel={t("capture.back")}
            actionIcon="back"
            actionTo={appRoutes.captureNew}
        />
    )
}
