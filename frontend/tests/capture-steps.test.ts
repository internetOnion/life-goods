import { describe, expect, test } from "vitest"

import {
    nextEmptyStep,
    neutralPhotoFile,
    type CaptureStepId,
} from "../src/features/label-reading/captureSteps"

const taken = (...ids: CaptureStepId[]) => new Set<CaptureStepId>(ids)

describe("capture steps", () => {
    test("finds the next empty step, wrapping unless told not to", () => {
        expect(nextEmptyStep(taken())).toBe("front")
        expect(nextEmptyStep(taken("front"), "front")).toBe("back")
        expect(nextEmptyStep(taken("back", "side"), "side")).toBe("front")
        expect(
            nextEmptyStep(taken("back", "side"), "side", { wrap: false }),
        ).toBeNull()
        expect(nextEmptyStep(taken("front", "back", "side"))).toBeNull()
    })

    test("renames photos to neutral names that keep a usable extension", () => {
        const jpeg = neutralPhotoFile(
            new File(["x"], "8850999320014 back.JPG", { type: "image/jpeg" }),
            0,
        )
        const heic = neutralPhotoFile(
            new File(["x"], "IMG_0042.HEIC", { type: "" }),
            2,
        )

        expect(jpeg.name).toBe("photo-1.jpg")
        expect(jpeg.type).toBe("image/jpeg")
        expect(heic.name).toBe("photo-3.heic")
    })
})
