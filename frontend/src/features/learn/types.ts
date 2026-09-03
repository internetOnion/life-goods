export type LearnLocale = "km" | "en"

export type LocalizedText = {
    km: string
    en: string
}

export type LearnCategory =
    "label" | "ingredients" | "allergens" | "halal" | "marks"

export type LearnSource = {
    id: string
    name: LocalizedText
    url: string
    publisher: LocalizedText
    jurisdiction: LocalizedText
    version: string
    retrievedAt: string
}

export type LearnSourceReference = {
    sourceId: string
    section: string
}

export type LearnFact = {
    label: LocalizedText
    detail?: LocalizedText
}

export type LearnEntry = {
    id: string
    slug: string
    category: LearnCategory
    title: LocalizedText
    summary: LocalizedText
    body: LocalizedText
    facts?: LearnFact[]
    doesNotImply: LocalizedText
    sourceRefs: LearnSourceReference[]
    relatedEntryIds: string[]
    reviewState: "approved"
}

export type LearnGuide = {
    slug: string
    category: LearnCategory
    title: LocalizedText
    intro: LocalizedText
    entryIds: string[]
    featured: boolean
    table: {
        caption: LocalizedText
        itemHeading: LocalizedText
        meaningHeading: LocalizedText
        boundaryHeading: LocalizedText
    }
}

export type AdditiveRecord = {
    insNumber: string
    names: LocalizedText
    synonyms: LocalizedText[]
    functionalClasses: LocalizedText[]
    foodCategories: string[]
    sourceRef: LearnSourceReference
    reviewState: "draft" | "approved" | "superseded"
}
