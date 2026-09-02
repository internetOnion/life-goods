import { FlaskConical } from "lucide-react"
import React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PackageMatchEvidenceResponse } from "@/features/product/types"

interface AdditivesCardProps {
    labelEvidence?: PackageMatchEvidenceResponse[]
}

const KNOWN_ADDITIVES: Record<string, string> = {
    e322: "Lecithins",
    e322i: "Lecithin",
    e500: "Sodium carbonates",
    e500ii: "Sodium hydrogen carbonate (Baking soda)",
    e503: "Ammonium carbonates",
    e503ii: "Ammonium hydrogen carbonate",
    e471: "Mono- and diglycerides of fatty acids",
    e472e: "Mono- and diacetyl tartaric acid esters of mono- and diglycerides of fatty acids",
    e330: "Citric acid",
    e415: "Xanthan gum",
    e412: "Guar gum",
    e407: "Carrageenan",
    e440: "Pectins",
    e150a: "Plain caramel",
    e150d: "Sulphite ammonia caramel",
    e160a: "Carotenes",
    e100: "Curcumin",
    e101: "Riboflavin",
    e202: "Potassium sorbate",
    e211: "Sodium benzoate",
    e300: "Ascorbic acid (Vitamin C)",
    e306: "Tocopherol-rich extract (Vitamin E)",
    e450: "Diphosphates",
    e452: "Polyphosphates",
    e621: "Monosodium glutamate (MSG)",
}

export const AdditivesCard: React.FC<AdditivesCardProps> = ({
    labelEvidence,
}) => {
    const additivesItem = labelEvidence?.find(
        (e) => e.field === "additive_tags",
    )
    const rawTags = Array.isArray(additivesItem?.value)
        ? (additivesItem.value as string[])
        : []

    if (rawTags.length === 0) return null

    const formattedAdditives = rawTags.map((tag) => {
        const cleanTag = tag.replace(/^[a-z]{2}:/, "").toLowerCase()
        const codeUpper = cleanTag.toUpperCase()
        const commonName = KNOWN_ADDITIVES[cleanTag]
        return {
            code: codeUpper,
            name: commonName || null,
        }
    })

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-5">
                <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-neutral-500" />
                    <CardTitle className="text-sm font-semibold text-neutral-900">
                        Food Additives & E-Numbers
                    </CardTitle>
                </div>
                <Badge variant="subtle" className="font-mono text-[10px]">
                    {formattedAdditives.length} Listed
                </Badge>
            </CardHeader>

            <CardContent className="space-y-3 p-4 pt-2 sm:p-5">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {formattedAdditives.map((add, idx) => (
                        <div
                            key={idx}
                            className="flex items-center gap-2.5 rounded-xl border border-neutral-200/70 bg-neutral-50 p-2.5"
                        >
                            <Badge
                                variant="pill"
                                className="bg-neutral-200/80 font-bold text-neutral-800"
                            >
                                {add.code}
                            </Badge>
                            <span className="min-w-0 truncate text-xs font-medium text-neutral-700">
                                {add.name || "Food Additive"}
                            </span>
                        </div>
                    ))}
                </div>
                <p className="border-t border-neutral-100 pt-1 text-[11px] text-neutral-400">
                    Source: Regulated food additives declared on the package
                    ingredient list.
                </p>
            </CardContent>
        </Card>
    )
}
