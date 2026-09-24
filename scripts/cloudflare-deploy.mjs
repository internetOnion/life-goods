import { readFile, writeFile, rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

// Usage: node scripts/cloudflare-deploy.mjs --target staging|production [wrangler args]
const WORKER_NAMES = { staging: "lifegoods-staging", production: "lifegoods" }
// Separate variables so a production deploy can never pick up the staging backend.
const SERVICE_ID_VARIABLES = {
    staging: "LIFEGOODS_VPC_SERVICE_ID",
    production: "LIFEGOODS_PRODUCTION_VPC_SERVICE_ID",
}
const args = process.argv.slice(2)
const targetIndex = args.indexOf("--target")
const target = targetIndex === -1 ? undefined : args[targetIndex + 1]
if (!target || !(target in WORKER_NAMES)) {
    throw new Error("Pass --target staging or --target production.")
}
args.splice(targetIndex, 2)

const root = fileURLToPath(new URL("../", import.meta.url))
const configPath = fileURLToPath(
    new URL("../infra/cloudflare/wrangler.generated.json", import.meta.url),
)
const serviceIdVariable = SERVICE_ID_VARIABLES[target]
const serviceId = process.env[serviceIdVariable]
if (
    !serviceId ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(serviceId) ||
    /^0{8}-/.test(serviceId)
) {
    throw new Error(
        `Set ${serviceIdVariable} to the ${target} HTTP VPC service ID.`,
    )
}
const config = JSON.parse(
    (await readFile(
        new URL("../infra/cloudflare/wrangler.jsonc", import.meta.url),
        "utf8",
    )).replace(/,\s*([}\]])/g, "$1"),
)
config.name = WORKER_NAMES[target]
config.vpc_services[0].service_id = serviceId
await writeFile(configPath, JSON.stringify(config, null, 2))
try {
    const result = spawnSync(
        process.platform === "win32" ? "pnpm.cmd" : "pnpm",
        ["exec", "wrangler", "deploy", "--config", configPath, ...args],
        { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
    )
    if (result.error) throw result.error
    process.exitCode = result.status ?? 1
} finally {
    await rm(configPath, { force: true })
}
