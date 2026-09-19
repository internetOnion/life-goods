import React from "react"

import { SnapshotNotFoundIllustration } from "@/components/illustrations"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { useProductTranslation } from "../translations"

interface NotFoundCardProps {
    onBack: () => void
}

export const NotFoundCard: React.FC<NotFoundCardProps> = ({ onBack }) => {
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
                    </div>

                    <Button
                        variant="default"
                        onClick={onBack}
                        className="mt-2 w-full max-w-xs rounded-xl text-sm font-bold"
                    >
                        <span>{t("scanAnotherBarcode")}</span>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
