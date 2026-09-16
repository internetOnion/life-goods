import { readFile, writeFile, rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

const root = fileURLToPath(new URL("../", import.meta.url))
const configPath = fileURLToPath(
    new URL("../infra/cloudflare/wrangler.generated.json", import.meta.url),
)
const serviceId = process.env.LIFEGOODS_VPC_SERVICE_ID
if (
    !serviceId ||
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(serviceId) ||
    /^0{8}-/.test(serviceId)
) {
    throw new Error(
        "Set LIFEGOODS_VPC_SERVICE_ID to the staging HTTP VPC service ID.",
    )
}
const config = JSON.parse(
    (await readFile(
        new URL("../infra/cloudflare/wrangler.jsonc", import.meta.url),
        "utf8",
    )).replace(/,\s*([}\]])/g, "$1"),
)
config.vpc_services[0].service_id = serviceId
await writeFile(configPath, JSON.stringify(config, null, 2))
try {
    const result = spawnSync(
        process.platform === "win32" ? "pnpm.cmd" : "pnpm",
        [
            "exec",
            "wrangler",
            "deploy",
            "--config",
            configPath,
            ...process.argv.slice(2),
        ],
        { cwd: root, stdio: "inherit", shell: process.platform === "win32" },
    )
    if (result.error) throw result.error
    process.exitCode = result.status ?? 1
} finally {
    await rm(configPath, { force: true })
}
