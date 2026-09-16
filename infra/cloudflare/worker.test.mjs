import { test } from "node:test"
import assert from "node:assert/strict"
import worker from "./worker.mjs"

const request = (path, options = {}) =>
    new Request(`https://staging.workers.dev${path}`, {
        ...options,
        headers: { "CF-Connecting-IP": "203.0.113.10", ...options.headers },
    })

test("forwards API bodies and queries with only authoritative client headers", async () => {
    const response = await worker.fetch(
        request("/api/v1/photo-comparison/extractions?test=1", {
            method: "POST",
            body: "photo-body",
            headers: {
                "X-Forwarded-For": "198.51.100.9",
                Forwarded: "for=spoof",
                "X-Real-IP": "spoof",
                Authorization: "secret",
                Cookie: "tracking=1",
            },
        }),
        {
            PRIVATE_API: {
                async fetch(upstream) {
                    assert.equal(
                        upstream.url,
                        "http://lifegoods-backend:8000/api/v1/photo-comparison/extractions?test=1",
                    )
                    assert.equal(await upstream.text(), "photo-body")
                    assert.equal(
                        upstream.headers.get("X-Forwarded-For"),
                        "203.0.113.10",
                    )
                    for (const header of [
                        "Forwarded",
                        "X-Real-IP",
                        "CF-Connecting-IP",
                        "Authorization",
                        "Cookie",
                    ])
                        assert.equal(upstream.headers.get(header), null)
                    return new Response("ok", {
                        headers: {
                            "Cache-Control": "public",
                            "Set-Cookie": "private=1",
                        },
                    })
                },
            },
        },
    )
    assert.equal(response.headers.get("Cache-Control"), "no-store")
    assert.equal(response.headers.get("Set-Cookie"), null)
})

test("operational routes and encoded paths never reach the origin", async () => {
    for (const path of [
        "/api/health/ready",
        "/api/%68ealth/ready",
        "/docs",
        "/openapi.json",
        "/scalar",
        "/api/private",
    ]) {
        assert.equal((await worker.fetch(request(path), {})).status, 404)
    }
})

test("returns sanitized 502 on disconnected Tunnel or origin redirect", async () => {
    for (const fetch of [
        () => {
            throw new Error("private credential")
        },
        () =>
            new Response(null, {
                status: 302,
                headers: { Location: "http://private" },
            }),
    ]) {
        const response = await worker.fetch(
            request("/api/v1/products/search"),
            { PRIVATE_API: { fetch } },
        )
        assert.equal(response.status, 502)
        assert.equal((await response.json()).error.code, "backend_unavailable")
    }
})

test("rejects oversized requests without contacting the origin", async () => {
    const response = await worker.fetch(
        request("/api/v1/photo-comparison/extractions", {
            method: "POST",
            headers: { "Content-Length": String(32 * 1024 * 1024 + 1) },
        }),
        {},
    )
    assert.equal(response.status, 413)
})

test("accepts a near-limit request and leaves actual streaming limits to FastAPI", async () => {
    const response = await worker.fetch(
        request("/api/v1/photo-comparison/extractions", {
            method: "POST",
            body: new Uint8Array(32 * 1024 * 1024),
            headers: { "Content-Length": String(32 * 1024 * 1024) },
        }),
        {
            PRIVATE_API: {
                fetch: async (upstream) => {
                    assert.equal(
                        (await upstream.arrayBuffer()).byteLength,
                        32 * 1024 * 1024,
                    )
                    return new Response("ok")
                },
            },
        },
    )
    assert.equal(response.status, 200)
})

test("assets and deep links use the SPA asset binding", async () => {
    const response = await worker.fetch(request("/compare"), {
        ASSETS: { fetch: () => new Response("spa") },
    })
    assert.equal(await response.text(), "spa")
})
