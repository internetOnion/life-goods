import { describe, expect, test } from "vitest"

import {
    parseIngredients,
    segmentIngredientSections,
    splitIngredientClauses,
} from "../src/lib/ingredientsParser"

// Khmer translation from a real bug report: bullet-delimited, Khmer full stops,
// "Contains:" / "May contain:" sections and the whole list repeated once.
const KHMER_LABEL =
    "អង្ករ ប្រេងដូង (មានផ្ទុក TBHQ) • ស្ករ (ស្ករស, គ្លុយកូស (ស៊ុលភីត)] • ម្សៅទឹកស៊ីអ៊ីវ (សណ្តែកសៀង, ស្រូវសាលី, ម៉ាល់តូដេកស្ត្រីន, អំបិល) • អំបិល • ម៉ូណូសូដ្យូមគ្លុយតាម៉ាត។ • • មានផ្ទុក៖ សណ្តែកសៀង ស្រូវសាលី ស៊ុលភីត។ អាចមានផ្ទុក៖ ស៊ុត ទឹកដោះគោ ត្រី សត្វសំបករឹង គ្រឿងសមុទ្រសំបករឹង គ្រាប់សណ្តែកដី។ គ្រឿងផ្សំ៖ អង្ករ ប្រេងដូង (មានផ្ទុក TBHQ) • ស្ករ (ស្ករស, គ្លុយកូស (ស៊ុលភីត)) • ម្សៅទឹកស៊ីអ៊ីវ (សណ្តែកសៀង, ស្រូវសាលី, ម៉ាល់តូដេកស្ត្រីន, អំបិល) • អំបិល • ម៉ូណូសូដ្យូមគ្លុយតាម៉ាត។ • • • មានផ្ទុក៖ សណ្តែកសៀង។ ស្រូវសាលី។ ស៊ុលភីត។ អាចមានផ្ទុក៖ ស៊ុត។ ទឹកដោះគោ។ •"

describe("splitIngredientClauses", () => {
    test("keeps the comma behaviour with nested brackets and decimal commas", () => {
        expect(
            splitIngredientClauses(
                "Sucre, huile de palme, NOISETTES 13%, lait écrémé en poudre 8,7 %, cacao maigre 7,4% (cacao, sucre)",
            ),
        ).toEqual([
            "Sucre",
            "huile de palme",
            "NOISETTES 13%",
            "lait écrémé en poudre 8,7 %",
            "cacao maigre 7,4% (cacao, sucre)",
        ])
    })

    test("splits on bullets and newlines", () => {
        expect(
            splitIngredientClauses(
                "Rice • Coconut oil (contains TBHQ) • Sugar\nSalt ● Monosodium glutamate",
            ),
        ).toEqual([
            "Rice",
            "Coconut oil (contains TBHQ)",
            "Sugar",
            "Salt",
            "Monosodium glutamate",
        ])
    })

    test("splits on Khmer full stops and periods before Khmer letters", () => {
        expect(splitIngredientClauses("អង្ករ។ ស្ករ។ អំបិល. ត្រី")).toEqual([
            "អង្ករ",
            "ស្ករ",
            "អំបិល",
            "ត្រី",
        ])
    })

    test("does not split abbreviations followed by lowercase or decimals", () => {
        expect(splitIngredientClauses("vit. c 0.5%, sugar")).toEqual([
            "vit. c 0.5%",
            "sugar",
        ])
    })

    test("recovers from an unclosed bracket", () => {
        const clauses = splitIngredientClauses(
            "Sugar, emulsifier: lecithins [SOJA, cocoa mass, skimmed milk powder, hazelnuts, vanilla flavouring, salt, whey powder",
        )
        expect(clauses.length).toBeGreaterThan(3)
        expect(clauses).toContain("salt")
    })
})

describe("segmentIngredientSections", () => {
    test("separates contains and may-contain statements from the list", () => {
        const sections = segmentIngredientSections(
            "Ingredients: rice, salt. Contains: soy, wheat. May contain: milk, eggs.",
        )
        expect(sections.map((s) => s.kind)).toEqual([
            "ingredients",
            "contains",
            "mayContain",
        ])
        expect(sections[0]?.body).toBe("rice, salt")
        expect(sections[1]?.text).toBe("Contains: soy, wheat")
    })

    test("keeps 'contains 2% or less of' inside the ingredient list", () => {
        const sections = segmentIngredientSections(
            "Water, sugar, contains 2% or less of: salt, citric acid",
        )
        expect(sections).toHaveLength(1)
        expect(sections[0]?.kind).toBe("ingredients")
    })
})

describe("parseIngredients", () => {
    test("renders one row per ingredient for the bullet-delimited Khmer label", () => {
        const parsed = parseIngredients(KHMER_LABEL)
        const names = parsed.ingredients.map((i) => i.name)

        expect(names).toEqual([
            "អង្ករ ប្រេងដូង",
            "ស្ករ",
            "ម្សៅទឹកស៊ីអ៊ីវ",
            "អំបិល",
            "ម៉ូណូសូដ្យូមគ្លុយតាម៉ាត",
        ])
        expect(parsed.totalCount).toBe(5)
        expect(parsed.ingredients[2]?.subIngredients).toEqual([
            "សណ្តែកសៀង",
            "ស្រូវសាលី",
            "ម៉ាល់តូដេកស្ត្រីន",
            "អំបិល",
        ])
        expect(parsed.claims).toEqual([
            "មានផ្ទុក៖ សណ្តែកសៀង ស្រូវសាលី ស៊ុលភីត",
            "អាចមានផ្ទុក៖ ស៊ុត ទឹកដោះគោ ត្រី សត្វសំបករឹង គ្រឿងសមុទ្រសំបករឹង គ្រាប់សណ្តែកដី",
            "មានផ្ទុក៖ សណ្តែកសៀង។ ស្រូវសាលី។ ស៊ុលភីត",
            "អាចមានផ្ទុក៖ ស៊ុត។ ទឹកដោះគោ",
        ])
    })

    test("turns may-contain statements into a single claim instead of rows", () => {
        const parsed = parseIngredients("May contain: milk, eggs, fish")
        expect(parsed.ingredients).toEqual([])
        expect(parsed.claims).toEqual(["May contain: milk, eggs, fish"])
    })

    test("does not render 'Contains' as an ingredient", () => {
        const parsed = parseIngredients("Sugar, cocoa. Contains: soy")
        expect(parsed.ingredients.map((i) => i.name)).toEqual([
            "Sugar",
            "cocoa",
        ])
        expect(parsed.claims).toEqual(["Contains: soy"])
    })

    test("drops duplicated rows and claims from repeated label text", () => {
        const parsed = parseIngredients(
            "Sugar, salt. Gluten free. Ingredients: Sugar, salt. Gluten free.",
        )
        expect(parsed.ingredients.map((i) => i.name)).toEqual(["Sugar", "salt"])
        expect(parsed.claims).toEqual(["Gluten free"])
    })

    test("supports Khmer colons for sub-ingredients", () => {
        const parsed = parseIngredients("សារធាតុរក្សា៖ អំបិល")
        expect(parsed.ingredients).toHaveLength(1)
        expect(parsed.ingredients[0]?.name).toBe("សារធាតុរក្សា")
        expect(parsed.ingredients[0]?.subIngredients).toEqual(["អំបិល"])
    })
})
