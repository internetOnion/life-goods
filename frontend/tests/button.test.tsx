import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { GlassButton } from "../src/components/ui/button"

describe("GlassButton", () => {
    test("maps default, neutral, and selected tones to the glass material", () => {
        render(
            <>
                <GlassButton>Primary</GlassButton>
                <GlassButton variant="ghost">Neutral</GlassButton>
                <GlassButton variant="ghost" glassTone="selected">
                    Selected
                </GlassButton>
            </>,
        )

        expect(screen.getByRole("button", { name: "Primary" })).toHaveAttribute(
            "data-glass",
            "primary",
        )
        expect(screen.getByRole("button", { name: "Neutral" })).toHaveAttribute(
            "data-glass",
            "neutral",
        )
        expect(
            screen.getByRole("button", { name: "Selected" }),
        ).toHaveAttribute("data-glass", "selected")
    })
})
