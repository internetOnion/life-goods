import { FlaskIcon } from "@phosphor-icons/react"
import { useTranslation } from "react-i18next"

type DemoNoticeProps = {
    active: boolean
}

export function DemoNotice({ active }: DemoNoticeProps) {
    const { t } = useTranslation()

    if (!active) return null

    return (
        <aside
            className="border-mango bg-mango-soft text-foreground mx-auto w-full max-w-7xl border-b px-4 py-3 sm:px-6 lg:px-10"
            aria-label={t("demoNotice.title")}
            role="status"
        >
            <div className="flex items-start gap-3">
                <FlaskIcon
                    className="text-foreground mt-0.5 shrink-0"
                    aria-hidden="true"
                    size={24}
                    weight="bold"
                />
                <div>
                    <p className="font-bold">{t("demoNotice.title")}</p>
                    <p className="mt-0.5 text-sm leading-relaxed">
                        {t("demoNotice.body")}
                    </p>
                </div>
            </div>
        </aside>
    )
}
