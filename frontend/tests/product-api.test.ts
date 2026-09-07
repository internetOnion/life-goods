import { afterEach, expect, it, vi } from "vitest"
import { client } from "@/api/generated/client.gen"
import { lookupProduct } from "@/features/product/api"

afterEach(() => vi.unstubAllGlobals())

it("requests Khmer Translation using language=kh", async () => {
    client.setConfig({ baseUrl: "http://localhost:8000" })
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: { product: {} }, meta: {} }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }),
    )
    vi.stubGlobal("fetch", fetchMock)
    await lookupProduct("4006381333931")
    const request = fetchMock.mock.calls[0]?.[0] as Request
    const url = new URL(request.url)
    expect(url.pathname).toBe("/api/v1/products/4006381333931")
    expect(url.searchParams.get("language")).toBe("kh")
})
