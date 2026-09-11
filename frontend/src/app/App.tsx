import { Navigate, Route, Routes } from "react-router"

import { ConcernsPage } from "@/features/concerns/ConcernsPage"
import { DataAndLicensesPage } from "@/features/data-and-licenses/DataAndLicensesPage"
import {
    LearnArticlePage,
    LearnGuidePage,
    LearnPage,
} from "@/features/learn/LearnPage"
import { NotFoundPage } from "@/features/not-found/NotFoundPage"
import { ProductPage } from "@/features/product/ProductPage"
import { lookupProduct, type ProductLookup } from "@/features/product/api"
import { ScanPage } from "@/features/scan/ScanPage"
import { BarcodeEntryPage } from "@/features/search/BarcodeEntryPage"
import { RecentProductViewsPage } from "@/features/search/RecentProductViewsPage"
import { AppShell } from "@/ui/AppShell"

import { appRoutes } from "./routes"

type AppProps = {
    lookup?: ProductLookup
    demoMode?: boolean
}

export function App({ lookup = lookupProduct, demoMode = false }: AppProps) {
    return (
        <AppShell>
            <Routes>
                <Route path={appRoutes.home} element={<ScanPage />} />
                <Route path={appRoutes.search} element={<BarcodeEntryPage />} />
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
                <Route path={appRoutes.concerns} element={<ConcernsPage />} />
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
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </AppShell>
    )
}
