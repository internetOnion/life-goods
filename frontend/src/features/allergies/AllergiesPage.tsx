import {
    CarrotIcon,
    CheeseIcon,
    CoffeeBeanIcon,
    CookieIcon,
    DotsNineIcon,
    DropSlashIcon,
    EggIcon,
    FishIcon,
    FlaskIcon,
    GrainsIcon,
    JarIcon,
    NutIcon,
    ShrimpIcon,
    SpiralIcon,
    TestTubeIcon,
    TreeIcon,
    XIcon,
} from "@phosphor-icons/react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useMvpDemoMode } from "@/config/MvpDemoModeContext"
import { PlaceholderPage } from "@/ui/PlaceholderPage"

const DEMO_ALLERGEN_OPTIONS = [
    { id: "dairy", labelKey: "dairy", icon: CheeseIcon },
    { id: "eggs", labelKey: "eggs", icon: EggIcon },
    { id: "peanuts", labelKey: "peanuts", icon: NutIcon },
    { id: "treeNuts", labelKey: "treeNuts", icon: TreeIcon },
    { id: "soybean", labelKey: "soybean", icon: CoffeeBeanIcon },
    { id: "wheat", labelKey: "wheat", icon: GrainsIcon },
    { id: "fish", labelKey: "fish", icon: FishIcon },
    { id: "shellfish", labelKey: "shellfish", icon: ShrimpIcon },
    { id: "sesame", labelKey: "sesame", icon: DotsNineIcon },
    { id: "mustard", labelKey: "mustard", icon: JarIcon },
    { id: "celery", labelKey: "celery", icon: CarrotIcon },
    { id: "mollusks", labelKey: "mollusks", icon: SpiralIcon },
    { id: "sulphurDioxide", labelKey: "sulphurDioxide", icon: FlaskIcon },
    { id: "sulphites", labelKey: "sulphites", icon: TestTubeIcon },
    { id: "gluten", labelKey: "gluten", icon: CookieIcon },
    { id: "lactose", labelKey: "lactose", icon: DropSlashIcon },
] as const

type AllergenOption = (typeof DEMO_ALLERGEN_OPTIONS)[number]

function isSelectedOption(selected: string[], option: AllergenOption): boolean {
    return selected.includes(option.id)
}

export function AllergiesPage() {
    const { t } = useTranslation()
    const demoMode = useMvpDemoMode()

    if (!demoMode) {
        return (
            <PlaceholderPage
                title={t("placeholder.allergies.title")}
                body={t("placeholder.allergies.body")}
            />
        )
    }

    return <DemoAllergiesPage />
}

function DemoAllergiesPage() {
    const { t } = useTranslation()
    const [selected, setSelected] = useState<string[]>([])
    const headingRef = useRef<HTMLHeadingElement>(null)

    useEffect(() => {
        headingRef.current?.focus()
    }, [])

    const toggleOption = (id: string) => {
        setSelected((current) =>
            current.includes(id)
                ? current.filter((value) => value !== id)
                : [...current, id],
        )
    }

    const selectedOptions = DEMO_ALLERGEN_OPTIONS.filter((option) =>
        selected.includes(option.id),
    )

    return (
        <main className="mx-auto w-[min(calc(100%_-_2rem),48rem)] pt-[clamp(2.75rem,9vh,5.5rem)] pb-[calc(6.4rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),48rem)] sm:w-[min(calc(100%_-_3rem),48rem)]">
            <h1
                ref={headingRef}
                tabIndex={-1}
                className="text-[clamp(2rem,7vw,3.2rem)] leading-[1.7] tracking-tight text-balance"
            >
                {t("allergies.title")}
            </h1>
            <p className="text-muted-foreground mt-3 max-w-[62ch] text-[1.05rem] leading-loose">
                {t("allergies.intro")}
            </p>

            <section
                className="mt-7"
                aria-labelledby="selected-allergies-heading"
            >
                <div className="border-border bg-background sticky top-0 z-10 -mx-2 flex min-h-14 items-center justify-between gap-3 border-b px-2 py-2">
                    <h2
                        id="selected-allergies-heading"
                        className="min-w-0 text-lg leading-[1.7] font-bold"
                    >
                        {t("allergies.selectedHeading")}
                    </h2>
                    <Button
                        className="text-primary hover:bg-primary/10 h-auto min-h-11 max-w-[55%] shrink-0 px-2 text-right text-sm font-bold whitespace-normal"
                        variant="ghost"
                        type="button"
                        onClick={() => setSelected([])}
                        disabled={selected.length === 0}
                    >
                        {t("allergies.reset")}
                    </Button>
                </div>
                <p
                    className="text-muted-foreground mt-3 text-sm"
                    aria-live="polite"
                >
                    {t("allergies.selectedCount", {
                        count: selected.length,
                    })}
                </p>
                {selectedOptions.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {selectedOptions.map((option) => {
                            const Icon = option.icon
                            return (
                                <Button
                                    key={option.id}
                                    className="bg-muted hover:bg-accent h-11 rounded-full px-3"
                                    variant="ghost"
                                    type="button"
                                    aria-label={t("allergies.removeOption", {
                                        option: t(
                                            `allergies.options.${option.labelKey}`,
                                        ),
                                    })}
                                    onClick={() => toggleOption(option.id)}
                                >
                                    <Icon
                                        aria-hidden="true"
                                        size={21}
                                        weight="regular"
                                    />
                                    <span>
                                        {t(
                                            `allergies.options.${option.labelKey}`,
                                        )}
                                    </span>
                                    <span
                                        className="text-primary text-lg leading-none"
                                        aria-hidden="true"
                                    >
                                        <XIcon size={17} weight="bold" />
                                    </span>
                                </Button>
                            )
                        })}
                    </div>
                ) : null}
            </section>

            <section className="mt-8" aria-labelledby="allergy-options-heading">
                <h2
                    id="allergy-options-heading"
                    className="text-lg leading-[1.7] font-bold"
                >
                    {t("allergies.optionsHeading")}
                </h2>
                <fieldset className="mt-3 grid grid-cols-2 gap-3">
                    <legend className="sr-only">
                        {t("allergies.optionsHeading")}
                    </legend>
                    {DEMO_ALLERGEN_OPTIONS.map((option) => {
                        const Icon = option.icon
                        const selectedOption = isSelectedOption(
                            selected,
                            option,
                        )
                        const inputId = `allergy-option-${option.id}`
                        return (
                            <Label
                                key={option.id}
                                className={`hover:bg-accent focus-within:border-ring focus-within:ring-ring/40 flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors focus-within:ring-2 ${selectedOption ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-background"}`}
                                htmlFor={inputId}
                            >
                                <Input
                                    id={inputId}
                                    className="border-input accent-primary size-5 shrink-0 cursor-pointer rounded-sm p-0 shadow-none focus-visible:ring-0"
                                    type="checkbox"
                                    name="allergy-concerns"
                                    value={option.id}
                                    checked={selectedOption}
                                    onChange={() => toggleOption(option.id)}
                                />
                                <Icon
                                    className="size-6 shrink-0"
                                    aria-hidden="true"
                                    size={24}
                                    weight="regular"
                                />
                                <span className="min-w-0 text-sm leading-relaxed sm:text-base">
                                    {t(`allergies.options.${option.labelKey}`)}
                                </span>
                            </Label>
                        )
                    })}
                </fieldset>
            </section>

            <aside className="border-border bg-muted mt-8 rounded-xl border p-4">
                <p className="font-bold">{t("allergies.prioritizationNote")}</p>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {t("allergies.noSafetyClaim")}
                </p>
            </aside>
        </main>
    )
}
