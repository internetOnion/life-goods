import { useQuery } from "@tanstack/react-query"
import { AlertCircle, ArrowLeft, LayoutGrid, ListFilter } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Container } from "@/components/layout/Container"
import { Header } from "@/components/layout/Header"
import { saveScanItem } from "@/lib/history"
import { validateIdentifier } from "@/lib/identifier"
import { usePageMetadata } from "@/lib/metadata"
import { cn } from "@/lib/utils"

import { lookupProduct, type ProductLookup } from "./api"
import { adaptProductLookup } from "./adapter"
import { AdditivesCard } from "./cards/AdditivesCard"
import { AllergenCard } from "./cards/AllergenCard"
import { DataQualityCard } from "./cards/DataQualityCard"
import { HalalCard } from "./cards/HalalCard"
import { IngredientsAnalysisCard } from "./cards/IngredientsAnalysisCard"
import { IngredientsCard } from "./cards/IngredientsCard"
import { NotFoundCard } from "./cards/NotFoundCard"
import { NutritionCard } from "./cards/NutritionCard"
import { PackagingCard } from "./cards/PackagingCard"
import { PackagingsTableCard } from "./cards/PackagingsTableCard"
import { PhotosGalleryCard } from "./cards/PhotosGalleryCard"
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
    const navigate = useNavigate()

    const validation = useMemo(() => validateIdentifier(barcode), [barcode])
    const normalizedBarcode = validation.valid ? validation.value : ""

    const [activeTab, setActiveTab] = useState("overview")
    const [viewMode, setViewMode] = useState<"tabs" | "stream">("tabs")

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

    const headingRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        if (productQuery.data) {
            headingRef.current?.focus()
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
        <div className="min-h-screen bg-neutral-50/50">
            <Header
                showBackButton={true}
                onBack={() => void navigate("/")}
                identifier={barcode}
            />

            <Container>
                {productQuery.isLoading && (
                    <div className="animate-pulse space-y-4 pb-16">
                        <Skeleton className="h-64 w-full rounded-3xl" />
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Skeleton className="h-28 w-full rounded-2xl" />
                            <Skeleton className="h-28 w-full rounded-2xl" />
                        </div>
                        <Skeleton className="h-44 w-full rounded-3xl" />
                        <Skeleton className="h-36 w-full rounded-3xl" />
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
                            scheme={adapted.scheme}
                            genericName={offView.genericName}
                            categories={offView.categories}
                            headingRef={headingRef}
                        />

                        {/* Open Food Facts Top Score Pillars - Vertical List */}
                        <div className="space-y-3">
                            <div className="flex flex-col gap-2.5">
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
                            <NutrientLevelsCard
                                levels={offView.nutrientLevels}
                                labelEvidence={labelEvidence}
                            />
                        </div>

                        {/* Navigation View Mode Toggle & Tab Bar */}
                        <div className="flex items-center justify-between gap-3 pt-2">
                            <h2 className="text-sm font-bold tracking-tight text-neutral-900 sm:text-base">
                                Product Details
                            </h2>
                            <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() =>
                                    setViewMode(
                                        viewMode === "tabs" ? "stream" : "tabs",
                                    )
                                }
                                className="focus-visible:ring-primary-500 inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 shadow-2xs transition-colors hover:bg-neutral-50 hover:text-neutral-950 focus-visible:ring-2"
                            >
                                {viewMode === "tabs" ? (
                                    <>
                                        <ListFilter className="h-3.5 w-3.5 text-neutral-500" />
                                        <span>Show All Sections</span>
                                    </>
                                ) : (
                                    <>
                                        <LayoutGrid className="h-3.5 w-3.5 text-neutral-500" />
                                        <span>Tabbed View</span>
                                    </>
                                )}
                            </Button>
                        </div>

                        {viewMode === "tabs" ? (
                            /* Tabbed Navigation */
                            <Tabs
                                value={activeTab}
                                onValueChange={setActiveTab}
                                variant="line"
                                className="w-full"
                            >
                                <div className="no-scrollbar sticky top-16 z-20 -mx-4 overflow-x-auto border-b border-neutral-200/80 bg-white/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
                                    <TabsList className="grid h-auto w-full min-w-[380px] grid-cols-5 border-none bg-transparent p-0">
                                        <TabsTrigger value="overview">
                                            Overview
                                        </TabsTrigger>
                                        <TabsTrigger value="ingredients">
                                            Ingredients
                                        </TabsTrigger>
                                        <TabsTrigger value="nutrition">
                                            Nutrition
                                        </TabsTrigger>
                                        <TabsTrigger
                                            value="photos"
                                            className="gap-1 sm:gap-1.5"
                                        >
                                            <span>Photos</span>
                                            <span
                                                className={cn(
                                                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold transition-colors",
                                                    activeTab === "photos"
                                                        ? "bg-primary-100 text-primary-800"
                                                        : "bg-neutral-100 text-neutral-600",
                                                )}
                                            >
                                                {offView.allImages.length}
                                            </span>
                                        </TabsTrigger>
                                        <TabsTrigger value="data">
                                            Data & Raw
                                        </TabsTrigger>
                                    </TabsList>
                                </div>

                                {/* Tab 1: Overview */}
                                <TabsContent
                                    value="overview"
                                    className="space-y-4 pt-2"
                                >
                                    <ProductCharacteristicsCard
                                        product={offView}
                                    />
                                    <PackagingsTableCard
                                        packagings={offView.packagings}
                                        packagingText={offView.packagingText}
                                    />
                                    <PackagingCard
                                        labelEvidence={labelEvidence}
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
                                        allergenAssessment={
                                            candidate.allergen_assessment
                                        }
                                    />
                                    <AdditivesCard
                                        labelEvidence={labelEvidence}
                                    />
                                    <AllergenCard
                                        assessment={
                                            candidate.allergen_assessment
                                        }
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
                                    <NutritionCard
                                        labelEvidence={labelEvidence}
                                    />
                                </TabsContent>

                                {/* Tab 4: Photos */}
                                <TabsContent
                                    value="photos"
                                    className="space-y-4 pt-2"
                                >
                                    <PhotosGalleryCard
                                        photos={offView.allImages}
                                        productName={offView.productName}
                                    />
                                </TabsContent>

                                {/* Tab 5: Data Quality & Raw Record */}
                                <TabsContent
                                    value="data"
                                    className="space-y-4 pt-2"
                                >
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
                        ) : (
                            /* Stream View */
                            <div className="space-y-4 pt-1">
                                <ProductCharacteristicsCard product={offView} />
                                <PackagingsTableCard
                                    packagings={offView.packagings}
                                    packagingText={offView.packagingText}
                                />
                                <IngredientsAnalysisCard
                                    analysis={offView.ingredientsAnalysis}
                                />
                                <IngredientsCard
                                    labelEvidence={labelEvidence}
                                    allergenAssessment={
                                        candidate.allergen_assessment
                                    }
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
                                <NutritionCard labelEvidence={labelEvidence} />
                                <PhotosGalleryCard
                                    photos={offView.allImages}
                                    productName={offView.productName}
                                />
                                <DataQualityCard
                                    completeness={offView.completeness}
                                    statesTags={offView.statesTags}
                                    creator={offView.creator}
                                    lastModified={offView.lastModified}
                                />
                                <PackagingCard labelEvidence={labelEvidence} />
                                <ProvenanceCard candidate={candidate} />
                                {adapted.meta && (
                                    <RawRecordCard
                                        meta={adapted.meta}
                                        rawRecord={adapted.rawRecord}
                                    />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Container>
        </div>
    )
}
