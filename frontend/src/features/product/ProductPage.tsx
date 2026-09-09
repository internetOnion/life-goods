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
import { CountryTagInfoCard } from "./cards/CountryTagInfoCard"
import { DataQualityCard } from "./cards/DataQualityCard"
import { HalalCard } from "./cards/HalalCard"
import { IngredientsAnalysisCard } from "./cards/IngredientsAnalysisCard"
import { IngredientsCard } from "./cards/IngredientsCard"
import { NotFoundCard } from "./cards/NotFoundCard"
import { NutritionCard } from "./cards/NutritionCard"
import { PackagingCard } from "./cards/PackagingCard"
import { PackagingsTableCard } from "./cards/PackagingsTableCard"
import { ProductCharacteristicsCard } from "./cards/ProductCharacteristicsCard"
import { ProductHero } from "./cards/ProductHero"
import { ProvenanceCard } from "./cards/ProvenanceCard"
import { RawRecordCard } from "./cards/RawRecordCard"
import { EcoScoreBanner } from "./cards/scores/EcoScoreBanner"
import { NovaGroupBanner } from "./cards/scores/NovaGroupBanner"
import { NutrientLevelsCard } from "./cards/scores/NutrientLevelsCard"
import { NutriScoreBanner } from "./cards/scores/NutriScoreBanner"

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
    const labelEvidence = candidate?.label_evidence || []
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
        if (candidate && adapted) {
            const nameEvidence = candidate.identity_evidence?.find(
                (e) => e.field === "name",
            )
            const brandEvidence = candidate.identity_evidence?.find(
                (e) => e.field === "brands",
            )
            const frontImg =
                candidate.reference_images?.find((img) => img.role === "front")
                    ?.url || candidate.reference_images?.[0]?.url

            let brandStr = ""
            if (brandEvidence?.value) {
                if (Array.isArray(brandEvidence.value)) {
                    brandStr = (brandEvidence.value as unknown[])
                        .map((v) =>
                            typeof v === "string"
                                ? v
                                : typeof v === "number"
                                  ? String(v)
                                  : "",
                        )
                        .filter(Boolean)
                        .join(", ")
                } else if (typeof brandEvidence.value === "string") {
                    brandStr = brandEvidence.value
                } else if (typeof brandEvidence.value === "number") {
                    brandStr = String(brandEvidence.value)
                }
            }

            saveScanItem({
                identifier: adapted.normalizedIdentifier || barcode,
                name: (nameEvidence?.value as string) || "Unlabeled Product",
                brand: brandStr || undefined,
                imageUrl: frontImg,
                scheme: adapted.scheme,
            })
        }
    }, [candidate, adapted, barcode])

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
                onBack={() => void navigate("/")}
                identifier={barcode}
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
                        onBack={() => void navigate("/")}
                        onTrySample={(code) =>
                            void navigate(`/products/${code}`)
                        }
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
                                        onClick={() => void navigate("/")}
                                        className="gap-1 text-neutral-600 hover:text-neutral-900"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        <span>Back to Scanner</span>
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
                            origin={offView.origins}
                            headingRef={headingRef}
                        />

                        {/* Open Food Facts Top Score Pillars */}
                        {hasSourceAssessments && (
                            <div
                                className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                                aria-label="Open Food Facts Source Assessments"
                            >
                                <div className="divide-y divide-neutral-200">
                                    <NutriScoreBanner
                                        grade={offView.nutriscoreGrade}
                                        score={offView.nutriscoreScore}
                                        version={offView.nutriscoreVersion}
                                    />
                                    <NovaGroupBanner
                                        group={offView.novaGroup}
                                        markers={offView.novaGroupsMarkers}
                                    />
                                    <EcoScoreBanner
                                        grade={offView.ecoscoreGrade}
                                        score={offView.ecoscoreScore}
                                    />
                                </div>
                            </div>
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
                                            value="data"
                                            className="shrink-0"
                                        >
                                            Data & Raw
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
                                <ProductCharacteristicsCard product={offView} />
                                <PackagingsTableCard
                                    packagings={offView.packagings}
                                    packagingText={offView.packagingText}
                                />
                                <PackagingCard labelEvidence={labelEvidence} />
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
                                    assessment={candidate.allergen_assessment}
                                    labelEvidence={labelEvidence}
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

                            {/* Tab 4: Data Quality & Raw Record */}
                            <TabsContent
                                value="data"
                                className="space-y-4 pt-2"
                            >
                                <CountryTagInfoCard
                                    languages={offView.languages}
                                />
                                <DataQualityCard
                                    completeness={offView.completeness}
                                    statesTags={offView.statesTags}
                                    creator={offView.creator}
                                    lastModified={offView.lastModified}
                                />
                                <ProvenanceCard candidate={candidate} />
                                {adapted.meta && (
                                    <RawRecordCard
                                        meta={adapted.meta}
                                        rawRecord={adapted.rawRecord}
                                    />
                                )}
                            </TabsContent>
                        </Tabs>
                    </div>
                )}
            </Container>
        </div>
    )
}
