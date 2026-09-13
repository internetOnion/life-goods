import { PackageOpen, Recycle, Scale } from "lucide-react"
import React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollContainer } from "@/components/ui/scroll-container"
import type { PackagingComponent } from "@/features/product/types"

interface PackagingsTableCardProps {
    packagings: PackagingComponent[]
    packagingText?: string | null
}

export const PackagingsTableCard: React.FC<PackagingsTableCardProps> = ({
    packagings,
    packagingText,
}) => {
    const isGenericUnknown =
        packagingText?.toLowerCase().trim() === "unknown packaging" ||
        packagingText?.toLowerCase().trim() === "unknown"
    const showPackagingText =
        packagingText && (!isGenericUnknown || packagings.length === 0)

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-5">
                <div className="flex items-center gap-2">
                    <PackageOpen className="h-4 w-4 text-neutral-500" />
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        Packaging Components & Materials
                    </CardTitle>
                </div>

                {packagings.length > 0 && (
                    <Badge
                        variant="subtle"
                        className="font-mono text-xs font-semibold tabular-nums"
                    >
                        {packagings.length}{" "}
                        {packagings.length === 1 ? "Part" : "Parts"}
                    </Badge>
                )}
            </CardHeader>

            <CardContent className="space-y-3 p-4 pt-2 sm:p-5">
                {showPackagingText && (
                    <div className="rounded-xl border border-neutral-200/60 bg-neutral-50 p-3">
                        <p className="text-xs leading-relaxed font-medium text-neutral-800 italic sm:text-sm">
                            {packagingText}
                        </p>
                    </div>
                )}

                {packagings.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-neutral-50/50">
                        <ScrollContainer
                            fadeColor="neutral"
                            label="Packaging components and materials table"
                        >
                            <table className="w-full min-w-[500px] border-collapse text-left text-xs">
                                <thead>
                                    <tr className="border-b border-neutral-200 bg-neutral-100/70 text-xs font-bold text-neutral-900">
                                        <th className="min-w-[110px] px-3 py-2.5 text-left whitespace-nowrap">
                                            Component
                                        </th>
                                        <th className="min-w-[120px] px-3 py-2.5 text-left whitespace-nowrap">
                                            Material
                                        </th>
                                        <th className="min-w-[100px] px-3 py-2.5 text-left whitespace-nowrap">
                                            Weight
                                        </th>
                                        <th className="min-w-[170px] px-3 py-2.5 text-left whitespace-nowrap">
                                            Disposal / Recycling
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200/60 bg-white">
                                    {packagings.map((pkg, idx) => {
                                        const shape = pkg.shape || "Part"
                                        const material =
                                            pkg.material || "Unspecified"
                                        const recyclingLower =
                                            pkg.recycling?.toLowerCase() || ""
                                        const isRecycle =
                                            recyclingLower.includes(
                                                "recycle",
                                            ) &&
                                            !recyclingLower.includes("don't") &&
                                            !recyclingLower.includes("not") &&
                                            !recyclingLower.includes("non")

                                        return (
                                            <tr
                                                key={idx}
                                                className="transition-colors hover:bg-neutral-50/70"
                                            >
                                                <td className="px-3 py-2.5 align-middle text-xs font-semibold text-neutral-900 capitalize sm:text-sm">
                                                    {shape}
                                                </td>
                                                <td className="px-3 py-2.5 align-middle text-xs font-medium whitespace-nowrap text-neutral-700 capitalize">
                                                    {material}
                                                </td>
                                                <td className="px-3 py-2.5 text-left align-middle font-mono text-xs font-semibold whitespace-nowrap text-neutral-800 tabular-nums">
                                                    {pkg.weightMeasured !==
                                                        null &&
                                                    pkg.weightMeasured !==
                                                        undefined ? (
                                                        <span className="inline-flex items-center justify-start gap-1 whitespace-nowrap tabular-nums">
                                                            <Scale className="h-3 w-3 shrink-0 text-neutral-400" />
                                                            <span>
                                                                {
                                                                    pkg.weightMeasured
                                                                }
                                                                &nbsp;g
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className="font-mono text-xs whitespace-nowrap text-neutral-400">
                                                            Source Data
                                                            Unavailable
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2.5 align-middle">
                                                    {pkg.recycling ? (
                                                        <Badge
                                                            variant={
                                                                isRecycle
                                                                    ? "success"
                                                                    : "secondary"
                                                            }
                                                            className="inline-flex max-w-full items-center gap-1.5 rounded-xl px-2.5 py-1 text-left text-xs leading-normal font-medium"
                                                        >
                                                            <Recycle
                                                                className={`h-3 w-3 shrink-0 ${
                                                                    isRecycle
                                                                        ? "text-success-600"
                                                                        : "text-neutral-500"
                                                                }`}
                                                            />
                                                            <span className="capitalize">
                                                                {pkg.recycling}
                                                            </span>
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-micro text-neutral-400">
                                                            Source Data
                                                            Unavailable
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </ScrollContainer>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <p className="text-xs font-semibold text-neutral-700">
                            Source Data Unavailable
                        </p>
                        <p className="text-caption text-neutral-500">
                            No itemized packaging parts declared in the dataset
                            snapshot record.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
