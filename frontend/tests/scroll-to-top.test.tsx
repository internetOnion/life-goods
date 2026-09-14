import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, test, vi } from "vitest"

import { ScrollToTopButton } from "../src/components/layout/ScrollToTopButton"

describe("ScrollToTopButton", () => {
    test("appears after the user scrolls down and returns to the top", async () => {
        const user = userEvent.setup()
        const scrollToSpy = vi.spyOn(window, "scrollTo")
        scrollToSpy.mockClear()
        Object.defineProperty(window, "scrollY", {
            configurable: true,
            value: 0,
        })

        render(<ScrollToTopButton />)

        expect(
            screen.queryByRole("button", { name: "Back to top" }),
        ).not.toBeInTheDocument()

        Object.defineProperty(window, "scrollY", {
            configurable: true,
            value: 640,
        })
        fireEvent.scroll(window)

        const button = await screen.findByRole("button", {
            name: "Back to top",
        })
        await user.click(button)

        expect(scrollToSpy).toHaveBeenCalledWith({
            top: 0,
            behavior: "smooth",
        })
        expect(
            screen.queryByRole("button", { name: "Back to top" }),
        ).not.toBeInTheDocument()
    })

    test("clears the bottom dock on the way up", () => {
        Object.defineProperty(window, "scrollY", {
            configurable: true,
            value: 640,
        })

        render(<ScrollToTopButton hasBottomDock />)

        expect(screen.getByRole("button", { name: "Back to top" })).toHaveClass(
            "bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]",
        )
    })
})
