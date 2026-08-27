import { InfoIcon, TreePalmIcon } from "@phosphor-icons/react"
import { useTranslation } from "react-i18next"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const tabs = ["information", "ingredients", "nutrition"] as const
type ResultTab = (typeof tabs)[number]

const fields: Record<ResultTab, readonly string[]> = {
    information: ["country", "storage"],
    ingredients: ["ingredientText", "allergens", "additives"],
    nutrition: ["calories", "sugar", "fat", "protein", "sodium"],
}

export function DemoResultStructure() {
    const { t } = useTranslation()
    return (
        <section
            className="relative mx-auto mt-10 max-w-[40rem]"
            aria-labelledby="demo-data-title"
        >
            <TreePalmIcon
                className="text-primary/15 pointer-events-none absolute top-0 right-0 size-20 -rotate-12"
                aria-hidden="true"
                weight="thin"
            />
            <div className="border-border bg-brand-soft relative rounded-xl border p-4">
                <div className="flex items-start gap-3">
                    <InfoIcon
                        className="text-primary mt-0.5 shrink-0"
                        aria-hidden="true"
                        size={23}
                        weight="bold"
                    />
                    <div>
                        <h2 id="demo-data-title" className="font-bold">
                            {t("capture.result.completed.uncertainty")}
                        </h2>
                        <p className="mt-1 text-sm leading-relaxed">
                            {t("capture.result.completed.structureNotice")}
                        </p>
                    </div>
                </div>
            </div>

            <dl className="border-border mt-6 divide-y border-y">
                <DemoField label={t("capture.result.completed.productName")} />
                <DemoField label={t("capture.result.completed.brand")} />
            </dl>

            <Tabs defaultValue="information">
                <TabsList
                    className="mt-7 flex gap-1 overflow-x-auto"
                    aria-label={t("capture.result.completed.tabsLabel")}
                >
                    {tabs.map((tab) => (
                        <TabsTrigger
                            key={tab}
                            value={tab}
                            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring data-[state=active]:border-brand-dark data-[state=active]:bg-brand-soft data-[state=active]:text-primary shrink-0 border-b-2 border-transparent px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none data-[state=active]:font-bold"
                        >
                            {t(`capture.result.completed.${tab}`)}
                        </TabsTrigger>
                    ))}
                </TabsList>

                {tabs.map((tab) => (
                    <TabsContent
                        key={tab}
                        value={tab}
                        className="divide-border divide-y"
                    >
                        {fields[tab].map((field) => (
                            <DemoField
                                key={field}
                                label={t(`capture.result.completed.${field}`)}
                            />
                        ))}
                    </TabsContent>
                ))}
            </Tabs>
        </section>
    )
}

function DemoField({ label }: { label: string }) {
    const { t } = useTranslation()
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-4 text-sm">
            <dt className="font-semibold wrap-anywhere">{label}</dt>
            <dd
                className="text-muted-foreground max-w-[12rem] text-end"
                aria-label={t("capture.result.completed.unavailableValue")}
            >
                {t("capture.result.completed.unavailableValue")}
            </dd>
        </div>
    )
}
