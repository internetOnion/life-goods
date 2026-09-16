import { spawn } from "node:child_process"

const composeArguments = [
    "compose",
    "-f",
    "infra/compose.yaml",
    "exec",
    "-T",
    "redis",
    "redis-cli",
    "FLUSHDB",
]

console.log("Resetting the local Redis database used by Life Goods...")

const child = spawn("docker", composeArguments, {
    cwd: process.cwd(),
    stdio: "inherit",
})

let spawnFailed = false

child.once("error", (error) => {
    spawnFailed = true
    console.error(`Could not run Docker Compose: ${error.message}`)
})

child.once("close", (code, signal) => {
    if (spawnFailed) {
        process.exitCode = 1
        return
    }

    if (signal) {
        console.error(`Redis reset was interrupted by ${signal}.`)
        process.exitCode = 1
        return
    }

    process.exitCode = code ?? 1
})
