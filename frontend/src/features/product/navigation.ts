export type ProductLessonLocationState = {
    returnTo: string
    returnScrollY: number
}

export type ProductRestoreLocationState = {
    restoreScrollY: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

export function getProductLessonLocationState(
    state: unknown,
): ProductLessonLocationState | undefined {
    if (!isRecord(state)) return undefined

    return typeof state.returnTo === "string" &&
        typeof state.returnScrollY === "number"
        ? {
              returnTo: state.returnTo,
              returnScrollY: state.returnScrollY,
          }
        : undefined
}

export function getProductRestoreLocationState(
    state: unknown,
): ProductRestoreLocationState | undefined {
    if (!isRecord(state)) return undefined

    return typeof state.restoreScrollY === "number"
        ? { restoreScrollY: state.restoreScrollY }
        : undefined
}
