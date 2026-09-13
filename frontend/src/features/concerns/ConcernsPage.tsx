import { XIcon } from "@phosphor-icons/react"
import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
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
                className="mt-8 rounded-2xl border border-neutral-200 bg-white p-5 sm:p-6"
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
                            className="text-primary-700 hover:text-primary-900 min-h-8 px-2 text-xs font-bold"
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
                                    onClick={() => toggleOption(opt.id)}
                                    className="bg-primary-100/70 text-primary-900 hover:bg-primary-200 focus-visible:ring-primary-500 inline-flex h-auto min-h-8 items-center gap-1.5 rounded-full py-1 pr-2 pl-3 text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
                <fieldset className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
                                className={`has-[:focus-visible]:ring-primary-500 flex min-h-16 cursor-pointer items-center gap-3.5 rounded-xl border p-3.5 transition-colors select-none has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 ${
                                    isChecked
                                        ? "border-primary-400 bg-primary-50/70 text-neutral-950 shadow-xs"
                                        : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50/60"
                                }`}
                            >
                                <Input
                                    id={inputId}
                                    type="checkbox"
                                    name="concerns"
                                    value={opt.id}
                                    checked={isChecked}
                                    onChange={() => toggleOption(opt.id)}
                                    className="accent-primary-600 size-4.5 h-auto min-w-0 rounded border-neutral-300 p-0 shadow-none focus-visible:ring-0"
                                />
                                <div
                                    className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                                        isChecked
                                            ? "bg-primary-200/70 text-primary-900"
                                            : "bg-neutral-100 text-neutral-600"
                                    }`}
                                    aria-hidden="true"
                                >
                                    <Icon
                                        size={20}
                                        weight={isChecked ? "bold" : "regular"}
                                    />
                                </div>
                                <span className="text-sm font-bold">
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
