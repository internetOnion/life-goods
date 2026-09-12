import { LEARN_ENTRIES } from "./entries"
import { LEARN_GUIDES } from "./guides"
import { LEARN_SOURCES } from "./sources"
import type { LearnEntry, LocalizedText } from "./types"

function hasBothLanguages(value: LocalizedText) {
    return value.kh.trim().length > 0 && value.en.trim().length > 0
}

function duplicates(values: string[]) {
    const seen = new Set<string>()
    return values.filter((value) => {
        if (seen.has(value)) return true
        seen.add(value)
        return false
    })
}

export function allergenIngredientGroupErrors(entry: LearnEntry): string[] {
    const errors: string[] = []
    const allergenGroups = entry.allergenIngredientGroups ?? []

    if (allergenGroups.length > 0 && entry.category !== "allergens")
        errors.push(
            `Learn entry ${entry.id} has allergen ingredient groups outside the allergens category`,
        )
    for (const duplicate of duplicates(
        allergenGroups.map((group) => group.key),
    ))
        errors.push(
            `Learn entry ${entry.id} has duplicate allergen group key: ${duplicate}`,
        )
    for (const group of allergenGroups) {
        if (!group.key.trim())
            errors.push(
                `Learn entry ${entry.id} has an allergen group without a key`,
            )
        if (
            !hasBothLanguages(group.name) ||
            !hasBothLanguages(group.labelMeaning)
        )
            errors.push(
                `Learn entry ${entry.id} allergen group ${group.key} is missing Khmer or English content`,
            )
        if (group.examples.length === 0)
            errors.push(
                `Learn entry ${entry.id} allergen group ${group.key} has no ingredient examples`,
            )
        for (const example of group.examples) {
            if (
                !hasBothLanguages(example.name) ||
                (example.note && !hasBothLanguages(example.note))
            )
                errors.push(
                    `Learn entry ${entry.id} allergen group ${group.key} has an incomplete bilingual example`,
                )
        }
    }

    return errors
}

export function learnCatalogErrors(): string[] {
    const errors: string[] = []
    const sourceIds = new Set(LEARN_SOURCES.map((source) => source.id))
    const entryIds = new Set(LEARN_ENTRIES.map((entry) => entry.id))

    for (const duplicate of duplicates(
        LEARN_SOURCES.map((source) => source.id),
    ))
        errors.push(`Duplicate Learn source id: ${duplicate}`)
    for (const duplicate of duplicates(LEARN_ENTRIES.map((entry) => entry.id)))
        errors.push(`Duplicate Learn entry id: ${duplicate}`)
    for (const duplicate of duplicates(
        LEARN_ENTRIES.map((entry) => entry.slug),
    ))
        errors.push(`Duplicate Learn entry slug: ${duplicate}`)
    for (const duplicate of duplicates(LEARN_GUIDES.map((guide) => guide.slug)))
        errors.push(`Duplicate Learn guide slug: ${duplicate}`)

    for (const source of LEARN_SOURCES) {
        if (source.url && !source.url.startsWith("https://"))
            errors.push(`Learn source ${source.id} must use HTTPS`)
        if (
            !hasBothLanguages(source.name) ||
            !hasBothLanguages(source.publisher)
        )
            errors.push(
                `Learn source ${source.id} is missing Khmer or English content`,
            )
    }

    for (const entry of LEARN_ENTRIES) {
        if (
            !hasBothLanguages(entry.title) ||
            !hasBothLanguages(entry.summary) ||
            !hasBothLanguages(entry.body) ||
            !hasBothLanguages(entry.doesNotImply)
        )
            errors.push(
                `Learn entry ${entry.id} is missing Khmer or English content`,
            )
        for (const fact of entry.facts ?? []) {
            if (
                !hasBothLanguages(fact.label) ||
                (fact.detail && !hasBothLanguages(fact.detail))
            )
                errors.push(
                    `Learn entry ${entry.id} has an incomplete bilingual fact`,
                )
        }
        errors.push(...allergenIngredientGroupErrors(entry))
        for (const reference of entry.sourceRefs) {
            if (!sourceIds.has(reference.sourceId))
                errors.push(
                    `Learn entry ${entry.id} references unknown source ${reference.sourceId}`,
                )
        }
        for (const relatedId of entry.relatedEntryIds) {
            if (!entryIds.has(relatedId))
                errors.push(
                    `Learn entry ${entry.id} references unknown related entry ${relatedId}`,
                )
        }
    }

    const guideEntryIds = LEARN_GUIDES.flatMap((guide) => guide.entryIds)
    for (const entry of LEARN_ENTRIES) {
        const membershipCount = guideEntryIds.filter(
            (id) => id === entry.id,
        ).length
        if (membershipCount !== 1)
            errors.push(
                `Learn entry ${entry.id} belongs to ${membershipCount} guides`,
            )
    }
    for (const guide of LEARN_GUIDES) {
        if (!hasBothLanguages(guide.title) || !hasBothLanguages(guide.intro))
            errors.push(
                `Learn guide ${guide.slug} is missing Khmer or English content`,
            )
        for (const entryId of guide.entryIds) {
            const entry = LEARN_ENTRIES.find(
                (candidate) => candidate.id === entryId,
            )
            if (!entry)
                errors.push(
                    `Learn guide ${guide.slug} references unknown entry ${entryId}`,
                )
            else if (entry.category !== guide.category)
                errors.push(
                    `Learn guide ${guide.slug} contains entry ${entryId} from another category`,
                )
        }
    }

    return errors
}

export function validateLearnCatalog() {
    const errors = learnCatalogErrors()
    if (errors.length > 0)
        throw new Error(`Invalid Learn catalog:\n${errors.join("\n")}`)
}
