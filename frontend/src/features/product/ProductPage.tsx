import { useQuery } from "@tanstack/react-query"
import { AlertCircle, ArrowLeft } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router"

import { appRoutes } from "@/app/routes"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Container } from "@/components/layout/Container"
import { Header } from "@/components/layout/Header"
import { saveScanItem } from "@/lib/history"
import { validateIdentifier } from "@/lib/identifier"
import { usePageMetadata } from "@/lib/metadata"
import { useAppTranslation } from "@/i18n/translations"
import { useLocale } from "@/i18n/locale"

import { lookupProduct, type ProductLookup } from "./api"
import { adaptProductLookup } from "./adapter"
import { getProductRestoreLocationState } from "./navigation"
import { AdditivesCard } from "./cards/AdditivesCard"
import { AllergenCard } from "./cards/AllergenCard"
import { IngredientSummaryCard } from "./cards/IngredientSummaryCard"
import { IngredientsAnalysisCard } from "./cards/IngredientsAnalysisCard"
import { IngredientsCard } from "./cards/IngredientsCard"
import { NotFoundCard } from "./cards/NotFoundCard"
import { NutritionCard } from "./cards/NutritionCard"
import { PackagingsTableCard } from "./cards/PackagingsTableCard"
import { ProductHero } from "./cards/ProductHero"
import { ProvenanceCard } from "./cards/ProvenanceCard"
import { SymbolsCard } from "./cards/SymbolsCard"
import { NutrientLevelsCard } from "./cards/scores/NutrientLevelsCard"
import { SourceAssessmentsCard } from "./cards/scores/SourceAssessmentsCard"
import {
    allConcernIds,
    findConcernMatches,
    findSelectedConcernMatches,
    useSelectedConcernStorage,
} from "@/features/concerns/matching"
import { getIngredientSummaryData, hasNutrientLevelData } from "./summaryData"
import { getTranslatedFieldText } from "./translation-utils"
import { translateProductError, useProductTranslation } from "./translations"

type ProductPageProps = {
    lookup?: ProductLookup
}

type ProductTab = "summary" | "ingredients" | "nutrition" | "labels"

const DEFAULT_PRODUCT_TAB: ProductTab = "summary"

function isProductTab(value: string): value is ProductTab {
    return ["summary", "ingredients", "nutrition", "labels"].includes(value)
}

