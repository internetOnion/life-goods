import { readFile, readdir } from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const root = process.cwd()
const sourceRoot = path.join(root, "src")
const violations = []

async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
        const filePath = path.join(directory, entry.name)
        if (entry.isDirectory()) {
            if (entry.name !== "generated")
                files.push(...(await walk(filePath)))
        } else {
            files.push(filePath)
        }
    }
    return files
}

const sourceFiles = await walk(sourceRoot)
const cssFiles = sourceFiles.filter((filePath) =>
    /\.(css|scss|sass|less)$/.test(filePath),
)
if (
    cssFiles.length !== 1 ||
    cssFiles[0] !== path.join(sourceRoot, "styles.css")
) {
    violations.push("Only src/styles.css may contain stylesheet rules.")
}

for (const filePath of sourceFiles.filter((file) =>
    /\.(ts|tsx|js|jsx)$/.test(file),
)) {
    const source = await readFile(filePath, "utf8")
    const relativePath = path.relative(root, filePath).split(path.sep).join("/")
    if (
        !relativePath.startsWith("src/components/ui/") &&
        /<(?:button|input|textarea|select)\b/.test(source)
    ) {
        violations.push(
            `${relativePath}: use the corresponding shadcn UI primitive instead of raw controls.`,
        )
    }
    if (/\bstyle\s*=/.test(source)) {
        violations.push(`${relativePath}: inline style props are not allowed.`)
    }
    if (/\.style\s*(?:\.|\[)/.test(source)) {
        violations.push(
            `${relativePath}: direct element.style mutations are not allowed.`,
        )
    }
    if (
        /from\s+["'][^"']+\.css["']/.test(source) &&
        !relativePath.endsWith("src/main.tsx")
    ) {
        violations.push(
            `${relativePath}: CSS imports are only allowed from src/main.tsx.`,
        )
    }
}

const stylesheet = await readFile(path.join(sourceRoot, "styles.css"), "utf8")
if (/^\s*\.[A-Za-z_][\w-]*/m.test(stylesheet)) {
    violations.push(
        "src/styles.css: component class selectors are not allowed; use Tailwind utilities.",
    )
}

if (violations.length > 0) {
    console.error(violations.join("\n"))
    process.exitCode = 1
} else {
    console.log("Frontend styling policy passed.")
}
