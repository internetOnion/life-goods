import { LEARN_ENTRIES } from "./entries"
import { LEARN_GUIDES } from "./guides"
import { LEARN_SOURCES } from "./sources"
import type { LocalizedText } from "./types"

function hasBothLanguages(value: LocalizedText) {
    return value.km.trim().length > 0 && value.en.trim().length > 0
}

function duplicates(values: string[]) {
    const seen = new Set<string>()
    return values.filter((value) => {
        if (seen.has(value)) return true
        seen.add(value)
        return false
    })
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
