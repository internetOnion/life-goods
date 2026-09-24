import { describe, expect, test } from "vitest"

import {
    assessPhotoQuality,
    measurePhotoQuality,
} from "../src/features/photo-evidence/imageQuality"

const SIZE = 64

function image(pixel: (x: number, y: number) => number): Uint8ClampedArray {
    const data = new Uint8ClampedArray(SIZE * SIZE * 4)
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const offset = (y * SIZE + x) * 4
            const value = pixel(x, y)
            data[offset] = value
            data[offset + 1] = value
            data[offset + 2] = value
            data[offset + 3] = 255
        }
    }
    return data
}

function issuesOf(pixel: (x: number, y: number) => number) {
    return assessPhotoQuality(measurePhotoQuality(image(pixel), SIZE, SIZE))
        .issues
}

describe("photo quality hints", () => {
    test("a flat gray photo has no edge detail and reads as blurry", () => {
        expect(issuesOf(() => 128)).toEqual(["blurry"])
    })

    test("a black photo reads as dark", () => {
        expect(issuesOf(() => 0)).toContain("dark")
    })

    test("a sharp checkerboard at normal exposure has no issues", () => {
        expect(issuesOf((x, y) => ((x + y) % 2 === 0 ? 40 : 200))).toEqual([])
    })

    test("a mostly white, clipped photo reads as glare", () => {
        expect(
            issuesOf((x, y) => (x < SIZE * 0.3 || (x + y) % 2 ? 255 : 60)),
        ).toContain("glare")
    })

    test("reports metrics on the documented scales", () => {
        const metrics = measurePhotoQuality(
            image(() => 255),
            SIZE,
            SIZE,
        )
        expect(metrics.meanLuminance).toBeCloseTo(255, 0)
        expect(metrics.clippedShare).toBe(1)
        expect(metrics.sharpness).toBe(0)
    })

    test("rejects pixel data that does not match the dimensions", () => {
        expect(() =>
            measurePhotoQuality(new Uint8ClampedArray(16), SIZE, SIZE),
        ).toThrow(RangeError)
    })
})
