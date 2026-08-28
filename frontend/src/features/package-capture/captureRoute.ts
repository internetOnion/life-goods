import { appRoutes } from "@/app/routes"

export type CaptureStep =
    "front" | "back" | "ingredients" | "review" | "close-up"
export type CaptureScenario =
    | "queued"
    | "processing"
    | "partial"
    | "completed"
    | "failed"
    | "timed-out"
    | "expired"

function addCaptureEntryContext(
    current: URLSearchParams,
    next: URLSearchParams,
) {
    const identifier = current.get("identifier")?.trim()
    const reason = current.get("reason")
    if (identifier) next.set("identifier", identifier)
    if (reason === "no-match" || reason === "different-package") {
        next.set("reason", reason)
    }
}

export function getRequestedCaptureStep(search: string): CaptureStep {
    const value = new URLSearchParams(search).get("step")
    if (
        value === "back" ||
        value === "ingredients" ||
        value === "review" ||
        value === "close-up"
    ) {
        return value
    }
    return "front"
}

export function buildCaptureUrl(step: CaptureStep, search: string) {
    const current = new URLSearchParams(search)
    const next = new URLSearchParams({ step })
    addCaptureEntryContext(current, next)
    return `${appRoutes.captureNew}?${next.toString()}`
}

export function buildCaptureResultUrl(
    path: string,
    scenario: CaptureScenario,
    search: string,
) {
    const current = new URLSearchParams(search)
    const next = new URLSearchParams({ scenario })
    addCaptureEntryContext(current, next)
    return `${path}?${next.toString()}`
}

export function resolveCaptureStep(
    requestedStep: CaptureStep,
    hasFrontPhoto: boolean,
    hasBackPhoto: boolean,
    hasIngredientPhoto: boolean,
    ingredientDecision: "pending" | "captured" | "skipped" = hasIngredientPhoto
        ? "captured"
        : "pending",
): CaptureStep {
    if (requestedStep === "close-up") return requestedStep
    if (requestedStep === "review") {
        if (!hasFrontPhoto) return "front"
        if (!hasBackPhoto) return "back"
        if (ingredientDecision === "pending") return "ingredients"
        return requestedStep
    }
    if (requestedStep === "ingredients" && !hasFrontPhoto) return "front"
    if (requestedStep === "ingredients" && !hasBackPhoto) return "back"
    if (requestedStep === "back" && !hasFrontPhoto) return "front"
    return requestedStep
}
