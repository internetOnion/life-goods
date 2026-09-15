import { ChevronDown, FlaskConical } from "lucide-react"
import React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { PackageMatchEvidenceResponse } from "@/features/product/types"

interface AdditivesCardProps {
    labelEvidence?: PackageMatchEvidenceResponse[]
}

interface AdditiveReference {
    name?: string
    description?: string
    functions?: string[]
}

// English additive reference details from the bundled Open Food Facts taxonomy.
// These describe the additive itself, not its amount or purpose in this Product.
const ADDITIVE_REFERENCES: Record<string, AdditiveReference> = {
    e322: {
        name: "Lecithins",
        description:
            "Lecithins are a generic term for yellow-brownish fatty substances occurring in animal and plant tissues. They are used for smoothing food textures, dissolving powders, emulsifying and homogenizing liquid mixtures, and repelling sticking materials. Lecithin refers to a group of compounds found in every living organism and is commercially isolated mainly from soybeans or egg yolk.",
        functions: ["Antioxidant", "Emulsifier"],
    },
    e322i: {
        name: "Lecithin",
        functions: ["Antioxidant", "Emulsifier"],
    },
    e500: {
        name: "Sodium carbonates",
        description:
            "Sodium carbonates are the generic term for a Na and CO3 combination.",
        functions: ["Stabiliser", "Thickener"],
    },
    e500ii: {
        name: "Sodium hydrogen carbonate (Baking soda)",
        description:
            "Sodium bicarbonate (sodium hydrogen carbonate), commonly known as baking soda, is a chemical compound with the formula NaHCO3.",
        functions: ["Stabiliser", "Thickener"],
    },
    e503: { name: "Ammonium carbonates" },
    e503ii: {
        name: "Ammonium hydrogen carbonate",
        description:
            "Ammonium bicarbonate is an inorganic compound with the formula NH4HCO3. It is used in the food industry as a raising agent for flat baked goods such as cookies and crackers, and in China in steamed buns and Chinese almond cookies. It was commonly used at home before modern baking powder became available.",
    },
    e471: {
        name: "Mono- and diglycerides of fatty acids",
        description:
            "Mono- and diglycerides of fatty acids (E471) are a food additive composed of diglycerides and monoglycerides, used as an emulsifier.",
        functions: ["Emulsifier", "Stabiliser"],
    },
    e472e: {
        name: "Mono- and diacetyl tartaric acid esters of mono- and diglycerides of fatty acids",
        functions: ["Emulsifier", "Sequestrant", "Stabiliser"],
    },
    e330: {
        name: "Citric acid",
        functions: ["Antioxidant", "Sequestrant"],
    },
    e415: {
        name: "Xanthan gum",
        description:
            "Xanthan gum is a polysaccharide with many industrial uses, including as a common food additive.",
        functions: ["Emulsifier", "Stabiliser", "Thickener"],
    },
    e412: {
        name: "Guar gum",
        functions: ["Emulsifier", "Stabiliser", "Thickener"],
    },
    e407: {
        name: "Carrageenan",
        functions: [
            "Carrier",
            "Emulsifier",
            "Humectant",
            "Stabiliser",
            "Thickener",
        ],
    },
    e440: { name: "Pectins" },
    e150a: {
        name: "Plain caramel",
        description:
            "Caramel color or caramel coloring is a water-soluble food coloring.",
        functions: ["Colour"],
    },
    e150d: { name: "Sulphite ammonia caramel", functions: ["Colour"] },
    e160a: { name: "Carotenes", functions: ["Colour"] },
    e100: { name: "Curcumin", functions: ["Colour"] },
    e101: { name: "Riboflavin", functions: ["Colour"] },
    e202: {
        name: "Potassium sorbate",
        description:
            "Potassium sorbate is the potassium salt of sorbic acid, with the chemical formula CH3CH=CH−CH=CH−CO2K.",
        functions: ["Preservative"],
    },
    e211: {
        name: "Sodium benzoate",
        description:
            "Sodium benzoate is a substance with the chemical formula NaC7H5O2.",
        functions: ["Preservative"],
    },
    e282: {
        name: "Calcium propionate",
        description:
            "Calcium propionate has the formula Ca-C2H5COO-2. It is used as a preservative in a wide variety of products, including bread, other baked goods, processed meat, whey, and other dairy products.",
        functions: ["Preservative"],
    },
    e300: {
        name: "Ascorbic acid (Vitamin C)",
        functions: ["Antioxidant", "Sequestrant"],
    },
    e306: { name: "Tocopherol-rich extract (Vitamin E)" },
    e450: {
        name: "Diphosphates",
        functions: [
            "Emulsifier",
            "Humectant",
            "Sequestrant",
            "Stabiliser",
            "Thickener",
        ],
    },
    e452: {
        name: "Polyphosphates",
        functions: [
            "Emulsifier",
            "Humectant",
            "Sequestrant",
            "Stabiliser",
            "Thickener",
        ],
    },
    e621: {
        name: "Monosodium glutamate (MSG)",
        description:
            "Monosodium glutamate (MSG), also known as sodium glutamate, is the sodium salt of glutamic acid, one of the most abundant naturally occurring non-essential amino acids.",
        functions: ["Flavour enhancer"],
    },
}

