/**
 * Development-only fixtures for previewing Label Reading and Compare Nutrition
 * results without calling the AI provider. Never imported by production code.
 */
import type {
    ComparisonResponse,
    KhmerRenderedBlock,
    LabelReading,
} from "@/api/generated"
import type { ProductSideState } from "@/features/photo-evidence/types"

const field = (
    id: string,
    nutrient: string,
    value: string | null,
    unit = "g",
    state = "readable",
    extra: Record<string, unknown> = {},
) => ({
    field_id: id,
    nutrient,
    label: nutrient,
    state,
    row_kind: "amount",
    qualifier: "exact",
    value_text: value,
    unit_text: value ? unit : null,
    evidence: [{ image_id: "img_1" }],
    ...extra,
})

const text = (block_id: string, original_script: string, language = "en") => ({
    block_id,
    original_script,
    language,
    state: "readable",
    evidence: [{ image_id: "img_1" }],
})

export const completeReading = {
    schema_version: 1,
    identity: {
        brand: {
            field_id: "b",
            value_text: "Mama",
            language: "en",
            state: "readable",
        },
        name: {
            field_id: "n",
            value_text: "Instant Noodles Tom Yum Shrimp Flavour",
            language: "en",
            state: "readable",
        },
    },
    images: [
        { image_id: "img_1", role: "submitted_photo", width: 800, height: 600 },
        { image_id: "img_2", role: "submitted_photo", width: 800, height: 600 },
    ],
    package_quantity: { state: "readable", value_text: "60", unit_text: "g" },
    nutrition_columns: [
        {
            column_id: "per100",
            basis: "per_100g",
            preparation_state: "as_sold",
            fields: [
                field("e1", "energy", "1960", "kJ"),
                field("e2", "energy", "470", "kcal"),
                field("fat", "fat", "20"),
                field("sf", "saturated_fat", "9"),
                field("carb", "carbohydrates", "63"),
                field("sug", "sugars", null, "g", "unreadable"),
                field("pro", "protein", "8"),
                field("sod", "sodium", "1500", "mg", "readable", {
                    evidence: [{ image_id: "img_2" }],
                }),
                field("fib", "fiber", "1", "g", "readable", {
                    qualifier: "less_than",
                }),
            ],
        },
        {
            column_id: "serving",
            basis: "per_serving",
            preparation_state: "as_sold",
            fields: [
                field("fat_s", "fat", "12"),
                field("sod_s", "sodium", "900", "mg"),
            ],
        },
    ],
    outcome: "partial",
    retake_reasons: ["The sugar row is blurred."],
    provider: "google",
    model: "gemini-3.8-flash",
    ingredients: [
        text(
            "ing_en",
            "Ingredients: noodles (wheat flour, palm oil, salt), seasoning powder (sugar, salt, milk powder, shrimp powder 2%, chilli, lemongrass), soy sauce.",
        ),
    ],
    allergen_statements: [
        {
            ...text("st1", "Contains wheat, milk, soy and crustacean."),
            kind: "contains",
        },
        {
            ...text("st2", "May contain traces of peanuts and egg."),
            kind: "may_contain",
        },
    ],
    printed_facts: [
        {
            ...text("fx1", "1 pack (60 g)"),
            kind: "serving_size",
            label: "Serving size",
        },
        {
            ...text("fx2", "Thailand"),
            kind: "country_of_origin",
            label: "Made in",
        },
        {
            ...text("fx3", "Store in a cool, dry place away from sunlight."),
            kind: "storage_instructions",
            label: "Storage",
        },
    ],
    allergen_mentions: {
        state: "completed",
        limitations: [],
        mentions: [
            {
                block_id: "ing_en",
                matched_text: "wheat flour",
                allergen_tags: ["en:gluten"],
                qualification: "positive_mention",
            },
            {
                block_id: "ing_en",
                matched_text: "milk powder",
                allergen_tags: ["en:milk"],
                qualification: "positive_mention",
            },
            {
                block_id: "st2",
                matched_text: "peanuts",
                allergen_tags: ["en:peanuts"],
                qualification: "precautionary_statement",
            },
        ],
    },
    configuration_version: "label-reading-v1",
} as unknown as LabelReading

