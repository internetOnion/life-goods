import { useQuery } from "@tanstack/react-query"
import { AlertCircle, ArrowLeft } from "lucide-react"
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
import { HalalCard } from "./cards/HalalCard"
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

export function ProductPage({ lookup = lookupProduct }: ProductPageProps) {
    const { barcode = "" } = useParams()
    const location = useLocation()
    const navigate = useNavigate()

    const validation = useMemo(() => validateIdentifier(barcode), [barcode])
    const normalizedBarcode = validation.valid ? validation.value : ""
    const restoreScrollY = getProductRestoreLocationState(
        location.state,
    )?.restoreScrollY

    const [activeTab, setActiveTab] = useState("ingredients")
    const concernStorage = useSelectedConcernStorage()
    const selectedConcernIds = concernStorage.ids

    const tabScrollRef = useRef<HTMLDivElement>(null)

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
                name: offView.productName || "Unlabeled Product",
                brand: offView.brands.join(", ") || undefined,
                manufacturingPlace:
                    offView.manufacturingPlaces?.trim() || undefined,
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
                showBackButton={true}
                onBack={() => void navigate("/search")}
                identifier={barcode}
                backLabel="Back to search"
                secondaryActionLabel="New Search"
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
                            manufacturingPlace={offView.manufacturingPlaces}
                            headingRef={headingRef}
                            selectedConcernMatches={selectedConcernMatches}
                        />

                        {hasSourceAssessments && (
                            <SourceAssessmentsCard
                                showHeader={false}
                                nutriscoreGrade={offView.nutriscoreGrade}
                                nutriscoreScore={offView.nutriscoreScore}
                                nutriscoreVersion={offView.nutriscoreVersion}
                                novaGroup={offView.novaGroup}
                                novaGroupsMarkers={offView.novaGroupsMarkers}
                                ecoscoreGrade={offView.ecoscoreGrade}
                                ecoscoreScore={offView.ecoscoreScore}
                            />
                        )}

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
                            onValueChange={setActiveTab}
                            variant="line"
                            className="w-full"
                        >
                            <div className="sticky top-16 z-20 -mx-4 border-b border-neutral-200/80 bg-white sm:-mx-6">
                                <div
                                    ref={tabScrollRef}
                                    className="no-scrollbar flex items-center overflow-x-auto overscroll-x-contain scroll-smooth px-4 sm:px-6"
                                >
                                    <TabsList className="flex h-auto w-max min-w-full items-center justify-center gap-0 border-none bg-transparent p-0">
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
                                            value="symbols"
                                            className="shrink-0"
                                        >
                                            Symbols
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="overview"
                                            className="shrink-0"
                                        >
                                            Overview
                                        </TabsTrigger>
                                    </TabsList>
                                </div>
                            </div>

                            {/* Tab 1: Overview */}
                            <TabsContent
                                value="overview"
                                className="space-y-4 pt-2"
                            >
                                <IngredientsAnalysisCard
                                    analysis={offView.ingredientsAnalysis}
                                />
                                <IngredientsCard
                                    labelEvidence={labelEvidence}
                                />
                                <AdditivesCard labelEvidence={labelEvidence} />
                                <AllergenCard
                                    analysis={candidate.allergen_analysis}
                                    labelEvidence={labelEvidence}
                                    concernMatches={allConcernMatches}
                                />
                                <HalalCard
                                    assessment={
                                        candidate.halal_ingredient_assessment
                                    }
                                    labelEvidence={labelEvidence}
                                />
                                <NutrientLevelsCard
                                    levels={offView.nutrientLevels}
                                    labelEvidence={labelEvidence}
                                />
                                <NutritionCard labelEvidence={labelEvidence} />
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
                                <SymbolsCard labels={offView.labels} />
                                <PackagingsTableCard
                                    packagings={offView.packagings}
                                    packagingText={offView.packagingText}
                                />
                                <ProvenanceCard candidate={candidate} />
                            </TabsContent>

                            {/* Tab 2: Ingredients */}
                            <TabsContent
                                value="ingredients"
                                className="space-y-4 pt-2"
                            >
                                <IngredientsAnalysisCard
                                    analysis={offView.ingredientsAnalysis}
                                />
                                <IngredientsCard
                                    labelEvidence={labelEvidence}
                                />
                                <AdditivesCard labelEvidence={labelEvidence} />
                                <AllergenCard
                                    analysis={candidate.allergen_analysis}
                                    labelEvidence={labelEvidence}
                                    concernMatches={allConcernMatches}
                                />
                                <HalalCard
                                    assessment={
                                        candidate.halal_ingredient_assessment
                                    }
                                    labelEvidence={labelEvidence}
                                />
                            </TabsContent>

                            {/* Tab 3: Nutrition */}
                            <TabsContent
                                value="nutrition"
                                className="space-y-4 pt-2"
                            >
                                <NutrientLevelsCard
                                    levels={offView.nutrientLevels}
                                    labelEvidence={labelEvidence}
                                />
                                <NutritionCard labelEvidence={labelEvidence} />
                            </TabsContent>

                            {/* Tab 4: Symbols */}
                            <TabsContent
                                value="symbols"
                                className="space-y-4 pt-2"
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
                                <SymbolsCard labels={offView.labels} />
                                <PackagingsTableCard
                                    packagings={offView.packagings}
                                    packagingText={offView.packagingText}
                                />
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </Container>
        </div>
    )
}
