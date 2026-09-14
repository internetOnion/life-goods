import {
    BookmarkCheck,
    ExternalLink,
    Headphones,
    Store,
    Tag,
} from "lucide-react"
import React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { OpenFoodFactsProductView } from "@/features/product/types"

interface ProductCharacteristicsCardProps {
    product: OpenFoodFactsProductView
}

export const ProductCharacteristicsCard: React.FC<
    ProductCharacteristicsCardProps
> = ({ product }) => {
    const hasContent = Boolean(
        product.genericName ||
        product.categories.length > 0 ||
        product.stores.length > 0 ||
        product.embCodes.length > 0 ||
        product.customerService ||
        product.link,
    )

    if (!hasContent) return null

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="p-4 pb-2 sm:p-5">
                <div className="flex items-center gap-2.5">
                    <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
                        <Tag className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        Product Characteristics & Classification
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4 pt-2 text-xs sm:p-5">
                {/* Generic Name / Description */}
                {product.genericName && (
                    <div className="rounded-2xl border border-neutral-200/60 bg-neutral-50 p-3">
                        <p className="text-xs leading-relaxed font-medium text-neutral-800 italic sm:text-sm">
                            {product.genericName}
                        </p>
                    </div>
                )}

                {/* Categories */}
                {product.categories.length > 0 && (
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 sm:text-sm">
                            <BookmarkCheck className="h-3.5 w-3.5 text-neutral-500" />
                            <span>
                                Categories ({product.categories.length})
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {product.categories.map((cat, idx) => (
                                <Badge
                                    key={idx}
                                    variant="secondary"
                                    className="text-xs font-semibold capitalize"
                                >
                                    {cat}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Stores / Retailers */}
                {product.stores.length > 0 && (
                    <div className="space-y-1.5 border-t border-neutral-100 pt-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 sm:text-sm">
                            <Store className="h-3.5 w-3.5 text-neutral-500" />
                            <span>Stores / Retailers</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {product.stores.map((s, idx) => (
                                <Badge
                                    key={idx}
                                    variant="pill"
                                    className="text-xs font-medium"
                                >
                                    {s}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* EMB / Traceability Codes */}
                {product.embCodes.length > 0 && (
                    <div className="space-y-1 border-t border-neutral-100 pt-1">
                        <span className="text-caption block font-bold tracking-[0.06em] text-neutral-500 uppercase">
                            Traceability / EMB Codes:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                            {product.embCodes.map((code, idx) => (
                                <Badge
                                    key={idx}
                                    variant="subtle"
                                    className="font-mono text-xs font-semibold tracking-[0.02em] tabular-nums"
                                >
                                    {code}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Customer Service & Website Link */}
                {(product.customerService || product.link) && (
                    <div className="flex flex-col justify-between gap-2 border-t border-neutral-100 pt-2 text-xs font-medium text-neutral-600 sm:flex-row sm:items-center">
                        {product.customerService && (
                            <div className="flex items-center gap-1.5">
                                <Headphones className="h-3.5 w-3.5 text-neutral-500" />
                                <span>Service: {product.customerService}</span>
                            </div>
                        )}
                        {product.link && (
                            <a
                                href={product.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-info-700 hover:text-info-800 inline-flex items-center gap-1 underline underline-offset-2"
                            >
                                <span>Product Website</span>
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
