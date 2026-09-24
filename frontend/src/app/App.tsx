import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router"

import { ConcernsPage } from "@/features/concerns/ConcernsPage"
import { DataAndLicensesPage } from "@/features/data-and-licenses/DataAndLicensesPage"
import {
    LearnArticlePage,
    LearnGuidePage,
    LearnPage,
} from "@/features/learn/LearnPage"
import { LabelReadingPage } from "@/features/label-reading/LabelReadingPage"
import { LabelsHubPage } from "@/features/labels/LabelsHubPage"
import { NotFoundPage } from "@/features/not-found/NotFoundPage"
import { PhotoComparisonPage } from "@/features/photo-comparison/PhotoComparisonPage"
import { ProductPage } from "@/features/product/ProductPage"
import { lookupProduct, type ProductLookup } from "@/features/product/api"
import { ScanPage } from "@/features/scan/ScanPage"
import { BarcodeEntryPage } from "@/features/search/BarcodeEntryPage"
import { RecentProductViewsPage } from "@/features/search/RecentProductViewsPage"
import { AppShell } from "@/ui/AppShell"
import { LocaleProvider } from "@/i18n/LocaleProvider"

import { appRoutes } from "./routes"
import { TelegramBridge } from "./TelegramBridge"

/** Fixture preview of the label results; compiled out of production builds. */
const DevResultsPage = import.meta.env.DEV
    ? lazy(() => import("@/dev/DevResultsPage"))
    : null

type AppProps = {
    lookup?: ProductLookup
    demoMode?: boolean
}

export function App({ lookup = lookupProduct, demoMode = false }: AppProps) {
    return (
        <LocaleProvider>
            <TelegramBridge />
            <AppShell>
                <Routes>
                    <Route path={appRoutes.home} element={<ScanPage />} />
                    <Route
                        path={appRoutes.search}
                        element={<BarcodeEntryPage />}
                    />
                    <Route
                        path={appRoutes.recentSearches}
                        element={<RecentProductViewsPage />}
                    />
                    <Route path={appRoutes.learn} element={<LearnPage />} />
                    <Route
                        path={appRoutes.learnGuide}
                        element={<LearnGuidePage />}
                    />
                    <Route
                        path={appRoutes.learnDetail}
                        element={<LearnArticlePage demoMode={demoMode} />}
                    />
                    <Route
                        path={appRoutes.concerns}
                        element={<ConcernsPage />}
                    />
                    <Route
                        path={appRoutes.allergies}
                        element={<Navigate to={appRoutes.concerns} replace />}
                    />
                    <Route
                        path={appRoutes.product}
                        element={<ProductPage lookup={lookup} />}
                    />
                    <Route
                        path={appRoutes.dataAndLicenses}
                        element={<DataAndLicensesPage />}
                    />
                    <Route
                        path={appRoutes.labels}
                        element={<LabelsHubPage />}
                    />
                    <Route
                        path={appRoutes.labelsRead}
                        element={<LabelReadingPage />}
                    />
                    <Route
                        path={appRoutes.labelsCompare}
                        element={<PhotoComparisonPage />}
                    />
                    <Route
                        path={appRoutes.legacyCompare}
                        element={
                            <Navigate to={appRoutes.labelsCompare} replace />
                        }
                    />
                    <Route
                        path="/experimental/photo-comparison"
                        element={
                            <Navigate to={appRoutes.labelsCompare} replace />
                        }
                    />
                    <Route
                        path="/photo-comparison"
                        element={
                            <Navigate to={appRoutes.labelsCompare} replace />
                        }
                    />
                    {DevResultsPage ? (
                        <Route
                            path="/dev/results"
                            element={
                                <Suspense>
                                    <DevResultsPage />
                                </Suspense>
                            }
                        />
                    ) : null}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </AppShell>
        </LocaleProvider>
    )
}
