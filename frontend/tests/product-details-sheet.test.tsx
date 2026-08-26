import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, test, vi } from "vitest"

import { ProductDetailsSheet } from "../src/features/package-match/ProductDetailsSheet"
import i18n from "../src/i18n"

describe("ProductDetailsSheet", () => {
    beforeEach(async () => {
        await i18n.changeLanguage("en")
    })

    test("renders an accessible scrollable placeholder result", () => {
        render(
            <ProductDetailsSheet
                identifier="4006381333931"
                open
                onClose={vi.fn()}
            />,
        )

        expect(
            screen.getByRole("dialog", { name: "Product details" }),
        ).toBeVisible()
        expect(
            screen.getByRole("img", { name: "Package image placeholder" }),
        ).toBeVisible()
        expect(
            screen.getByLabelText("Scrollable product details"),
        ).toBeVisible()
        expect(screen.getByText("4006381333931")).toBeVisible()
        expect(screen.getAllByText("—").length).toBeGreaterThan(8)
    })

    test("closes from the close button and Escape key", async () => {
        const user = userEvent.setup()
        const onClose = vi.fn()
        const { rerender } = render(
            <ProductDetailsSheet
                identifier="4006381333931"
                open
                onClose={onClose}
            />,
        )

        await user.click(
            screen.getByRole("button", { name: "Close product details" }),
        )
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))

        onClose.mockClear()
        rerender(
            <ProductDetailsSheet
                identifier="4006381333931"
                open={false}
                onClose={onClose}
            />,
        )
        rerender(
            <ProductDetailsSheet
                identifier="4006381333931"
                open
                onClose={onClose}
            />,
        )
        fireEvent.keyDown(document, { key: "Escape" })
        await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    })
})
