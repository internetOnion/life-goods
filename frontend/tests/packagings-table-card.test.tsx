import { render, screen, within } from "@testing-library/react"
import { describe, expect, test } from "vitest"

import { PackagingsTableCard } from "../src/features/product/cards/PackagingsTableCard"

describe("PackagingsTableCard", () => {
    test("uses collapsed table borders and shared row hover treatment", () => {
        render(
            <PackagingsTableCard
                packagings={[
                    {
                        shape: "wrapper",
                        material: "paper",
                        recycling: "recycle",
                        weightMeasured: 2,
                    },
                ]}
                packagingText="Paper wrapper"
            />,
        )

        const table = screen.getByRole("table")
        expect(table).toHaveClass("border-collapse")
        expect(
            within(table)
                .getAllByRole("row")
                .slice(1)
                .every((row) => row.classList.contains("table-row-hover")),
        ).toBe(true)
    })
})