export function ProductPage({ lookup = lookupProduct }: ProductPageProps) {
    const { barcode = "" } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const { t: tApp } = useAppTranslation()
    const { locale } = useLocale()
    const { t } = useProductTranslation()

    const validation = useMemo(() => validateIdentifier(barcode), [barcode])
    const normalizedBarcode = validation.valid ? validation.value : ""
    const restoreScrollY = getProductRestoreLocationState(
        location.state,
    )?.restoreScrollY

    const [activeTab, setActiveTab] = useState<ProductTab>(DEFAULT_PRODUCT_TAB)
    const concernStorage = useSelectedConcernStorage()
    const selectedConcernIds = concernStorage.ids

    const tabScrollRef = useRef<HTMLDivElement>(null)
    const activePanelRef = useRef<HTMLDivElement>(null)
    const shouldScrollToTabRef = useRef(false)

    const handleTabChange = (value: string) => {
        if (!isProductTab(value) || value === activeTab) return
        shouldScrollToTabRef.current = true
        setActiveTab(value)
    }

    useEffect(() => {
        if (!validation.valid && barcode) {
            void navigate(`/search?q=${encodeURIComponent(barcode)}`, {
                replace: true,
            })
        }
    }, [barcode, navigate, validation])

    const productQuery = useQuery({
        queryKey: ["product", normalizedBarcode, locale],
        queryFn: async () => {
            if (locale === "en") return lookup(normalizedBarcode)

            try {
                return await lookup(normalizedBarcode, locale)
            } catch (translationError) {
                try {
                    // A failed Khmer request should not make an otherwise
                    // readable Product unavailable. Retry without translation
                    // so the response can render its retained Original Text.
                    return await lookup(normalizedBarcode)
                } catch {
                    // Preserve the original error when the unlocalized retry
                    // also fails, so normal not-found/service states survive.
                    throw translationError
                }
            }
        },
        enabled: Boolean(normalizedBarcode),
        retry: false,
    })

    const adapted = useMemo(() => {
        if (!productQuery.data) return null
        return adaptProductLookup(productQuery.data)
    }, [productQuery.data])

    const candidate = adapted?.candidate
    const offView = adapted?.offView
    const labelEvidence = useMemo(
        () => candidate?.label_evidence || [],
        [candidate?.label_evidence],
    )
    const selectedConcernMatches = useMemo(
        () =>
            findSelectedConcernMatches(
                selectedConcernIds,
                candidate?.allergen_analysis,
                labelEvidence,
            ),
        [candidate?.allergen_analysis, labelEvidence, selectedConcernIds],
    )
    const allConcernMatches = useMemo(
        () =>
            findConcernMatches(
                allConcernIds(),
                candidate?.allergen_analysis,
                labelEvidence,
            ),
        [candidate?.allergen_analysis, labelEvidence],
    )
    const hasNutriScore = Boolean(
        offView?.nutriscoreGrade && offView.nutriscoreGrade !== "unknown",
    )
    const hasNovaGroup = Boolean(offView?.novaGroup)
    const hasEcoScore = Boolean(
        offView?.ecoscoreGrade && offView.ecoscoreGrade !== "unknown",
    )
    const hasSourceAssessments = hasNutriScore || hasNovaGroup || hasEcoScore
    const ingredientSummaryData = getIngredientSummaryData(
        locale,
        allConcernMatches,
        labelEvidence,
    )
    const hasSummaryData = Boolean(
        hasSourceAssessments ||
        (offView && hasNutrientLevelData(offView.nutrientLevels)) ||
        ingredientSummaryData.matchedIngredients.length > 0 ||
        ingredientSummaryData.additiveTags.length > 0,
    )

    useEffect(() => {
        if (!normalizedBarcode) return
        if (restoreScrollY !== undefined) {
            if (!productQuery.data) return
            window.scrollTo(0, restoreScrollY)
            return
        }
        window.scrollTo(0, 0)
    }, [normalizedBarcode, productQuery.data, restoreScrollY])

    useEffect(() => {
        shouldScrollToTabRef.current = false
        setActiveTab(DEFAULT_PRODUCT_TAB)
        const container = tabScrollRef.current
        if (typeof container?.scrollTo === "function") {
            container.scrollTo({ left: 0, behavior: "auto" })
        } else if (container) {
            container.scrollLeft = 0
        }
    }, [normalizedBarcode])

    useEffect(() => {
        const container = tabScrollRef.current
        if (!container) return
        const activeEl = container.querySelector<HTMLElement>(
            '[data-state="active"]',
        )
        if (activeEl) {
            const scrollTarget =
                activeEl.offsetLeft -
                (container.clientWidth - activeEl.clientWidth) / 2
            if (typeof container.scrollTo === "function") {
                container.scrollTo({
                    left: Math.max(0, scrollTarget),
                    behavior: "smooth",
                })
            } else {
                container.scrollLeft = Math.max(0, scrollTarget)
            }
        }

        if (
            shouldScrollToTabRef.current &&
            typeof activePanelRef.current?.scrollIntoView === "function"
        ) {
            shouldScrollToTabRef.current = false
            activePanelRef.current.scrollIntoView({
                behavior: "smooth",
                block: "start",
            })
        } else if (shouldScrollToTabRef.current) {
            shouldScrollToTabRef.current = false
        }
    }, [activeTab])

    const headingRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        if (productQuery.data) {
            headingRef.current?.focus({ preventScroll: true })
        }
    }, [productQuery.data])

    const pageProductName = adapted?.projection
        ? getTranslatedFieldText(
              adapted.projection.identity.name,
              locale,
              offView?.productName,
          )
        : offView?.productName

    usePageMetadata({
        title:
            pageProductName ||
            (barcode
                ? t("barcodePageTitle", { barcode })
                : t("productLookupTitle")),
    })

    useEffect(() => {
        if (candidate && adapted && offView) {
            const frontImg =
                candidate.reference_images?.find((img) => img.role === "front")
                    ?.url || candidate.reference_images?.[0]?.url

            saveScanItem({
                identifier: adapted.normalizedIdentifier || barcode,
                name:
                    typeof adapted.rawRecord.product_name === "string" &&
                    adapted.rawRecord.product_name.trim()
                        ? adapted.rawRecord.product_name.trim()
                        : typeof adapted.rawRecord.product_name_en ===
                                "string" &&
                            adapted.rawRecord.product_name_en.trim()
                          ? adapted.rawRecord.product_name_en.trim()
                          : undefined,
                genericName: offView.genericName || undefined,
                brand: offView.brands.join(", ") || undefined,
                quantity: offView.quantity || undefined,
                manufacturingPlace:
                    offView.manufacturingPlaces?.trim() || undefined,
                packaging: offView.packagingText || undefined,
                labels: offView.labels.length ? offView.labels : undefined,
                imageUrl: frontImg,
                scheme: adapted.scheme,
            })
        }
    }, [candidate, adapted, barcode, offView])

    const isNotFound =
        productQuery.isError &&
        (productQuery.error?.message?.includes("404") ||
            (productQuery.error as { status?: number })?.status === 404 ||
            (productQuery.error as { code?: string })?.code ===
                "product_not_found" ||
            (
                productQuery.error as {
                    error?: { code?: string }
                }
            )?.error?.code === "product_not_found")

    const navigateToScan = () => void navigate(appRoutes.home)

    return (
        <div className="min-h-svh bg-neutral-50">
            <Header
                appearance="glass"
                showBackButton={true}
                onBack={navigateToScan}
                backLabel={tApp("backToScanner")}
            />

            <Container>
                {productQuery.isLoading && (
                    <div className="animate-pulse space-y-4 pb-16">
                        <Skeleton className="h-64 w-full rounded-2xl" />
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Skeleton className="h-28 w-full rounded-2xl" />
                            <Skeleton className="h-28 w-full rounded-2xl" />
                        </div>
                        <Skeleton className="h-44 w-full rounded-2xl" />
                        <Skeleton className="h-36 w-full rounded-2xl" />
                    </div>
                )}

                {isNotFound && <NotFoundCard onBack={navigateToScan} />}

                {productQuery.isError && !isNotFound && (
                    <div className="space-y-4 pt-4">
                        <Card className="border-error-200 bg-error-50/60 p-6 text-center shadow-xs sm:p-8">
                            <CardContent className="flex flex-col items-center space-y-3 p-0">
                                <div className="bg-error-100 text-error-600 flex h-12 w-12 items-center justify-center rounded-2xl">
                                    <AlertCircle className="h-6 w-6" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-error-950 text-base font-bold sm:text-lg">
                                        {t("unableToLoadProduct")}
                                    </h2>
                                    <p className="text-error-800 text-xs sm:text-sm">
                                        {translateProductError(
                                            locale,
                                            productQuery.error,
                                        )}
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            void productQuery.refetch()
                                        }
                                        className="border-error-300 text-error-900 hover:bg-error-100"
                                    >
                                        {t("tryAgain")}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={navigateToScan}
                                        className="gap-1 text-neutral-600 hover:text-neutral-900"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        <span>{tApp("backToScanner")}</span>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {adapted && candidate && offView && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 pb-16 duration-300">
                        {/* Product Hero Header */}
                        <ProductHero
                            candidate={candidate}
                            identifier={adapted.normalizedIdentifier || barcode}
                            genericName={offView.genericName}
                            projection={adapted.projection}
                            categoryItems={adapted.projection?.category_items}
                            headingRef={headingRef}
                            selectedConcernMatches={selectedConcernMatches}
                        />

                        {/* Product Details Navigation */}
                        <div className="flex items-center gap-3 pt-2">
                            <div className="space-y-0.5">
                                <h2 className="text-base font-extrabold tracking-[-0.02em] text-neutral-950 sm:text-lg">
                                    {t("productDetails")}
                                </h2>
                                <p className="text-xs text-neutral-500">
                                    {t("browseCategorizedSections")}
                                </p>
                            </div>
                        </div>

                        <Tabs
                            value={activeTab}
                            onValueChange={handleTabChange}
                            variant="line"
                            className="w-full"
                        >
                            <div
                                data-glass-surface=""
                                className="glass-surface sticky top-16 z-20 -mx-4 rounded-b-2xl border-b border-neutral-200/80 sm:-mx-6"
                            >
                                <div
                                    ref={tabScrollRef}
                                    className="no-scrollbar flex items-center overflow-x-auto overscroll-x-contain scroll-smooth px-4 sm:px-6"
                                >
                                    <TabsList
                                        aria-label={t("productDetailSections")}
                                        className="flex h-auto w-full min-w-max items-center justify-center gap-0 border-none bg-transparent p-0"
                                    >
                                        <TabsTrigger
                                            value="summary"
                                            className="shrink-0"
                                        >
                                            {t("summary")}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="ingredients"
                                            className="shrink-0"
                                        >
                                            {t("ingredients")}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="nutrition"
                                            className="shrink-0"
                                        >
                                            {t("nutrition")}
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="labels"
                                            className="shrink-0"
                                        >
                                            {t("labelsPackaging")}
                                        </TabsTrigger>
                                    </TabsList>
                                </div>
                                <div
                                    aria-hidden="true"
                                    className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white/95 via-white/70 to-transparent sm:hidden"
                                />
                            </div>

                            {/* Tab 1: Summary */}
                            <TabsContent
                                ref={activePanelRef}
                                value="summary"
                                className="scroll-mt-32 space-y-4 pt-2"
                            >
                                {hasSummaryData ? (
                                    <>
                                        {hasSourceAssessments && (
                                            <SourceAssessmentsCard
                                                showHeader={false}
                                                nutriscoreGrade={
                                                    offView.nutriscoreGrade
                                                }
                                                nutriscoreScore={
                                                    offView.nutriscoreScore
                                                }
                                                nutriscoreVersion={
                                                    offView.nutriscoreVersion
                                                }
                                                novaGroup={offView.novaGroup}
                                                novaGroupsMarkers={
                                                    offView.novaGroupsMarkers
                                                }
                                                ecoscoreGrade={
                                                    offView.ecoscoreGrade
                                                }
                                                ecoscoreScore={
                                                    offView.ecoscoreScore
                                                }
                                            />
                                        )}
                                        <NutrientLevelsCard
                                            levels={offView.nutrientLevels}
                                            labelEvidence={labelEvidence}
                                        />

                                        <IngredientSummaryCard
                                            concernMatches={allConcernMatches}
                                            labelEvidence={labelEvidence}
                                            onViewEvidence={() =>
                                                handleTabChange("ingredients")
                                            }
                                        />
                                    </>
                                ) : (
                                    <Card className="rounded-2xl border-neutral-200/90 bg-white shadow-xs">
                                        <CardContent className="space-y-1 p-4 sm:p-5">
                                            <p className="text-sm font-semibold text-neutral-900">
                                                {t("sourceDataUnavailable")}
                                            </p>
                                            <p className="text-caption text-neutral-500">
                                                {t(
                                                    "sourceDataUnavailableDetail",
                                                )}
                                            </p>
                                        </CardContent>
                                    </Card>
                                )}
                            </TabsContent>

                            {/* Tab 2: Ingredients */}
                            <TabsContent
                                ref={activePanelRef}
                                value="ingredients"
                                className="scroll-mt-32 space-y-4 pt-2"
                            >
                                <IngredientsCard
                                    labelEvidence={labelEvidence}
                                    ingredientsField={
                                        adapted.projection?.ingredients_text
                                    }
                                />
                                <AllergenCard
                                    analysis={candidate.allergen_analysis}
                                    labelEvidence={labelEvidence}
                                    concernMatches={allConcernMatches}
                                />
                                <AdditivesCard labelEvidence={labelEvidence} />
                                <IngredientsAnalysisCard
                                    analysis={offView.ingredientsAnalysis}
                                />
                            </TabsContent>

                            {/* Tab 3: Nutrition */}
                            <TabsContent
                                ref={activePanelRef}
                                value="nutrition"
                                className="scroll-mt-32 space-y-4 pt-2"
                            >
                                <NutrientLevelsCard
                                    levels={offView.nutrientLevels}
                                    labelEvidence={labelEvidence}
                                />
                                <NutritionCard labelEvidence={labelEvidence} />
                            </TabsContent>

                            {/* Tab 4: Labels & packaging */}
                            <TabsContent
                                ref={activePanelRef}
                                value="labels"
                                className="scroll-mt-32 space-y-4 pt-2"
                            >
                                <SymbolsCard labels={offView.labels} />
                                <PackagingsTableCard
                                    packagings={offView.packagings}
                                    packagingComponents={
                                        adapted.projection?.packaging.components
                                    }
                                    packagingText={offView.packagingText}
                                    descriptionItems={
                                        adapted.projection?.packaging
                                            .description_items
                                    }
                                    recyclingInstructionItems={
                                        adapted.projection?.packaging
                                            .recycling_instruction_items
                                    }
                                    storageInstructionItems={
                                        adapted.projection
                                            ?.storage_instruction_items
                                    }
                                />
                                <ProvenanceCard candidate={candidate} />
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </Container>
        </div>
    )
}
