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

mkdirSync(certificateDirectory, { recursive: true })
execFileSync(
    "openssl",
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
