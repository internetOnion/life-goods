const MAX_UPLOAD_BYTES = 32 * 1024 * 1024
const BLOCKED =
    /^\/(?:api\/health(?:\/|$)|docs(?:\/|$)|redoc(?:\/|$)|scalar(?:\/|$)|openapi\.json(?:\/|$))/i

function failure(status, code, message) {
    return Response.json(
        { error: { code, message } },
        {
            status,
            headers: {
                "Cache-Control": "no-store",
                "X-Content-Type-Options": "nosniff",
            },
        },
    )
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url)
        // Decode before filtering so encoded operational paths cannot bypass it.
        let path
        try {
            path = decodeURIComponent(url.pathname)
        } catch {
            return failure(400, "invalid_path", "Invalid request path.")
        }
        if (BLOCKED.test(path)) return failure(404, "not_found", "Not found.")
        if (!path.startsWith("/api/")) return env.ASSETS.fetch(request)
        if (
            !path.startsWith("/api/v1/") &&
            path !== "/api/experimental/ingredient-matches"
        ) {
            return failure(404, "not_found", "Not found.")
        }
        if (!["GET", "POST", "OPTIONS", "HEAD"].includes(request.method)) {
            return failure(405, "method_not_allowed", "Method not allowed.")
        }
        const size = Number(request.headers.get("content-length"))
        if (size > MAX_UPLOAD_BYTES) {
            return failure(
                413,
                "size_limit_exceeded",
                "The upload request must be 32 MiB or smaller.",
            )
        }
        const headers = new Headers(request.headers)
        // Only Cloudflare's ingress-supplied client address is authoritative.
        const client = request.headers.get("CF-Connecting-IP")
        for (const name of [...headers.keys()]) {
            if (
                /^(?:x-forwarded-|x-real-ip$|forwarded$|cf-|true-client-ip$|authorization$|cookie$|host$|connection$|proxy-)/i.test(
                    name,
                )
            ) {
                headers.delete(name)
            }
        }
        // Fail closed rather than grouping unidentified clients under a spoofable address.
        if (!client || !/^[0-9a-f:.]+$/i.test(client)) {
            return failure(
                502,
                "backend_unavailable",
                "Service temporarily unavailable.",
            )
        }
        headers.set("X-Forwarded-For", client)
        headers.set("X-Forwarded-Proto", "https")
        url.protocol = "http:"
        url.hostname = "lifegoods-backend"
        url.port = "8000"
        try {
            const upstream = await env.PRIVATE_API.fetch(
                new Request(url, {
                    method: request.method,
                    headers,
                    body: ["GET", "HEAD"].includes(request.method)
                        ? undefined
                        : request.body,
                    redirect: "manual",
                    signal: AbortSignal.timeout(65000),
                    duplex: "half",
                }),
            )
            // Never expose origin redirects or cookies; this anonymous API has no login.
            if (upstream.status >= 300 && upstream.status < 400) {
                return failure(
                    502,
                    "backend_unavailable",
                    "Service temporarily unavailable.",
                )
            }
            const responseHeaders = new Headers(upstream.headers)
            responseHeaders.set("Cache-Control", "no-store")
            responseHeaders.delete("Set-Cookie")
            return new Response(upstream.body, {
                status: upstream.status,
                headers: responseHeaders,
            })
        } catch {
            return failure(
                502,
                "backend_unavailable",
                "Service temporarily unavailable.",
            )
        }
    },
}
