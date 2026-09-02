import { PackageOpen, Recycle, Scale } from "lucide-react"
import React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
                    <CardTitle className="text-sm font-semibold text-neutral-900">
                        Packaging Components & Materials
                    </CardTitle>
                </div>

                {packagings.length > 0 && (
                    <Badge variant="subtle" className="font-mono text-[10px]">
                        {packagings.length}{" "}
                        {packagings.length === 1 ? "Part" : "Parts"}
                    </Badge>
                )}
            </CardHeader>

            <CardContent className="space-y-3 p-4 pt-2 sm:p-5">
                {showPackagingText && (
                    <div className="rounded-xl border border-neutral-200/60 bg-neutral-50 p-3 text-xs">
                        <span className="block text-[10px] font-semibold tracking-wider text-neutral-400 uppercase">
                            Package Declaration
                        </span>
                        <p className="mt-0.5 font-medium text-neutral-800">
                            {packagingText}
                        </p>
                    </div>
                )}

                {packagings.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-neutral-50/50">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-left text-xs">
                                <thead>
                                    <tr className="border-b border-neutral-200 bg-neutral-100/70 font-semibold text-neutral-700">
                                        <th className="min-w-[110px] px-3 py-2.5">
                                            Component
                                        </th>
                                        <th className="min-w-[100px] px-3 py-2.5">
                                            Material
                                        </th>
                                        <th className="min-w-[80px] px-3 py-2.5 text-right">
                                            Weight
                                        </th>
                                        <th className="min-w-[180px] px-3 py-2.5">
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
                                                <td className="px-3 py-2.5 align-middle font-semibold text-neutral-900 capitalize">
                                                    {shape}
                                                </td>
                                                <td className="px-3 py-2.5 align-middle text-neutral-700 capitalize">
                                                    {material}
                                                </td>
                                                <td className="px-3 py-2.5 text-right align-middle font-mono text-[11px] text-neutral-600">
                                                    {pkg.weightMeasured !==
                                                        null &&
                                                    pkg.weightMeasured !==
                                                        undefined ? (
                                                        <span className="inline-flex items-center justify-end gap-1 tabular-nums">
                                                            <Scale className="h-3 w-3 text-neutral-400" />
                                                            {pkg.weightMeasured}{" "}
                                                            g
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-neutral-400">
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
                                                        <span className="text-[10px] text-neutral-400">
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
                        </div>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <p className="text-xs font-semibold text-neutral-700">
                            Source Data Unavailable
                        </p>
                        <p className="text-[11px] text-neutral-500">
                            No itemized packaging parts declared in the dataset
                            snapshot record.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
