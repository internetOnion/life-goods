import { useTranslation } from "react-i18next"

import { appRoutes } from "@/app/routes"
import { useMvpDemoMode } from "@/config/MvpDemoModeContext"
import { FocusedPlaceholderPage } from "@/ui/FocusedPlaceholderPage"

import { CaptureJourney } from "./CaptureJourney"

export function NewCapturePage() {
    const demoMode = useMvpDemoMode()
    const { t } = useTranslation()

    if (!demoMode) {
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

    return <CaptureJourney />
}
