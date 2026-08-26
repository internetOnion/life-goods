type MvpDemoEnvironment = {
    VITE_MVP_DEMO_MODE?: string
}

export function isMvpDemoMode(
    environment: MvpDemoEnvironment = import.meta.env,
) {
    return environment.VITE_MVP_DEMO_MODE === "true"
}

export function getMvpDemoScenario(search: string, demoMode = isMvpDemoMode()) {
    if (!demoMode) return null

    const scenario = new URLSearchParams(search).get("scenario")?.trim()
    return scenario || null
}
