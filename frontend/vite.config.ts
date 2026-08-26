import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { defineConfig } from "vitest/config"

const certificateDirectory = path.resolve(__dirname, "./certs")
const keyPath = path.join(certificateDirectory, "life-goods-key.pem")
const certificatePath = path.join(certificateDirectory, "life-goods-cert.pem")
const hasCertificate = existsSync(keyPath) && existsSync(certificatePath)

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: "0.0.0.0",
        ...(hasCertificate
            ? {
                  https: {
                      key: readFileSync(keyPath),
                      cert: readFileSync(certificatePath),
                  },
              }
            : {}),
        proxy: {
            "/api": "http://127.0.0.1:8000",
        },
    },
    test: {
        environment: "jsdom",
        setupFiles: "./tests/setup.ts",
        exclude: ["e2e/**", "node_modules/**"],
    },
})
