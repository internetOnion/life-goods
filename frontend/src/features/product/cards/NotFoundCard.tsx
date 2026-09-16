import { AlertCircle, ArrowLeft } from "lucide-react"
import React from "react"

import { SnapshotNotFoundIllustration } from "@/components/illustrations"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { useProductTranslation } from "../translations"

interface NotFoundCardProps {
    identifier: string
    onBack: () => void
}

export const NotFoundCard: React.FC<NotFoundCardProps> = ({
    identifier,
    onBack,
}) => {
    const { t } = useProductTranslation()
    return (
        <div className="space-y-4 pt-4">
            <Card className="border-neutral-200/90 bg-white p-6 text-center shadow-xs sm:p-8">
                <CardContent className="flex flex-col items-center space-y-4 p-0">
                    <SnapshotNotFoundIllustration className="mx-auto drop-shadow-xs" />

                    <div className="max-w-md space-y-1.5">
                        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-neutral-950 sm:text-2xl">
                            {t("noPackageRecord")}
                        </h2>
                        <p className="text-sm leading-relaxed font-normal text-neutral-600">
                            <span>{t("barcodeNotInSnapshotPrefix")} </span>
                            <span className="font-mono tabular-nums">
                                {identifier}
                            </span>
                            <span> {t("barcodeNotInSnapshotSuffix")}</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5 rounded-xl border border-neutral-200/60 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600">
                        <AlertCircle className="h-4 w-4 shrink-0 text-neutral-500" />
                        <span>{t("snapshotOnlyProducts")}</span>
                    </div>

                    <Button
                        variant="default"
                        onClick={onBack}
                        className="mt-2 w-full max-w-xs gap-2 rounded-xl text-sm font-bold"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>{t("scanAnotherBarcode")}</span>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
