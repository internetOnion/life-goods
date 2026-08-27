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
            className="border-coconut-brown bg-coconut-brown-soft text-foreground mx-auto w-[min(calc(100%_-_2rem),48rem)] rounded-b-xl border-x border-b px-4 pt-[calc(0.75rem_+_env(safe-area-inset-top))] pb-3 max-[23.5rem]:w-[min(calc(100%_-_1.25rem),48rem)] sm:w-[min(calc(100%_-_3rem),48rem)]"
            aria-label={t("demoNotice.title")}
            role="status"
        >
            <div className="flex items-start gap-3">
                <FlaskIcon
                    className="text-coconut-brown mt-0.5 shrink-0"
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
