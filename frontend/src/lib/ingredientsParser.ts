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

/**
 * Splits ingredient text intelligently while respecting nested parentheses and brackets,
 * accommodating OCR quirks like [SOJA) or decimal commas in percentages (e.g., 7,4%).
 */
export function splitIngredientClauses(text: string): string[] {
    const clauses: string[] = []
    let current = ""
    let depth = 0

    for (let i = 0; i < text.length; i++) {
        const char = text[i]

        if (char === "(" || char === "[" || char === "{") {
            depth++
            current += char
        } else if (char === ")" || char === "]" || char === "}") {
            if (depth > 0) depth--
            current += char
        } else if ((char === "," || char === ";") && depth === 0) {
            // Do not split if comma is decimal separator between digits (e.g. 7,4% or 6,6%)
            const prevChar = text[i - 1] || ""
            const nextChar = text[i + 1] || ""
            if (char === "," && /\d/.test(prevChar) && /\d/.test(nextChar)) {
                current += char
                continue
            }

            if (current.trim()) {
                clauses.push(current.trim())
            }
            current = ""
        } else if (char === "." && depth === 0) {
            // Do not split if period is decimal separator between digits (e.g. 7.4% or 6.6%)
            const prevChar = text[i - 1] || ""
            const nextChar = text[i + 1] || ""
            if (/\d/.test(prevChar) && /\d/.test(nextChar)) {
                current += char
                continue
            }

            // Check if period separates sentences/claims (e.g. "...vanilline. Sans gluten.")
            const remaining = text.slice(i + 1).trim()
            if (remaining.length > 0 && /^[A-ZÀ-ÖØ-ß]/.test(remaining)) {
                if (current.trim()) {
                    clauses.push(current.trim())
                }
                current = ""
            } else {
                current += char
            }
        } else {
            current += char
        }
    }

    if (current.trim()) {
        clauses.push(current.trim())
    }

    return clauses
}

/**
 * Formats an ingredient string into a clean title while preserving uppercase allergens
 */
export function formatIngredientName(name: string): string {
    let cleaned = name
        .trim()
        .replace(/^[-*•\s]+/, "")
        .replace(/[,.;]+$/, "")
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

    const rawClauses = splitIngredientClauses(rawText)
    const ingredients: ParsedIngredient[] = []
    const claims: string[] = []
    const allDetectedAllergens = new Set<string>()
    let hasPercentages = false

    // Regex to detect QUID percentages (e.g. 13%, 7,4 %, 0.5%)
    const percentageRegex = /\b(\d+(?:[.,]\d+)?\s*%)/

    rawClauses.forEach((clause, index) => {
        const rawClause = clause.trim()
        if (!rawClause) return

        // 1. Check if clause is a packaging claim or dietary note
        const isClaim = CLAIM_PATTERNS.some((pattern) =>
            pattern.test(rawClause),
        )
        if (isClaim) {
            claims.push(rawClause)
            return
        }

        const trimmed = rawClause.replace(/^[:,\s]+/, "").replace(/[,.;]+$/, "")
        if (!trimmed) return

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
        if (trimmed.includes(":") && !trimmed.startsWith("http")) {
            const [mainPart, ...subParts] = trimmed.split(":")
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
                if (inner.includes(",") || inner.includes(";")) {
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
            id: `ing-${index + 1}`,
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
