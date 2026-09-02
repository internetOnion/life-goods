import { afterEach, describe, expect, test, vi } from "vitest"

import { client } from "../src/api/generated/client.gen"
import { createPackageMatchLookup } from "../src/features/package-match/api"
import { createPackageSearchLookup } from "../src/features/search/api"
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

        const result = await createPackageMatchLookup(false)("4006381333931")

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const request = fetchMock.mock.calls[0]?.[0]
        expect(request).toBeInstanceOf(Request)
        expect((request as Request).url).toBe(
            "https://lifegoods.test/api/v1/package-matches?identifier=4006381333931",
        )
        expect((request as Request).url).not.toContain("openfoodfacts.org")
        expect(result).toEqual(packageMatch)
    })

    test("does not fall back to demo data when the real API fails", async () => {
        const apiError = new Error("Package Match unavailable")
        const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(apiError)
        client.setConfig({
            baseUrl: "https://lifegoods.test",
            fetch: fetchMock,
        })

        await expect(
            createPackageMatchLookup(false)("4006381333931"),
        ).rejects.toBe(apiError)
        expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    test.each([
        ["42104964", "GTIN_8"],
        ["737628064502", "UPC_A"],
        ["4006381333931", "EAN_13"],
        ["04006381333931", "GTIN_14"],
    ] as const)(
        "uses a self-contained demo response for %s (%s)",
        async (identifier, scheme) => {
            const fetchMock = vi.fn<typeof fetch>()
            client.setConfig({
                baseUrl: "https://lifegoods.test",
                fetch: fetchMock,
            })

            const result = await createPackageMatchLookup(true)(identifier)
            const candidate = result.candidates[0]!
            const identifierEvidence = candidate.identity_evidence?.find(
                (item) => item.field === "identifier",
            )
            const sourceUrl = `https://world.openfoodfacts.org/product/${identifier}`

            expect(fetchMock).not.toHaveBeenCalled()
            expect(result.normalized_identifier).toBe(identifier)
            expect(result.scheme).toBe(scheme)
            expect(candidate.external_record_id).toBe(identifier)
            expect(candidate.source?.record_url).toBe(sourceUrl)
            expect(identifierEvidence?.value).toBe(identifier)
            expect(
                [
                    ...(candidate.identity_evidence ?? []),
                    ...(candidate.label_evidence ?? []),
                    ...(candidate.reference_images ?? []),
                ].every((item) => item.source_url === sourceUrl),
            ).toBe(true)
            expect(
                candidate.identity_evidence?.some(
                    (item) =>
                        item.field === "name" &&
                        item.value === "Dark chocolate",
                ),
            ).toBe(true)
        },
    )

    test("returns a fresh demo response for every lookup", async () => {
        const lookup = createPackageMatchLookup(true)
        const first = await lookup("4006381333931")
        first.candidates[0]!.identity_evidence![1]!.value = "Changed"

        const second = await lookup("4006381333931")

        expect(second.candidates[0]!.identity_evidence![1]!.value).toBe(
            "Dark chocolate",
        )
    })
})

describe("Package search API boundary", () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    test("uses the same-origin paginated Product search endpoint", async () => {
        const response = {
            dataset_version: {
                activated_at: "2026-08-30T00:00:00Z",
                id: "off-kh-2026-08",
                retrieved_at: "2026-08-29T00:00:00Z",
                sha256: "abc123",
                source_url: "https://world.openfoodfacts.org",
            },
            next_offset: null,
            normalized_query: "coconut milk",
            results: [],
        }
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(JSON.stringify(response), {
                status: 200,
                headers: { "content-type": "application/json" },
            }),
        )
        vi.stubGlobal("fetch", fetchMock)
        client.setConfig({
            baseUrl: "https://lifegoods.test",
            fetch: fetchMock,
        })

        const result = await createPackageSearchLookup(false)(
            "coconut milk",
            12,
        )

        const request = fetchMock.mock.calls[0]?.[0]
        expect(request).toBeInstanceOf(Request)
        expect((request as Request).url).toBe(
            "https://lifegoods.test/api/v1/package-search?query=coconut%20milk&offset=12&limit=12",
        )
        expect(result).toEqual(response)
    })
})
