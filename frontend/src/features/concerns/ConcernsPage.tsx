import { CheckIcon, XIcon } from "@phosphor-icons/react"
import { useEffect, useRef } from "react"

import { GlassButton as Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { usePageMetadata } from "@/lib/metadata"

import { ALLERGEN_OPTIONS, useSelectedConcernStorage } from "./matching"

export type AllergenId = (typeof ALLERGEN_OPTIONS)[number]["id"]

export function ConcernsPage() {
    const storage = useSelectedConcernStorage()
    const selected = storage.ids
    const headingRef = useRef<HTMLHeadingElement>(null)

    usePageMetadata({
        title: "Dietary & Allergy Concerns",
        description:
            "Select dietary concerns and allergens to highlight when looking up Products.",
    })

    useEffect(() => {
        headingRef.current?.focus({ preventScroll: true })
    }, [])

    const toggleOption = (id: AllergenId) => {
        const next = selected.includes(id)
            ? selected.filter((item) => item !== id)
            : [...selected, id]
        storage.save(next)
    }

    const resetAll = () => {
        storage.reset()
    }

    const selectedOptions = ALLERGEN_OPTIONS.filter((opt) =>
        selected.includes(opt.id),
    )

    return (
        <main className="page-rail sm:px-6 sm:py-12">
            <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-display leading-[1.12] font-extrabold tracking-[-0.03em] text-balance text-neutral-950"
            >
                Dietary & Allergy Concerns
            </h1>
            <p className="mt-3 text-base leading-relaxed text-neutral-600">
                Select ingredients or allergens you want to be mindful of when
                reviewing Product labels.
            </p>
            {storage.storageError && (
                <p role="alert" className="text-error-800 mt-3 text-sm">
                    Your choices could not be saved. They will last only for
                    this visit.
                </p>
            )}

            <section
                data-glass-surface=""
                className="source-sheet mt-8 overflow-hidden p-5 sm:p-6"
                aria-labelledby="selected-concerns-heading"
            >
                <div className="flex items-center justify-between gap-3 border-b border-neutral-100 pb-3">
                    <h2
                        id="selected-concerns-heading"
                        className="text-sm font-extrabold tracking-wider text-neutral-900 uppercase"
                    >
                        Active Concerns ({selected.length})
                    </h2>
                    {selected.length > 0 ? (
                        <Button
                            className="text-primary-800 hover:text-primary-950 min-h-11 px-3 text-xs font-bold"
                            onClick={resetAll}
                            type="button"
                            variant="ghost"
                        >
                            Reset all
                        </Button>
                    ) : null}
                </div>

                {selectedOptions.length > 0 ? (
                    <div className="mt-3.5 flex flex-wrap gap-2">
                        {selectedOptions.map((opt) => {
                            const Icon = opt.icon
                            return (
                                <Button
                                    key={opt.id}
                                    type="button"
                                    variant="ghost"
                                    glassTone="selected"
                                    onClick={() => toggleOption(opt.id)}
                                    className="focus-visible:ring-primary-500 inline-flex h-auto min-h-11 items-center gap-1.5 rounded-full py-1 pr-2 pl-3 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
                                    aria-label={`Remove ${opt.label}`}
                                >
                                    <Icon size={16} weight="bold" />
                                    <span>{opt.label}</span>
                                    <XIcon size={14} weight="bold" />
                                </Button>
                            )
                        })}
                    </div>
                ) : (
                    <p className="mt-3 text-sm text-neutral-500">
                        No concerns selected yet. Tap any item below to flag it.
                    </p>
                )}
            </section>

            <section
                className="mt-8"
                aria-labelledby="allergen-options-heading"
            >
                <h2
                    id="allergen-options-heading"
                    className="text-base font-extrabold tracking-[-0.01em] text-neutral-950"
                >
                    Available Allergens & Ingredients
                </h2>
                <fieldset className="source-sheet mt-3.5 divide-y divide-neutral-200/80 overflow-hidden">
                    <legend className="sr-only">
                        Select allergy and dietary concerns
                    </legend>
                    {ALLERGEN_OPTIONS.map((opt) => {
                        const Icon = opt.icon
                        const isChecked = selected.includes(opt.id)
                        const inputId = `concern-${opt.id}`

                        return (
                            <label
                                key={opt.id}
                                htmlFor={inputId}
                                className={`has-[:focus-visible]:ring-primary-500 flex min-h-16 cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-colors select-none has-[:focus-visible]:relative has-[:focus-visible]:z-10 has-[:focus-visible]:ring-2 sm:px-5 ${
                                    isChecked
                                        ? "bg-primary-50/75 text-neutral-950"
                                        : "bg-white text-neutral-700 hover:bg-neutral-50/70"
                                }`}
                            >
                                <Input
                                    id={inputId}
                                    type="checkbox"
                                    name="concerns"
                                    value={opt.id}
                                    checked={isChecked}
                                    onChange={() => toggleOption(opt.id)}
                                    className="sr-only"
                                />
                                <div
                                    className={`grid size-6 shrink-0 place-items-center rounded-md border transition-colors ${
                                        isChecked
                                            ? "border-primary-600 bg-primary-600 text-white"
                                            : "border-neutral-300 bg-white text-transparent"
                                    }`}
                                    aria-hidden="true"
                                >
                                    <CheckIcon size={16} weight="bold" />
                                </div>
                                <div
                                    className={`grid size-11 shrink-0 place-items-center rounded-xl transition-colors ${
                                        isChecked
                                            ? "bg-primary-100 text-primary-800"
                                            : "bg-neutral-100 text-neutral-600"
                                    }`}
                                    aria-hidden="true"
                                >
                                    <Icon
                                        size={22}
                                        weight={isChecked ? "bold" : "regular"}
                                    />
                                </div>
                                <span className="text-sm font-bold text-neutral-800 sm:text-base">
                                    {opt.label}
                                </span>
                            </label>
                        )
                    })}
                </fieldset>
            </section>
        </main>
    )
}
