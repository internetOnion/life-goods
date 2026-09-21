/**
 * Ingredients text parsing, allergen detection, and formatting utilities.
 * Handles complex food packaging conventions: QUID percentages, nested sub-ingredients,
 * regulatory allergen emphasis (ALL CAPS, brackets), and packaging claims.
 */

export interface ParsedIngredient {
    id: string
    raw: string
    name: string
    percentage?: string | null
    subIngredients?: string[]
    allergens: string[]
    isAllergen: boolean
}

export interface ParsedIngredientsResult {
    ingredients: ParsedIngredient[]
    claims: string[]
    allergensDetected: string[]
    hasPercentages: boolean
    totalCount: number
}

// Common allergen dictionary across languages with normalized category labels
const ALLERGEN_KEYWORDS: Record<string, string[]> = {
    "Gluten / Cereals": [
        "gluten",
        "ble",
        "blé",
        "wheat",
        "weizen",
        "trigo",
        "frumento",
        "orge",
        "barley",
        "gerste",
        "cebada",
        "avoine",
        "oat",
        "oats",
        "hafer",
        "avena",
        "seigle",
        "rye",
        "roggen",
        "centeno",
        "epeautre",
        "épeautre",
        "spelt",
        "dinkel",
        "kamut",
        "farro",
    ],
    "Milk / Dairy": [
        "lait",
        "milk",
        "milch",
        "melk",
        "leche",
        "latte",
        "lactoserum",
        "lactosérum",
        "lactose",
        "whey",
        "beurre",
        "butter",
        "boter",
        "fromage",
        "cheese",
        "kaese",
        "käse",
        "queso",
        "formaggio",
        "creme",
        "crème",
        "cream",
        "rahm",
        "nata",
        "panna",
        "casein",
        "caséine",
    ],
    "Tree Nuts": [
        "noisette",
        "noisettes",
        "hazelnut",
        "hazelnuts",
        "hazelnoten",
        "haselnuss",
        "haselnüsse",
        "amande",
        "amandes",
        "almond",
        "almonds",
        "mandel",
        "mandeln",
        "almendra",
        "almendras",
        "mandorla",
        "mandorle",
        "noix",
        "walnut",
        "walnuts",
        "walnuss",
        "walnüsse",
        "nuez",
        "noci",
        "cajou",
        "cashew",
        "cashews",
        "pistache",
        "pistaches",
        "pistachio",
        "pistachios",
        "pistazie",
        "pistazien",
        "pecan",
        "pécan",
        "macadamia",
        "brazil nut",
    ],
    Peanuts: [
        "arachide",
        "arachides",
        "peanut",
        "peanuts",
        "erdnuss",
        "erdnüsse",
        "cacahuete",
        "cacahuetes",
        "nocciolina",
        "noccioline",
    ],
    Soybeans: [
        "soja",
        "soya",
        "soy",
        "soybean",
        "soybeans",
        "sojabohne",
        "sojabohnen",
    ],
    Eggs: [
        "oeuf",
        "oeufs",
        "œuf",
        "œufs",
        "egg",
        "eggs",
        "ei",
        "eier",
        "huevo",
        "huevos",
        "uovo",
        "uova",
        "albumen",
        "ovalbumin",
    ],
    Fish: [
        "poisson",
        "poissons",
        "fish",
        "fisch",
        "fische",
        "pescado",
        "pesce",
        "saumon",
        "salmon",
        "thon",
        "tuna",
        "morue",
        "cod",
    ],
    Crustaceans: [
        "crustace",
        "crustacé",
        "crustacés",
        "crustacean",
        "crustaceans",
        "crevette",
        "shrimp",
        "prawn",
        "krabbe",
        "gambas",
        "homard",
        "lobster",
    ],
    Molluscs: [
        "mollusque",
        "mollusques",
        "mollusc",
        "molluscs",
        "mollusken",
        "moule",
        "mussel",
        "huitre",
        "huître",
        "oyster",
        "calmar",
        "squid",
    ],
    Sesame: ["sesame", "sésame", "sesamsamen", "sesamo", "sésamo"],
    Mustard: ["moutarde", "mustard", "senf", "mostaza", "senape"],
    Celery: ["celeri", "céleri", "celery", "sellerie", "apio", "sedano"],
    Lupin: ["lupin", "lupine", "lupinen", "lupini"],
    Sulfites: [
        "sulfite",
        "sulfites",
        "sulphite",
        "sulphites",
        "schwefeldioxid",
        "sulfur dioxide",
        "dioxyde de soufre",
    ],
}

