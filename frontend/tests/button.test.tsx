import { render, screen } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { Button, GlassButton } from "../src/components/ui/button"

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

describe("Button", () => {
    test("uses the canonical high-contrast primary action contract", () => {
        render(<Button>Continue</Button>)

        expect(screen.getByRole("button", { name: "Continue" })).toHaveClass(
            "bg-primary-600",
            "text-white",
            "hover:bg-primary-700",
            "active:bg-primary-800",
            "rounded-xl",
        )
    })

    test("keeps every shared control variant on the canonical control radius", () => {
        render(
            <>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="subtle">Subtle</Button>
            </>,
        )

        for (const name of ["Secondary", "Outline", "Ghost", "Subtle"]) {
            expect(screen.getByRole("button", { name })).toHaveClass(
                "rounded-xl",
            )
        }
    })
})
