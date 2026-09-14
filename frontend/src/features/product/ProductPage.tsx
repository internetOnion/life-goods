import { useQuery } from "@tanstack/react-query"
import { AlertCircle, ArrowLeft, ChevronRight } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Container } from "@/components/layout/Container"
import { Header } from "@/components/layout/Header"
import { saveScanItem } from "@/lib/history"
import { validateIdentifier } from "@/lib/identifier"
import { usePageMetadata } from "@/lib/metadata"

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
        queryKey: ["product", normalizedBarcode],
        queryFn: () => lookup(normalizedBarcode),
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

    usePageMetadata({
        title: offView?.productName
            ? offView.productName
            : barcode
              ? `Barcode ${barcode}`
              : "Product Lookup",
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

    return (
        <div className="min-h-svh bg-neutral-50">
            <Header
                appearance="glass"
                showBackButton={true}
                onBack={() => void navigate("/search")}
                backLabel="Back to search"
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

                {isNotFound && (
                    <NotFoundCard
                        identifier={barcode}
                        onBack={() => void navigate("/search")}
                    />
                )}

                {productQuery.isError && !isNotFound && (
                    <div className="space-y-4 pt-4">
                        <Card className="border-error-200 bg-error-50/60 p-6 text-center shadow-xs sm:p-8">
                            <CardContent className="flex flex-col items-center space-y-3 p-0">
                                <div className="bg-error-100 text-error-600 flex h-12 w-12 items-center justify-center rounded-2xl">
                                    <AlertCircle className="h-6 w-6" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-error-950 text-base font-bold sm:text-lg">
                                        Unable to Load Product
                                    </h2>
                                    <p className="text-error-800 text-xs sm:text-sm">
                                        {productQuery.error?.message ||
                                            "An unexpected network or service error occurred while retrieving package data."}
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
                                        Try Again
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => void navigate("/search")}
                                        className="gap-1 text-neutral-600 hover:text-neutral-900"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        <span>Back to Search</span>
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
                            headingRef={headingRef}
                            selectedConcernMatches={selectedConcernMatches}
                        />

                        {/* Product Details Navigation */}
                        <div className="flex items-center gap-3 pt-2">
                            <div className="space-y-0.5">
                                <h2 className="text-base font-extrabold tracking-[-0.02em] text-neutral-950 sm:text-lg">
                                    Product Details
                                </h2>
                                <p className="text-xs text-neutral-500">
                                    Browse categorized sections
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
                                        aria-label="Product detail sections"
                                        className="flex h-auto w-max min-w-max items-center justify-start gap-0 border-none bg-transparent p-0 sm:min-w-full sm:justify-center"
                                    >
                                        <TabsTrigger
                                            value="summary"
                                            className="shrink-0"
                                        >
                                            Summary
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="ingredients"
                                            className="shrink-0"
                                        >
                                            Ingredients
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="nutrition"
                                            className="shrink-0"
                                        >
                                            Nutrition
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="labels"
                                            className="shrink-0"
                                        >
                                            Labels &amp; packaging
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
                                {hasSourceAssessments && (
                                    <SourceAssessmentsCard
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
                                        ecoscoreGrade={offView.ecoscoreGrade}
                                        ecoscoreScore={offView.ecoscoreScore}
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

                                <section
                                    aria-labelledby="more-product-details-heading"
                                    className="space-y-3"
                                >
                                    <div>
                                        <h3
                                            id="more-product-details-heading"
                                            className="text-sm font-bold tracking-[-0.015em] text-neutral-950 sm:text-base"
                                        >
                                            More Product details
                                        </h3>
                                        <p className="mt-1 text-xs text-neutral-500">
                                            Open the remaining Source Record
                                            sections when you need them.
                                        </p>
                                    </div>

                                    <nav
                                        aria-label="Product detail sections"
                                        className="divide-y divide-neutral-200/80 overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-xs"
                                    >
                                        {[
                                            {
                                                value: "nutrition" as const,
                                                label: "Nutrition",
                                                description:
                                                    "Nutrition Facts and nutrient levels",
                                            },
                                            {
                                                value: "labels" as const,
                                                label: "Labels & packaging",
                                                description:
                                                    "Labels, packaging, and source details",
                                            },
                                        ].map((section) => (
                                            <Button
                                                variant="ghost"
                                                key={section.value}
                                                type="button"
                                                className="focus-visible:ring-primary-500 flex min-h-14 w-full items-center justify-between gap-3 rounded-none px-4 py-3 text-left transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:px-5"
                                                onClick={() =>
                                                    handleTabChange(
                                                        section.value,
                                                    )
                                                }
                                            >
                                                <span className="min-w-0">
                                                    <span className="block text-sm font-bold text-neutral-950">
                                                        {section.label}
                                                    </span>
                                                    <span className="mt-0.5 block text-xs text-neutral-500">
                                                        {section.description}
                                                    </span>
                                                </span>
                                                <ChevronRight
                                                    aria-hidden="true"
                                                    className="text-info-700 size-4 shrink-0"
                                                />
                                            </Button>
                                        ))}
                                    </nav>
                                </section>
                            </TabsContent>

                            {/* Tab 2: Ingredients */}
                            <TabsContent
                                ref={activePanelRef}
                                value="ingredients"
                                className="scroll-mt-32 space-y-4 pt-2"
                            >
                                <IngredientsCard
                                    labelEvidence={labelEvidence}
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
                                    packagingText={offView.packagingText}
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
