import { render, screen } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router"
import { beforeEach, describe, expect, test } from "vitest"

import { getMvpDemoScenario, isMvpDemoMode } from "../src/config/mvpDemoMode"
import { useMvpDemoMode } from "../src/config/MvpDemoModeContext"
import i18n from "../src/i18n"
import { AppShell } from "../src/ui/AppShell"
import { DemoNotice } from "../src/ui/DemoNotice"

function SparseSearchFixtureNotice() {
    const location = useLocation()
    const demoMode = useMvpDemoMode()
    const scenario = getMvpDemoScenario(location.search, demoMode)

    return <DemoNotice active={scenario === "sparse"} />
}

function renderFixtureNotice(path: string, demoMode: boolean) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <AppShell demoMode={demoMode}>
                <SparseSearchFixtureNotice />
            </AppShell>
        </MemoryRouter>,
    )
}

describe("MVP demo mode", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
    })

    test("is default-off and only accepts the explicit true value", () => {
        expect(isMvpDemoMode({})).toBe(false)
        expect(isMvpDemoMode({ VITE_MVP_DEMO_MODE: "false" })).toBe(false)
        expect(isMvpDemoMode({ VITE_MVP_DEMO_MODE: "TRUE" })).toBe(false)
        expect(isMvpDemoMode({ VITE_MVP_DEMO_MODE: "true" })).toBe(true)
    })

    test("ignores scenario query parameters while demo mode is disabled", () => {
        expect(getMvpDemoScenario("?scenario=sparse", false)).toBeNull()
        expect(getMvpDemoScenario("?scenario=sparse", true)).toBe("sparse")
        expect(getMvpDemoScenario("?scenario=%20%20", true)).toBeNull()
    })

    test("shows the localized notice only when a feature activates a fixture", () => {
        const { unmount } = renderFixtureNotice(
            "/search?scenario=sparse",
            false,
        )

        expect(
            screen.queryByRole("status", { name: "Demo data is active" }),
        ).not.toBeInTheDocument()

        unmount()
        renderFixtureNotice("/search?scenario=unknown", true)

        expect(
            screen.queryByRole("status", { name: "Demo data is active" }),
        ).not.toBeInTheDocument()

        renderFixtureNotice("/search?scenario=sparse", true)

        expect(
            screen.getByRole("status", { name: "Demo data is active" }),
        ).toHaveTextContent(
            "This content is for demonstration only and is not real package information.",
        )
    })
})
