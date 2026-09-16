import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, chmodSync } from "node:fs"
import os from "node:os"
import path from "node:path"

const certificateDirectory = path.resolve("certs")
const keyPath = path.join(certificateDirectory, "life-goods-key.pem")
const certificatePath = path.join(certificateDirectory, "life-goods-cert.pem")
const force = process.argv.includes("--force")

if (!force && existsSync(keyPath) && existsSync(certificatePath)) {
    process.exit(0)
}

const addresses = Object.values(os.networkInterfaces())
    .flatMap((interfaces) => interfaces ?? [])
    .filter((address) => !address.internal && address.family === "IPv4")
    .map((address) => address.address)

const subjectAlternativeNames = [
    "DNS:localhost",
    "IP:127.0.0.1",
    ...addresses.map((address) => `IP:${address}`),
].join(",")

function findOpenSSL() {
    try {
        const command = process.platform === "win32" ? "where.exe" : "which"
        const result = execFileSync(command, ["openssl"], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
        })
            .trim()
            .split(/\r?\n/)[0]
        if (result) return result
    } catch {
        // Try common Windows Git installation locations below.
    }

    if (process.platform === "win32") {
        const candidates = [
            path.join(
                process.env.ProgramFiles ?? "",
                "Git/usr/bin/openssl.exe",
            ),
            path.join(
                process.env.ProgramFiles ?? "",
                "Git/mingw64/bin/openssl.exe",
            ),
        ]
        const installedPath = candidates.find((candidate) =>
            existsSync(candidate),
        )
        if (installedPath) return installedPath
    }

    throw new Error(
        "OpenSSL was not found. Install OpenSSL or Git for Windows, then run pnpm dev:https again.",
    )
}

mkdirSync(certificateDirectory, { recursive: true })
execFileSync(
    findOpenSSL(),
    [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-sha256",
        "-nodes",
        "-keyout",
        keyPath,
        "-out",
        certificatePath,
        "-days",
        "30",
        "-subj",
        "/CN=life-goods.local",
        "-addext",
        `subjectAltName=${subjectAlternativeNames}`,
    ],
    { stdio: "inherit" },
)
chmodSync(keyPath, 0o600)
console.log(
    `Created local HTTPS certificate for ${addresses.join(", ") || "localhost"}.`,
)