// Patterns that identify packaging claims or dietary disclaimers rather than ingredients
const CLAIM_PATTERNS = [
    /^(sans\s+gluten|gluten\s*free|glutenfrei|sin\s+gluten|senza\s+glutine|glutenvrij)\.?$/i,
    /^(sans\s+(?:huile\s+de\s+palme|conservateurs?|colorants?|sucres?\s+ajoutes?|ogm|aromes?\s+artificiels?))\.?$/i,
    /^(peut\s+contenir|may\s+contain|kann\s+spuren\s+enthalten|puede\s+contener|puo\s+contenere).+$/i,
    /^(all[eé]rg[eè]nes?\s*:).+$/i,
    /^(en\s+gras|in\s+bold|fettgedruckt).+$/i,
    /^(traces?\s+[eé]ventuelles?\s*:).+$/i,
    /^(ingr[eé]dients?\s+issus\s+de\s+l['']agriculture\s+biologique).+$/i,
]

/**
 * Normalizes strings by removing accents and lowercasing for fuzzy matching
 */
function normalizeWord(word: string): string {
    return word
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w]/g, "")
}

/**
 * Checks if a word or phrase represents a declared allergen
 */
export function detectAllergensInText(
    text: string,
    knownTags: string[] = [],
): string[] {
    const detected = new Set<string>()
    const clean = text.replace(/[[\](),.:;]/g, " ")
    const words = clean.split(/\s+/).filter(Boolean)

    // 1. Check for regulatory ALL CAPS words (length >= 3, e.g. NOISETTES, LAIT, SOJA)
    for (const word of words) {
        if (
            word.length >= 3 &&
            word === word.toUpperCase() &&
            !/^\d+$/.test(word) &&
            !/^E\d{3}[A-Z]?$/.test(word) // skip E-numbers like E322
        ) {
            const norm = normalizeWord(word)
            let foundCategory = false
            for (const [category, keywords] of Object.entries(
                ALLERGEN_KEYWORDS,
            )) {
                if (
                    keywords.some(
                        (k) =>
                            norm.includes(normalizeWord(k)) ||
                            normalizeWord(k).includes(norm),
                    )
                ) {
                    detected.add(category)
                    foundCategory = true
                    break
                }
            }
            if (!foundCategory && norm.length >= 3) {
                const displayWord =
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                detected.add(displayWord)
            }
        }
    }

    // 2. Check against keyword dictionary
    const normalizedText = normalizeWord(text)
    for (const [category, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
        for (const kw of keywords) {
            const normKw = normalizeWord(kw)
            const regex = new RegExp(`\\b${normKw}\\b`, "i")
            if (regex.test(normalizedText)) {
                detected.add(category)
                break
            }
        }
    }

    // 3. If knownTags are provided, also check if any tag maps to text inside this clause
    if (knownTags.length > 0) {
        for (const tag of knownTags) {
            const cleanTag = normalizeWord(tag.replace(/^[a-z]{2}:/, ""))
            if (cleanTag.length >= 3 && normalizedText.includes(cleanTag)) {
                for (const [category, keywords] of Object.entries(
                    ALLERGEN_KEYWORDS,
                )) {
                    if (keywords.some((k) => normalizeWord(k) === cleanTag)) {
                        detected.add(category)
                    }
                }
            }
        }
    }

    return Array.from(detected)
}

// Characters that separate top-level list items on packaging: ASCII, bullets,
// newlines, Khmer (។ ៕), CJK (、，；。) and Arabic (،) punctuation.
const TOP_LEVEL_SEPARATORS = new Set([
    ",",
    ";",
    "•",
    "●",
    "·",
    "▪",
    "■",
    "‣",
    "◦",
    "|",
    "\n",
    "\r",
    "។",
    "៕",
    "、",
    "，",
    "；",
    "。",
    "،",
])

// Clauses longer than this that still contain separators are assumed to be the
// victim of an unclosed bracket and are re-split without depth tracking.
const UNBALANCED_CLAUSE_LENGTH = 80

/**
 * Section headers that appear inside packaging text. Order matters: longer
 * phrases ("may contain", "អាចមានផ្ទុក") must precede their suffixes.
 */
const SECTION_HEADER_REGEX =
    /(?<!\p{L})(?:(?<mayContain>may\s+contain|peut\s+contenir|kann\s+spuren\s+enthalten|puede\s+contener|pu[oò]\s+contenere|traces?\s+(?:[eé]ventuelles?\s+)?(?:of|de)|អាចមានផ្ទុក|អាចមាន)\s*[:៖]?|(?<contains>contains|contient|enth[aä]lt|contiene|allerg[eè]nes?|allergens?|allergy\s+advice|មានផ្ទុក|មាន)\s*[:៖]|(?<ingredients>ingredients?|ingr[eé]dients?|zutaten|ingredientes|ingredienti|គ្រឿងផ្សំ)\s*[:៖])(?!\p{L})/giu

export type IngredientSectionKind = "ingredients" | "contains" | "mayContain"

export interface IngredientSection {
    kind: IngredientSectionKind
    /** Section body without its header. */
    body: string
    /** Header + body as written on the label, trimmed of trailing separators. */
    text: string
}

function trimSeparators(text: string): string {
    return text
        .replace(/^[\s•●·▪■‣◦|,;:៖។៕、，；。،.-]+/u, "")
        .replace(/[\s•●·▪■‣◦|,;:៖។៕、，；。،.]+$/u, "")
}

/**
 * Splits packaging text into "ingredients", "contains" and "may contain" sections
 * so allergen statements never leak into the ingredient rows.
 */
export function segmentIngredientSections(text: string): IngredientSection[] {
    const sections: IngredientSection[] = []
    const matches = Array.from(text.matchAll(SECTION_HEADER_REGEX))

    const pushSection = (
        kind: IngredientSectionKind,
        start: number,
        bodyStart: number,
        end: number,
    ) => {
        const body = trimSeparators(text.slice(bodyStart, end))
        const full = trimSeparators(text.slice(start, end))
        if (!body) return
        sections.push({ kind, body, text: full })
    }

    const firstStart = matches[0]?.index ?? text.length
    pushSection("ingredients", 0, 0, firstStart)

    matches.forEach((match, i) => {
        const start = match.index ?? 0
        const end = matches[i + 1]?.index ?? text.length
        const groups = match.groups ?? {}
        const kind: IngredientSectionKind = groups.mayContain
            ? "mayContain"
            : groups.contains
              ? "contains"
              : "ingredients"
        pushSection(kind, start, start + match[0].length, end)
    })

    return sections
}

function isDecimalSeparator(text: string, i: number): boolean {
    const prevChar = text[i - 1] || ""
    const nextChar = text[i + 1] || ""
    return /\d/.test(prevChar) && /\d/.test(nextChar)
}

function splitClauses(
    text: string,
    respectDepth: boolean,
): { clauses: string[]; unbalanced: boolean } {
    const clauses: string[] = []
    let current = ""
    let depth = 0

    const flush = () => {
        if (current.trim()) {
            clauses.push(current.trim())
        }
        current = ""
    }

    for (let i = 0; i < text.length; i++) {
        const char = text[i] as string
        const atTopLevel = !respectDepth || depth === 0

        if (char === "(" || char === "[" || char === "{") {
            depth++
            current += char
        } else if (char === ")" || char === "]" || char === "}") {
            if (depth > 0) depth--
            current += char
        } else if (TOP_LEVEL_SEPARATORS.has(char) && atTopLevel) {
            // Do not split if comma is decimal separator between digits (e.g. 7,4% or 6,6%)
            if (char === "," && isDecimalSeparator(text, i)) {
                current += char
                continue
            }
            flush()
        } else if (
            char === "*" &&
            atTopLevel &&
            /^\s*$/.test(text[i - 1] || "") &&
            /^\s*$/.test(text[i + 1] || "")
        ) {
            // "*" used as a bullet between items, not as a footnote marker
            flush()
        } else if (char === "." && atTopLevel) {
            // Do not split if period is decimal separator between digits (e.g. 7.4% or 6.6%)
            if (isDecimalSeparator(text, i)) {
                current += char
                continue
            }

            // A period followed by a capital or a non-cased script (Khmer, CJK)
            // separates sentences/claims (e.g. "...vanilline. Sans gluten."),
            // while "vit. C"-style abbreviations followed by lowercase do not.
            const remaining = text.slice(i + 1).trim()
            if (
                remaining.length > 0 &&
                /^\p{L}/u.test(remaining) &&
                !/^\p{Ll}/u.test(remaining)
            ) {
                flush()
            } else {
                current += char
            }
        } else {
            current += char
        }
    }

    flush()
    return { clauses, unbalanced: depth > 0 }
}

function hasTopLevelSeparator(text: string): boolean {
    return Array.from(text).some((char) => TOP_LEVEL_SEPARATORS.has(char))
}

/**
 * Splits ingredient text intelligently while respecting nested parentheses and brackets,
 * accommodating OCR quirks like [SOJA) or decimal commas in percentages (e.g., 7,4%).
 * Bullets, newlines and Khmer/CJK punctuation count as list separators too. When a
 * bracket is never closed, long clauses swallowed by it are re-split ignoring depth.
 */
export function splitIngredientClauses(text: string): string[] {
    const { clauses, unbalanced } = splitClauses(text, true)
    if (!unbalanced) return clauses
    return clauses.flatMap((clause) =>
        clause.length > UNBALANCED_CLAUSE_LENGTH && hasTopLevelSeparator(clause)
            ? splitClauses(clause, false).clauses
            : [clause],
    )
}

/**
 * OCR/translation quirk: a clause opened with "(" but closed with "]" or "}",
 * e.g. "sugar (glucose (sulphite)]". Swap the stray closer for ")" so the
 * parenthesised sub-ingredient regex can still match.
 */
function repairTrailingBracket(clause: string): string {
    if (!/[\]}]$/.test(clause)) return clause
    const opens = (clause.match(/\(/g) ?? []).length
    const closes = (clause.match(/\)/g) ?? []).length
    return opens > closes ? `${clause.slice(0, -1)})` : clause
}

