import { AlertCircle, ArrowLeft } from "lucide-react"
import React from "react"

import { SnapshotNotFoundIllustration } from "@/components/illustrations"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface NotFoundCardProps {
    identifier: string
    onBack: () => void
}

export const NotFoundCard: React.FC<NotFoundCardProps> = ({
    identifier,
    onBack,
}) => {
    return (
        <div className="space-y-4 pt-4">
            <Card className="border-neutral-200/90 bg-white p-6 text-center shadow-xs sm:p-8">
                <CardContent className="flex flex-col items-center space-y-4 p-0">
                    <SnapshotNotFoundIllustration className="mx-auto drop-shadow-xs" />

                    <div className="max-w-md space-y-1.5">
                        <h2 className="text-xl font-extrabold tracking-[-0.02em] text-neutral-950 sm:text-2xl">
                            No Package Record Found
                        </h2>
                        <p className="text-sm leading-relaxed font-normal text-neutral-600">
                            Barcode{" "}
                            <span className="font-mono font-bold tracking-[0.04em] text-neutral-900 tabular-nums">
                                {identifier}
                            </span>{" "}
                            does not exist in the active local Open Food Facts
                            snapshot.
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5 rounded-xl border border-neutral-200/60 bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-600">
                        <AlertCircle className="h-4 w-4 shrink-0 text-neutral-400" />
                        <span>
                            Products must be present in the downloaded snapshot
                            dataset to be displayed.
                        </span>
                    </div>

                    <Button
                        variant="default"
                        onClick={onBack}
                        className="mt-2 w-full max-w-xs gap-2 rounded-xl text-sm font-bold"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span>Scan Another Barcode</span>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