function cleanAdditiveTag(tag: string): string {
    return tag.replace(/^[a-z]{2,3}:/i, "").toLowerCase()
}

export const AdditivesCard: React.FC<AdditivesCardProps> = ({
    labelEvidence,
}) => {
    const rawTags = [
        ...new Set(
            (labelEvidence ?? []).flatMap((item) => {
                if (item.field !== "additive_tags") return []
                return Array.isArray(item.value)
                    ? item.value.filter(
                          (value): value is string => typeof value === "string",
                      )
                    : typeof item.value === "string"
                      ? [item.value]
                      : []
            }),
        ),
    ]

    if (rawTags.length === 0) return null

    const formattedAdditives = rawTags.map((tag) => {
        const cleanTag = cleanAdditiveTag(tag)
        const reference = ADDITIVE_REFERENCES[cleanTag]
        return {
            tag: cleanTag,
            code: cleanTag.toUpperCase(),
            reference,
            hasDetails: Boolean(
                reference?.description || reference?.functions?.length,
            ),
        }
    })

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-5 sm:pb-2">
                <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-neutral-500" />
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        Food Additives & E-Numbers
                    </CardTitle>
                </div>
                <Badge
                    variant="subtle"
                    className="py-0.2 text-caption px-2 font-mono font-semibold tabular-nums"
                >
                    {formattedAdditives.length} Listed
                </Badge>
            </CardHeader>

            <CardContent className="space-y-2 p-4 pt-0 sm:p-5 sm:pt-0">
                <div className="space-y-1">
                    {formattedAdditives.map((add) => (
                        <details
                            key={add.tag}
                            data-disclosure
                            className="group"
                        >
                            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
                                <span className="flex min-w-0 items-center gap-2.5">
                                    <span className="shrink-0 rounded bg-neutral-200/80 px-1.5 py-0.5 font-mono text-xs font-bold text-neutral-900 tabular-nums">
                                        {add.code}
                                    </span>
                                    <span className="min-w-0 truncate text-sm font-semibold text-neutral-900">
                                        {add.reference?.name ||
                                            "Source Data Unavailable"}
                                    </span>
                                </span>
                                <ChevronDown
                                    className="disclosure-icon size-4 shrink-0 text-neutral-500"
                                    aria-hidden="true"
                                />
                            </summary>
                            <div className="space-y-3 px-2 pt-1 pb-3">
                                {add.reference?.description ? (
                                    <p className="text-sm leading-relaxed wrap-anywhere text-neutral-700">
                                        {add.reference.description}
                                    </p>
                                ) : null}
                                {add.reference?.functions?.length ? (
                                    <div className="space-y-1.5">
                                        <p className="text-xs font-bold tracking-wide text-neutral-500 uppercase">
                                            Functions
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {add.reference.functions.map(
                                                (functionName) => (
                                                    <Badge
                                                        key={functionName}
                                                        variant="subtle"
                                                    >
                                                        {functionName}
                                                    </Badge>
                                                ),
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                                {!add.hasDetails ? (
                                    <p className="text-sm leading-relaxed wrap-anywhere text-neutral-700">
                                        Source Data Unavailable
                                    </p>
                                ) : null}
                            </div>
                        </details>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