/**
 * Formats an ingredient string into a clean title while preserving uppercase allergens
 */
export function formatIngredientName(name: string): string {
    let cleaned = name
        .trim()
        .replace(/^[-*•●\s]+/, "")
        .replace(/[,.;។]+$/, "")
    // Normalize mismatched brackets: [SOJA) -> (SOJA)
    cleaned = cleaned.replace(/\[([^\]]+)\)/g, "($1)")
    cleaned = cleaned.replace(/\(([^)]+)\]/g, "($1)")
    return cleaned
}

/**
 * Parses full raw ingredient text into structured ingredient records,
 * separating dietary claims and highlighting percentages & allergens.
 */
export function parseIngredients(
    rawText: string,
    options: { allergenTags?: string[] } = {},
): ParsedIngredientsResult {
    if (!rawText || !rawText.trim()) {
        return {
            ingredients: [],
            claims: [],
            allergensDetected: [],
            hasPercentages: false,
            totalCount: 0,
        }
    }

    const sections = segmentIngredientSections(rawText)
    const ingredients: ParsedIngredient[] = []
    const claims: string[] = []
    const seenRows = new Set<string>()
    const seenClaims = new Set<string>()
    const allDetectedAllergens = new Set<string>()
    let hasPercentages = false

    const normalizeKey = (value: string) =>
        value.toLowerCase().replace(/\s+/g, " ").trim()
    const addClaim = (claim: string) => {
        const key = normalizeKey(claim)
        if (!key || seenClaims.has(key)) return
        seenClaims.add(key)
        claims.push(claim)
    }

    // "Contains:" / "May contain:" statements are declarations, not ingredients.
    const rawClauses = sections.flatMap((section) => {
        if (section.kind !== "ingredients") {
            addClaim(section.text)
            return []
        }
        return splitIngredientClauses(section.body)
    })

    // Regex to detect QUID percentages (e.g. 13%, 7,4 %, 0.5%)
    const percentageRegex = /\b(\d+(?:[.,]\d+)?\s*%)/

    rawClauses.forEach((clause) => {
        const rawClause = clause.trim()
        if (!rawClause) return

        // 1. Check if clause is a packaging claim or dietary note
        const isClaim = CLAIM_PATTERNS.some((pattern) =>
            pattern.test(rawClause),
        )
        if (isClaim) {
            addClaim(rawClause)
            return
        }

        const trimmed = repairTrailingBracket(
            rawClause.replace(/^[:៖,\s]+/, "").replace(/[,.;។]+$/, ""),
        )
        if (!trimmed) return

        // Duplicated label text (a common OCR artefact) must not duplicate rows.
        const rowKey = normalizeKey(trimmed)
        if (seenRows.has(rowKey)) return
        seenRows.add(rowKey)

        // 2. Extract percentage if present
        const percentMatch = trimmed.match(percentageRegex)
        const percentage =
            percentMatch && percentMatch[1]
                ? percentMatch[1].replace(/\s+/g, "")
                : null
        if (percentage) {
            hasPercentages = true
        }

        // 3. Extract sub-ingredients if colon or parenthesis present
        let subIngredients: string[] | undefined
        let primaryName = trimmed

        // Case A: Colons (e.g. "émulsifiants: lécithines [SOJA)")
        if (/[:៖]/.test(trimmed) && !trimmed.startsWith("http")) {
            const [mainPart, ...subParts] = trimmed.split(/[:៖]/)
            primaryName = (mainPart ?? trimmed).trim()
            const subStr = subParts.join(":").trim()
            if (subStr) {
                subIngredients = splitIngredientClauses(subStr).map((s) =>
                    formatIngredientName(s),
                )
            }
        }
        // Case B: Parentheses (e.g. "céréale 50,7 % (farine de BLÉ 35 %, farine complète...)")
        else {
            const parenMatch = trimmed.match(/^([^()]+)\s*\((.+)\)$/)
            if (parenMatch && parenMatch[1] && parenMatch[2]) {
                primaryName = parenMatch[1].trim()
                const inner = parenMatch[2].trim()
                if (hasTopLevelSeparator(inner)) {
                    subIngredients = splitIngredientClauses(inner).map((s) =>
                        formatIngredientName(s),
                    )
                } else {
                    subIngredients = [formatIngredientName(inner)]
                }
            }
        }

        // 4. Detect allergens in the clause
        const allergens = detectAllergensInText(clause, options.allergenTags)
        allergens.forEach((a) => allDetectedAllergens.add(a))

        // 5. Clean primary name: remove explicit percentage from primary name if already captured
        let cleanName = primaryName
        if (percentage) {
            cleanName = cleanName
                .replace(percentageRegex, "")
                .replace(/\s{2,}/g, " ")
                .trim()
        }
        cleanName = formatIngredientName(cleanName)

        ingredients.push({
            id: `ing-${ingredients.length + 1}`,
            raw: trimmed,
            name: cleanName || primaryName,
            percentage,
            subIngredients:
                subIngredients && subIngredients.length > 0
                    ? subIngredients
                    : undefined,
            allergens,
            isAllergen: allergens.length > 0,
        })
    })

    return {
        ingredients,
        claims,
        allergensDetected: Array.from(allDetectedAllergens),
        hasPercentages,
        totalCount: ingredients.length,
    }
}

