import React from "react"

import { SnapshotNotFoundIllustration } from "@/components/illustrations"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { useProductTranslation } from "../translations"

interface NotFoundCardProps {
    onBack: () => void
    onReadLabel: () => void
}

export const NotFoundCard: React.FC<NotFoundCardProps> = ({
    onBack,
    onReadLabel,
}) => {
    const { t } = useProductTranslation()
    return (
        <div className="space-y-4 pt-4">
            <Card className="border-neutral-200/90 bg-white p-6 text-center shadow-xs sm:p-8">
                <CardContent className="flex flex-col items-center space-y-4 p-0">
                    <SnapshotNotFoundIllustration className="mx-auto drop-shadow-xs" />

                    <div className="max-w-md space-y-1.5">
                        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-neutral-950 sm:text-2xl">
                            {t("unmatchedBarcodeTitle")}
                        </h2>
                        <p className="text-sm leading-relaxed text-neutral-600">
                            {t("unmatchedBarcodeDetail")}
                        </p>
                    </div>

                    <div className="flex w-full max-w-xs flex-col gap-2 pt-2">
                        <Button
                            variant="default"
                            onClick={onReadLabel}
                            className="w-full rounded-xl text-sm font-bold"
                        >
                            <span>{t("readThisLabel")}</span>
                        </Button>
                        <p className="text-xs text-neutral-500">
                            {t("readThisLabelHint")}
                        </p>
                        <Button
                            variant="ghost"
                            onClick={onBack}
                            className="w-full rounded-xl text-sm font-semibold"
                        >
                            <span>{t("scanAnotherBarcode")}</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
