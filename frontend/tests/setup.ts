import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, vi } from "vitest"

if (typeof window !== "undefined") {
    window.scrollTo = vi.fn()
    if (!window.URL.createObjectURL) {
        window.URL.createObjectURL = vi.fn(
            () => `blob:mock-${Math.random().toString(36).slice(2)}`,
        )
    }
    if (!window.URL.revokeObjectURL) {
        window.URL.revokeObjectURL = vi.fn()
    }
}

afterEach(cleanup)