/**
 * Token for rich rendering of the raw paragraph text with highlighted segments
 */
export interface TextToken {
    text: string
    type: "text" | "allergen" | "percentage" | "punctuation"
    label?: string
}

/**
 * Breaks down raw ingredient text into rich tokens for interactive label rendering
 */
export function tokenizeIngredientText(
    text: string,
    allergenTags: string[] = [],
): TextToken[] {
    if (!text) return []

    const regex = /(\d+(?:[.,]\d+)?\s*%|[A-Za-zÀ-ÖØ-öø-ÿ\d]+|[^\s\w]+|\s+)/gu
    const tokens: TextToken[] = []
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
        const raw = match[0]

        // Check percentage
        if (/^\d+(?:[.,]\d+)?\s*%$/.test(raw)) {
            tokens.push({
                text: raw,
                type: "percentage",
                label: "QUID Percentage",
            })
            continue
        }

        // Check punctuation
        if (/^[^\s\w]+$/.test(raw)) {
            tokens.push({
                text: raw,
                type: "punctuation",
            })
            continue
        }

        // Check whitespace
        if (/^\s+$/.test(raw)) {
            tokens.push({
                text: raw,
                type: "text",
            })
            continue
        }

        // Check word for allergen
        const norm = normalizeWord(raw)
        const isUpper =
            raw.length >= 3 && raw === raw.toUpperCase() && !/^\d+$/.test(raw)

        let matchedCategory: string | null = null

        for (const [category, keywords] of Object.entries(ALLERGEN_KEYWORDS)) {
            if (keywords.some((kw) => normalizeWord(kw) === norm)) {
                matchedCategory = category
                break
            }
        }

        if (!matchedCategory && allergenTags.length > 0) {
            for (const tag of allergenTags) {
                const cleanTag = normalizeWord(tag.replace(/^[a-z]{2}:/, ""))
                if (
                    cleanTag &&
                    (norm.includes(cleanTag) || cleanTag.includes(norm))
                ) {
                    matchedCategory = "Allergen"
                    break
                }
            }
        }

        if (!matchedCategory && isUpper) {
            matchedCategory = "Allergen"
        }

        if (matchedCategory) {
            tokens.push({
                text: raw,
                type: "allergen",
                label: matchedCategory,
            })
        } else {
            tokens.push({
                text: raw,
                type: "text",
            })
        }
    }

    return tokens
}
