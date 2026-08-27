import { appRoutes } from "@/app/routes"

export type CaptureStep = "front" | "ingredients" | "review"

export const captureStepNumbers: Record<CaptureStep, number> = {
    front: 1,
    ingredients: 2,
    review: 3,
}

export function getRequestedCaptureStep(search: string): CaptureStep {
    const value = new URLSearchParams(search).get("step")
    if (value === "ingredients" || value === "review") return value
    return "front"
}

export function buildCaptureUrl(step: CaptureStep, search: string) {
    const current = new URLSearchParams(search)
    const next = new URLSearchParams({ step })
    const identifier = current.get("identifier")?.trim()
    const reason = current.get("reason")
    if (identifier) next.set("identifier", identifier)
    if (reason === "no-match" || reason === "different-package") {
        next.set("reason", reason)
    }
    return `${appRoutes.captureNew}?${next.toString()}`
}

export function resolveCaptureStep(
    requestedStep: CaptureStep,
    hasFrontPhoto: boolean,
    hasIngredientPhoto: boolean,
): CaptureStep {
    if (requestedStep === "review" && (!hasFrontPhoto || !hasIngredientPhoto)) {
        return hasFrontPhoto ? "ingredients" : "front"
    }
    if (requestedStep === "ingredients" && !hasFrontPhoto) return "front"
    return requestedStep
}
