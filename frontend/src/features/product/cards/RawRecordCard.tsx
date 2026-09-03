import { Check, Copy, Terminal } from "lucide-react"
import React, { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProductLookupMetaResponse } from "@/features/product/types"

interface RawRecordCardProps {
    meta: ProductLookupMetaResponse
    rawRecord: Record<string, unknown>
}

export const RawRecordCard: React.FC<RawRecordCardProps> = ({
    meta,
    rawRecord,
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const [isCopied, setIsCopied] = useState(false)

    const payload = {
        meta,
        source_record: rawRecord,
    }

    const jsonString = JSON.stringify(payload, null, 2)

    const handleCopy = () => {
        void navigator.clipboard.writeText(jsonString)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 2000)
    }

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-5">
                <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-neutral-500" />
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        Raw API Data & Developer Inspector
                    </CardTitle>
                </div>

                <div className="flex items-center gap-2">
                    {isOpen && (
                        <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={handleCopy}
                            className="inline-flex h-auto cursor-pointer items-center gap-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                        >
                            {isCopied ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                                <Copy className="h-3 w-3 text-neutral-500" />
                            )}
                            <span>{isCopied ? "Copied" : "Copy JSON"}</span>
                        </Button>
                    )}

                    <Button
                        variant="subtle"
                        size="sm"
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="cursor-pointer rounded-lg text-xs font-semibold"
                    >
                        {isOpen ? "Hide Inspector" : "Inspect JSON"}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-3 p-4 pt-2 text-xs sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200/60 bg-neutral-50 p-2.5 font-mono text-xs text-neutral-700">
                    <span>Route: /api/v1/experimental/products/:barcode</span>
                    <span className="text-neutral-500">
                        Snapshot: {meta.dataset.version}
                    </span>
                </div>

                {isOpen && (
                    <div className="animate-in fade-in relative duration-200">
                        <pre className="max-h-96 overflow-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-4 font-mono text-xs leading-relaxed text-emerald-400 tabular-nums">
                            <code>{jsonString}</code>
                        </pre>
                    </div>
                )}

                <p className="text-xs font-medium text-neutral-500">
                    Full verbatim response payload returned by the local Open
                    Food Facts database.
                </p>
            </CardContent>
        </Card>
    )
}
