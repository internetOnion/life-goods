import { Calendar, CheckCircle2, Clock, Database, User } from "lucide-react"
import React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface DataQualityCardProps {
    completeness?: number | null
    statesTags: string[]
    creator?: string | null
    lastModified?: string | null
}

const WIDTH_CLASSES: string[] = [
    "w-[0%]",
    "w-[1%]",
    "w-[2%]",
    "w-[3%]",
    "w-[4%]",
    "w-[5%]",
    "w-[6%]",
    "w-[7%]",
    "w-[8%]",
    "w-[9%]",
    "w-[10%]",
    "w-[11%]",
    "w-[12%]",
    "w-[13%]",
    "w-[14%]",
    "w-[15%]",
    "w-[16%]",
    "w-[17%]",
    "w-[18%]",
    "w-[19%]",
    "w-[20%]",
    "w-[21%]",
    "w-[22%]",
    "w-[23%]",
    "w-[24%]",
    "w-[25%]",
    "w-[26%]",
    "w-[27%]",
    "w-[28%]",
    "w-[29%]",
    "w-[30%]",
    "w-[31%]",
    "w-[32%]",
    "w-[33%]",
    "w-[34%]",
    "w-[35%]",
    "w-[36%]",
    "w-[37%]",
    "w-[38%]",
    "w-[39%]",
    "w-[40%]",
    "w-[41%]",
    "w-[42%]",
    "w-[43%]",
    "w-[44%]",
    "w-[45%]",
    "w-[46%]",
    "w-[47%]",
    "w-[48%]",
    "w-[49%]",
    "w-[50%]",
    "w-[51%]",
    "w-[52%]",
    "w-[53%]",
    "w-[54%]",
    "w-[55%]",
    "w-[56%]",
    "w-[57%]",
    "w-[58%]",
    "w-[59%]",
    "w-[60%]",
    "w-[61%]",
    "w-[62%]",
    "w-[63%]",
    "w-[64%]",
    "w-[65%]",
    "w-[66%]",
    "w-[67%]",
    "w-[68%]",
    "w-[69%]",
    "w-[70%]",
    "w-[71%]",
    "w-[72%]",
    "w-[73%]",
    "w-[74%]",
    "w-[75%]",
    "w-[76%]",
    "w-[77%]",
    "w-[78%]",
    "w-[79%]",
    "w-[80%]",
    "w-[81%]",
    "w-[82%]",
    "w-[83%]",
    "w-[84%]",
    "w-[85%]",
    "w-[86%]",
    "w-[87%]",
    "w-[88%]",
    "w-[89%]",
    "w-[90%]",
    "w-[91%]",
    "w-[92%]",
    "w-[93%]",
    "w-[94%]",
    "w-[95%]",
    "w-[96%]",
    "w-[97%]",
    "w-[98%]",
    "w-[99%]",
    "w-[100%]",
]

function getWidthClass(pct: number): string {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)))
    return WIDTH_CLASSES[clamped] || "w-[0%]"
}

export const DataQualityCard: React.FC<DataQualityCardProps> = ({
    completeness,
    statesTags,
    creator,
    lastModified,
}) => {
    const percent =
        completeness !== null && completeness !== undefined
            ? Math.round(completeness * 100)
            : null

    const completedStates = statesTags
        .filter((t) => t.includes("completed"))
        .map((t) =>
            t
                .replace(/^[a-z]{2}:/, "")
                .replace(/-completed$/, "")
                .replace(/-/g, " "),
        )

    const toCheckStates = statesTags
        .filter((t) => t.includes("to-be-completed"))
        .map((t) =>
            t
                .replace(/^[a-z]{2}:/, "")
                .replace(/-to-be-completed$/, "")
                .replace(/-/g, " "),
        )

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="p-4 pb-2 sm:p-5">
                <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-neutral-500" />
                    <CardTitle className="text-sm font-semibold text-neutral-900">
                        Data Quality & Community Audit
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 pt-2 text-xs sm:p-5">
                {/* Completeness Bar */}
                {percent !== null && (
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-neutral-700">
                                Database Field Completeness
                            </span>
                            <span className="font-mono font-bold text-neutral-900">
                                {percent}%
                            </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-100">
                            <div
                                className={cn(
                                    "h-full rounded-full bg-emerald-600 transition-all duration-500",
                                    getWidthClass(percent),
                                )}
                            />
                        </div>
                    </div>
                )}

                {/* Audit Checklist */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {completedStates.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="flex items-center gap-1 font-semibold text-neutral-700">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                Completed Fields ({completedStates.length})
                            </span>
                            <div className="flex flex-wrap gap-1">
                                {completedStates.map((s, idx) => (
                                    <span
                                        key={idx}
                                        className="rounded-md border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 capitalize"
                                    >
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {toCheckStates.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="flex items-center gap-1 font-semibold text-neutral-700">
                                <Clock className="h-3.5 w-3.5 text-amber-500" />
                                Pending Review ({toCheckStates.length})
                            </span>
                            <div className="flex flex-wrap gap-1">
                                {toCheckStates.map((s, idx) => (
                                    <span
                                        key={idx}
                                        className="rounded-md border border-neutral-200 bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 capitalize"
                                    >
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Contributor metadata */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-2 text-[11px] text-neutral-400">
                    {creator && (
                        <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Original contributor: {creator}
                        </span>
                    )}
                    {lastModified && (
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Last updated: {lastModified}
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
