import { PackageOpen, Recycle, Scale } from "lucide-react"
import React from "react"

import type { TranslatableTextItem } from "@/api/generated"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollContainer } from "@/components/ui/scroll-container"
import type { PackagingComponent } from "@/features/product/types"

import { TranslatedField } from "../TranslatedField"
import { translateTaxonomyValue, useProductTranslation } from "../translations"

interface PackagingsTableCardProps {
    packagings: PackagingComponent[]
    packagingText?: string | null
    descriptionItems?: TranslatableTextItem[]
    recyclingInstructionItems?: TranslatableTextItem[]
    storageInstructionItems?: TranslatableTextItem[]
}

function isListLikePackagingDescription(value: string): boolean {
    const parts = value
        .split(/[;,]/u)
        .map((part) => part.trim())
        .filter(Boolean)

    if (parts.length < 2) return false

    const listLikeParts = parts.filter((part) => {
        const wordCount = part.split(/\s+/u).length
        return (
            wordCount <= 4 ||
            /^[a-z]{2,3}:/iu.test(part) ||
            /\b[A-Z]{1,6}\s?\d+\b/u.test(part)
        )
    })

    const hasMachineMarker = parts.some(
        (part) =>
            /^[a-z]{2,3}:/iu.test(part) || /\b[A-Z]{1,6}\s?\d+\b/u.test(part),
    )

    return (
        (parts.length >= 3 && listLikeParts.length / parts.length >= 0.75) ||
        (hasMachineMarker && listLikeParts.length / parts.length >= 0.5)
    )
}

function isRedundantDescription(
    item: TranslatableTextItem,
    packagings: PackagingComponent[],
): boolean {
    const originalText = item.selected_original_text?.value?.trim()
    return Boolean(
        packagings.length > 0 &&
        originalText &&
        isListLikePackagingDescription(originalText),
    )
}

export const PackagingsTableCard: React.FC<PackagingsTableCardProps> = ({
    packagings,
    packagingText,
    descriptionItems = [],
    recyclingInstructionItems = [],
    storageInstructionItems = [],
}) => {
    const { locale, t } = useProductTranslation()
    const visibleDescriptionItems = descriptionItems.filter(
        (item) => !isRedundantDescription(item, packagings),
    )
    const isGenericUnknown =
        packagingText?.toLowerCase().trim() === "unknown packaging" ||
        packagingText?.toLowerCase().trim() === "unknown"
    const showPackagingText =
        packagingText &&
        descriptionItems.length === 0 &&
        !(
            packagings.length > 0 &&
            isListLikePackagingDescription(packagingText)
        ) &&
        (!isGenericUnknown ||
            (packagings.length === 0 && descriptionItems.length === 0))

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-5">
                <div className="flex items-center gap-2">
                    <PackageOpen className="h-4 w-4 text-neutral-500" />
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        {t("packagingComponents")}
                    </CardTitle>
                </div>

                {packagings.length > 0 && (
                    <Badge
                        variant="subtle"
                        className="font-mono text-xs font-semibold tabular-nums"
                    >
                        {packagings.length}{" "}
                        {packagings.length === 1 ? t("part") : t("parts")}
                    </Badge>
                )}
            </CardHeader>

            <CardContent className="space-y-3 p-4 pt-2 sm:p-5">
                {visibleDescriptionItems.length > 0 && (
                    <div className="space-y-3 rounded-xl border border-neutral-200/60 bg-neutral-50 p-3">
                        <p className="text-caption font-bold tracking-[0.06em] text-neutral-500 uppercase">
                            {t("packagingDescription")}
                        </p>
                        <div className="space-y-3">
                            {visibleDescriptionItems.map((item) => (
                                <TranslatedField
                                    key={item.key}
                                    field={item}
                                    textClassName="text-sm leading-relaxed font-medium text-neutral-800 italic"
                                />
                            ))}
                        </div>
                    </div>
                )}

                {recyclingInstructionItems.length > 0 && (
                    <div className="border-info-200/70 bg-info-50/60 space-y-3 rounded-xl border p-3">
                        <p className="text-caption text-info-800 font-bold tracking-[0.06em] uppercase">
                            {t("recyclingInstructions")}
                        </p>
                        <div className="space-y-3">
                            {recyclingInstructionItems.map((item) => (
                                <TranslatedField
                                    key={item.key}
                                    field={item}
                                    textClassName="text-sm leading-relaxed text-neutral-800"
                                />
                            ))}
                        </div>
                    </div>
                )}

                {storageInstructionItems.length > 0 && (
                    <div className="space-y-3 rounded-xl border border-neutral-200/60 bg-neutral-50 p-3">
                        <p className="text-caption font-bold tracking-[0.06em] text-neutral-500 uppercase">
                            {t("storageInstructions")}
                        </p>
                        <div className="space-y-3">
                            {storageInstructionItems.map((item) => (
                                <TranslatedField
                                    key={item.key}
                                    field={item}
                                    textClassName="text-sm leading-relaxed text-neutral-800"
                                />
                            ))}
                        </div>
                    </div>
                )}

                {showPackagingText && (
                    <div className="rounded-xl border border-neutral-200/60 bg-neutral-50 p-3">
                        <p className="text-xs leading-relaxed font-medium text-neutral-800 italic sm:text-sm">
                            {translateTaxonomyValue(locale, packagingText)}
                        </p>
                    </div>
                )}

                {packagings.length > 0 ? (
                    <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-neutral-50/50">
                        <ScrollContainer
                            fadeColor="neutral"
                            label={t("packagingComponentsTable")}
                        >
                            <table className="w-full min-w-[500px] border-collapse text-left text-xs">
                                <thead>
                                    <tr className="border-b border-neutral-200 bg-neutral-100/70 text-xs font-bold text-neutral-900">
                                        <th className="min-w-[110px] px-3 py-2.5 text-left whitespace-nowrap">
                                            {t("component")}
                                        </th>
                                        <th className="min-w-[120px] px-3 py-2.5 text-left whitespace-nowrap">
                                            {t("material")}
                                        </th>
                                        <th className="min-w-[100px] px-3 py-2.5 text-left whitespace-nowrap">
                                            {t("weight")}
                                        </th>
                                        <th className="min-w-[170px] px-3 py-2.5 text-left whitespace-nowrap">
                                            {t("disposalRecycling")}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200/60 bg-white">
                                    {packagings.map((pkg, idx) => {
                                        const shape = pkg.shape
                                            ? translateTaxonomyValue(
                                                  locale,
                                                  pkg.shape,
                                              )
                                            : t("part")
                                        const material = pkg.material
                                            ? translateTaxonomyValue(
                                                  locale,
                                                  pkg.material,
                                              )
                                            : t("unspecified")
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
                                                className="table-row-hover"
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
                                                            <Scale className="h-3 w-3 shrink-0 text-neutral-500" />
                                                            <span>
                                                                {
                                                                    pkg.weightMeasured
                                                                }
                                                                &nbsp;g
                                                            </span>
                                                        </span>
                                                    ) : (
                                                        <span className="font-mono text-xs whitespace-nowrap text-neutral-600">
                                                            {t(
                                                                "sourceDataUnavailable",
                                                            )}
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
                                                                {translateTaxonomyValue(
                                                                    locale,
                                                                    pkg.recycling,
                                                                )}
                                                            </span>
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-micro text-neutral-600">
                                                            {t(
                                                                "sourceDataUnavailable",
                                                            )}
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
                            {t("sourceDataUnavailable")}
                        </p>
                        <p className="text-caption text-neutral-500">
                            {t("sourceDataUnavailablePackaging")}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
