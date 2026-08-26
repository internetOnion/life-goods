import { afterEach, describe, expect, test, vi } from "vitest"

import { client } from "../src/api/generated/client.gen"
import { lookupPackageMatches } from "../src/features/package-match/api"
import { completeOffCandidate, packageMatches } from "./package-match-fixtures"

describe("Package Match API boundary", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    test("uses only the same-origin LifeGoods Package Match endpoint", async () => {
        const packageMatch = packageMatches(completeOffCandidate())
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify(packageMatch), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
        )
        vi.stubGlobal("fetch", fetchMock)
        client.setConfig({
            baseUrl: "https://lifegoods.test",
            fetch: fetchMock,
        })

        const result = await lookupPackageMatches("4006381333931")

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const request = fetchMock.mock.calls[0]?.[0]
        expect(request).toBeInstanceOf(Request)
        expect((request as Request).url).toBe(
            "https://lifegoods.test/api/v1/package-matches?identifier=4006381333931",
        )
        expect((request as Request).url).not.toContain("openfoodfacts.org")
        expect(result).toEqual(packageMatch)
    })
})