/** Non-English text, no nutrition columns: allergens not checked, table absent. */
export const sparseReading = {
    ...completeReading,
    identity: null,
    package_quantity: {
        state: "not_visible",
        value_text: null,
        unit_text: null,
    },
    nutrition_columns: [],
    ingredients: [text("ing_th", "ส่วนประกอบ: แป้งสาลี น้ำตาล เกลือ", "th")],
    allergen_statements: [],
    printed_facts: [],
    allergen_mentions: {
        state: "not_checked",
        reason: "no_english_printed_text",
        mentions: [],
        limitations: ["non_english_text_not_checked"],
    },
} as unknown as LabelReading

export const khmerBlocks: Record<string, KhmerRenderedBlock> = {
    ing_en: {
        block_id: "ing_en",
        state: "rendered",
        khmer_text:
            "គ្រឿងផ្សំ៖ មី (ម្សៅស្រូវសាលី ប្រេងដូង អំបិល) ម្សៅគ្រឿងទេស (ស្ករ អំបិល ម្សៅទឹកដោះគោ ម្សៅបង្គា 2% ម្ទេស ស្លឹកគ្រៃ) ទឹកស៊ីអ៊ីវ។",
    },
    st1: {
        block_id: "st1",
        state: "rendered",
        khmer_text: "មានស្រូវសាលី ទឹកដោះគោ សណ្ដែកសៀង និងសត្វសំបករឹង។",
    },
    st2: { block_id: "st2", state: "unavailable", khmer_text: null },
}

const reported = (
    value: string,
    unit = "g",
    extra: Record<string, unknown> = {},
    prep = "as_sold",
) => ({
    column_id: "c",
    basis: "per_100g",
    preparation_state: prep,
    observation: {
        field_id: value + unit,
        state: "readable",
        row_kind: "amount",
        qualifier: "exact",
        value_text: value,
        unit_text: unit,
        evidence: [],
        ...extra,
    },
})
const derived = (value: string, unit = "g") => ({
    value,
    unit,
    target_basis: "per_100g",
    inputs: [],
})
const row = (
    nutrient: string,
    left: number,
    right: number,
    unit = "g",
    state = "comparable",
) => ({
    nutrient,
    row_kind: "amount",
    state,
    left: reported(
        String(left),
        unit,
        {},
        state === "conditional" ? "unknown" : "as_sold",
    ),
    right: reported(
        String(right),
        unit,
        {},
        state === "conditional" ? "unknown" : "as_sold",
    ),
    normalized_left: derived(String(left), unit),
    normalized_right: derived(String(right), unit),
    derived_difference:
        state === "comparable" ? derived(String(left - right), unit) : null,
    ...(state === "conditional"
        ? {
              assumptions: [
                  "Preparation state is unknown for at least one Product.",
              ],
              reason: "Preparation state is unknown, so the normalized values are conditional.",
          }
        : {}),
})

const comparisonOf = (rows: unknown[]) =>
    ({
        schema_version: 1,
        calculated_from_submitted_evidence: true,
        left_product_id: "left",
        right_product_id: "right",
        rows,
    }) as unknown as ComparisonResponse

export const completeComparison = comparisonOf([
    row("energy", 470, 440, "kcal"),
    row("fat", 20, 17),
    row("saturated_fat", 9, 9),
    row("carbohydrates", 63, 66),
    row("sugars", 4, 11),
    row("protein", 8, 8),
    row("sodium", 1500, 820, "mg"),
    {
        nutrient: "fiber",
        row_kind: "amount",
        state: "not_comparable",
        left: reported("1", "g", { qualifier: "less_than" }),
        right: reported("2"),
    },
    {
        nutrient: "calcium",
        row_kind: "amount",
        state: "not_comparable",
        left: reported("200", "mg"),
        right: null,
    },
    {
        nutrient: "iron",
        row_kind: "amount",
        state: "not_comparable",
        left: reported("4", "mg"),
        right: reported("", "mg", { state: "unreadable" }),
    },
    {
        nutrient: "vitamin_a",
        row_kind: "percentage",
        state: "not_comparable",
        left: reported("10", "%", { row_kind: "percentage" }),
        right: reported("15", "%", { row_kind: "percentage" }),
    },
])

/** Preparation not stated on either label: every difference is conditional. */
export const conditionalComparison = comparisonOf([
    row("energy", 380, 450, "kcal", "conditional"),
    row("sugars", 2, 9, "g", "conditional"),
    row("sodium", 600, 610, "mg", "conditional"),
])

export const side = (
    id: "left" | "right",
    title: string,
): ProductSideState => ({
    id,
    title,
    number: null,
    photos: [],
    extraction: null,
    selectedColumnId: null,
    loading: false,
    error: "",
    retry: false,
    revision: 1,
})
