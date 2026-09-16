import { EggIcon, FishIcon, ShrimpIcon } from "@phosphor-icons/react"

import {
    CeleryIcon,
    GlutenIcon,
    LupinIcon,
    MilkIcon,
    MolluskIcon,
    MustardIcon,
    PeanutIcon,
    SesameIcon,
    SoybeanIcon,
    TreeNutIcon,
} from "./AllergenIcons"

export const ALLERGEN_OPTIONS = [
    { id: "celery", label: "Celery", tag: "en:celery", icon: CeleryIcon },
    {
        id: "crustaceans",
        label: "Crustaceans",
        tag: "en:crustaceans",
        icon: ShrimpIcon,
    },
    { id: "eggs", label: "Eggs", tag: "en:eggs", icon: EggIcon },
    { id: "fish", label: "Fish", tag: "en:fish", icon: FishIcon },
    { id: "gluten", label: "Gluten", tag: "en:gluten", icon: GlutenIcon },
    { id: "lupin", label: "Lupin", tag: "en:lupin", icon: LupinIcon },
    { id: "milk", label: "Milk", tag: "en:milk", icon: MilkIcon },
    {
        id: "molluscs",
        label: "Molluscs",
        tag: "en:molluscs",
        icon: MolluskIcon,
    },
    { id: "mustard", label: "Mustard", tag: "en:mustard", icon: MustardIcon },
    { id: "nuts", label: "Nuts", tag: "en:nuts", icon: TreeNutIcon },
    { id: "peanuts", label: "Peanuts", tag: "en:peanuts", icon: PeanutIcon },
    {
        id: "sesameSeeds",
        label: "Sesame seeds",
        tag: "en:sesame-seeds",
        icon: SesameIcon,
    },
    {
        id: "soybeans",
        label: "Soybeans",
        tag: "en:soybeans",
        icon: SoybeanIcon,
    },
] as const

export type ConcernId = (typeof ALLERGEN_OPTIONS)[number]["id"]

export const CONCERN_TAGS: Record<ConcernId, string> = Object.fromEntries(
    ALLERGEN_OPTIONS.map(({ id, tag }) => [id, tag]),
) as Record<ConcernId, string>

const OPTIONS_BY_ID = new Map(
    ALLERGEN_OPTIONS.map((option) => [option.id, option]),
)
const OPTIONS_BY_TAG = new Map<string, (typeof ALLERGEN_OPTIONS)[number]>(
    ALLERGEN_OPTIONS.map((option) => [option.tag, option]),
)

export function isConcernId(value: unknown): value is ConcernId {
    return typeof value === "string" && OPTIONS_BY_ID.has(value as ConcernId)
}

export function getConcernOption(
    value: string,
): (typeof ALLERGEN_OPTIONS)[number] | undefined {
    return OPTIONS_BY_ID.get(value as ConcernId)
}

export function getConcernOptionByTag(
    tag: string,
): (typeof ALLERGEN_OPTIONS)[number] | undefined {
    return OPTIONS_BY_TAG.get(tag)
}
