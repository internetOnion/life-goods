import { AlertCircle, ArrowLeft, Sparkles } from "lucide-react"
import React from "react"

import { SnapshotNotFoundIllustration } from "@/components/illustrations"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

interface NotFoundCardProps {
    identifier: string
    onBack: () => void
    onTrySample: (barcode: string) => void
}

const SAMPLE_PRODUCTS = [
    { code: "3017620422003", name: "Nutella Spread 400g" },
    { code: "5449000000996", name: "Coca-Cola 330ml Can" },
    { code: "7622210449283", name: "Prince Chocolat Biscuits" },
    { code: "8000500310427", name: "Nutella Biscuits" },
]

export const NotFoundCard: React.FC<NotFoundCardProps> = ({
    identifier,
    onBack,
    onTrySample,
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

            {/* Quick-try sample barcodes */}
            <Card className="border-neutral-200/80 bg-neutral-50/70 p-4 shadow-xs sm:p-5">
                <CardContent className="space-y-3 p-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 sm:text-sm">
                        <Sparkles className="text-primary-600 h-3.5 w-3.5" />
                        <span>Try One Of These Sample Products</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {SAMPLE_PRODUCTS.map((s) => (
                            <Button
                                key={s.code}
                                variant="outline"
                                size="sm"
                                type="button"
                                onClick={() => onTrySample(s.code)}
                                className="hover:border-primary-500 flex h-auto w-full cursor-pointer items-center justify-between rounded-xl border-neutral-200 bg-white p-2.5 text-left transition-all hover:shadow-2xs"
                            >
                                <div className="min-w-0 pr-2">
                                    <span className="block truncate text-xs font-bold text-neutral-900 sm:text-sm">
                                        {s.name}
                                    </span>
                                    <span className="block font-mono text-xs font-medium text-neutral-500 tabular-nums">
                                        {s.code}
                                    </span>
                                </div>
                                <span className="text-primary-600 shrink-0 text-xs font-bold">
                                    View →
                                </span>
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
