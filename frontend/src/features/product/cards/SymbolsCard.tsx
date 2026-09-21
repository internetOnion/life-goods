import { BadgeCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { translateLabelValue, useProductTranslation } from "../translations"

type SymbolsCardProps = {
    labels: string[]
}

export function SymbolsCard({ labels }: SymbolsCardProps) {
    const { locale, t } = useProductTranslation()
    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-2">
                <div className="flex items-center gap-2.5">
                    <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
                        <BadgeCheck className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        {t("labelsCertificationsAwards")}
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-2 sm:p-5 sm:pt-2">
                {labels.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                        {labels.map((label) => (
                            <Badge
                                key={label}
                                variant="outline"
                                className="max-w-full min-w-0 bg-neutral-50 text-xs leading-snug font-semibold wrap-anywhere whitespace-normal"
                            >
                                {translateLabelValue(locale, label)}
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-neutral-600">
                        {t("sourceDataUnavailable")}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
