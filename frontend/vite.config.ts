import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { readFileSync } from "node:fs"
import path from "node:path"
import { defineConfig } from "vitest/config"

const certificateDirectory = path.resolve(__dirname, "./certs")
const keyPath = path.join(certificateDirectory, "life-goods-key.pem")
const certificatePath = path.join(certificateDirectory, "life-goods-cert.pem")

export default defineConfig(({ mode }) => ({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: "0.0.0.0",
        ...(mode === "https"
            ? {
                  https: {
                      key: readFileSync(keyPath),
                      cert: readFileSync(certificatePath),
                  },
              }
            : {}),
        proxy: {
            "/api/experimental/photo-comparison": {
                target:
                    process.env.VITE_PHOTO_COMPARISON_API_URL ||
                    "http://127.0.0.1:8765",
            },
            "/api": "http://127.0.0.1:8000",
        },
    },
    test: {
        environment: "jsdom",
        setupFiles: "./tests/setup.ts",
    },
}))
