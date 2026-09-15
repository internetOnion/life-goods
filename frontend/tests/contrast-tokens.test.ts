import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, test } from "vitest"

const stylesheet = readFileSync(
    resolve(process.cwd(), "src/styles.css"),
    "utf8",
)

function colorToken(name: string) {
    const match = stylesheet.match(
        new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`),
    )

    if (!match) {
        throw new Error(`Missing color token: ${name}`)
    }

    const color = match[1]
    if (!color) {
        throw new Error(`Missing color token: ${name}`)
    }

    return color
}

function relativeLuminance(hex: string) {
    const matches = hex.slice(1).match(/.{2}/g)

    if (!matches || matches.length !== 3) {
        throw new Error(`Invalid color: ${hex}`)
    }

    const [redHex, greenHex, blueHex] = matches
    if (!redHex || !greenHex || !blueHex) {
        throw new Error(`Invalid color: ${hex}`)
    }

    const channels: [number, number, number] = [
        Number.parseInt(redHex, 16) / 255,
        Number.parseInt(greenHex, 16) / 255,
        Number.parseInt(blueHex, 16) / 255,
    ]
    const linearize = (channel: number) =>
        channel <= 0.03928
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4
    const [red, green, blue] = channels.map(linearize) as [
        number,
        number,
        number,
    ]

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(foreground: string, background: string) {
    const foregroundLuminance = relativeLuminance(foreground)
    const backgroundLuminance = relativeLuminance(background)
    const lighter = Math.max(foregroundLuminance, backgroundLuminance)
    const darker = Math.min(foregroundLuminance, backgroundLuminance)

    return (lighter + 0.05) / (darker + 0.05)
}

describe("canonical contrast pairings", () => {
    test("primary actions keep a white foreground across interaction shades", () => {
        expect(colorToken("primary-foreground")).toBe("#ffffff")

        for (const shade of ["600", "700", "800"]) {
            expect(
                contrastRatio(
                    colorToken("primary-foreground"),
                    colorToken(`primary-${shade}`),
                ),
            ).toBeGreaterThanOrEqual(4.5)
        }
    })

    test("content-bearing semantic text stays readable on light surfaces", () => {
        for (const surface of ["50", "100"]) {
            expect(
                contrastRatio(
                    colorToken("neutral-950"),
                    colorToken(`primary-${surface}`),
                ),
            ).toBeGreaterThanOrEqual(4.5)
            expect(
                contrastRatio(
                    colorToken("neutral-600"),
                    colorToken(`neutral-${surface}`),
                ),
            ).toBeGreaterThanOrEqual(4.5)
            expect(
                contrastRatio(
                    colorToken("info-700"),
                    colorToken(`info-${surface}`),
                ),
            ).toBeGreaterThanOrEqual(4.5)
        }
    })
})
