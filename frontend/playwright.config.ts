import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    use: {
        baseURL: "http://127.0.0.1:4173",
        trace: "retain-on-failure",
    },
    webServer: [
        {
            command:
                "UV_CACHE_DIR=/private/tmp/lifegoods-uv-cache uv run --project ../backend python ../backend/scripts/run_e2e_server.py",
            port: 8000,
            reuseExistingServer: !process.env.CI,
        },
        {
            command: "./node_modules/.bin/vite --host 127.0.0.1 --port 4173",
            port: 4173,
            reuseExistingServer: !process.env.CI,
        },
    ],
    projects: [{ name: "mobile-chromium", use: { ...devices["Pixel 5"] } }],
})
