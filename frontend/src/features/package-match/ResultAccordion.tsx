import { CaretDownIcon, ListMagnifyingGlassIcon } from "@phosphor-icons/react"
import type { ReactNode } from "react"

export function ResultAccordion({
    id,
    title,
    icon: Icon = ListMagnifyingGlassIcon,
    description,
    children,
}: {
    id: string
    title: string
    icon?: typeof ListMagnifyingGlassIcon
    description?: string
    children: ReactNode
}) {
    return (
        <details className="group bg-secondary overflow-hidden rounded-xl">
            <summary
                className="focus-visible:ring-ring flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 py-2.5 font-black focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset [&::-webkit-details-marker]:hidden"
                aria-controls={`${id}-content`}
            >
                <span className="flex min-w-0 items-center gap-3">
                    <Icon
                        className="shrink-0"
                        aria-hidden="true"
                        size={24}
                        weight="regular"
                    />
                    <span
                        className="leading-[1.45] wrap-anywhere"
                        role="heading"
                        aria-level={2}
                    >
                        {title}
                    </span>
                </span>
                <CaretDownIcon
                    className="shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                    aria-hidden="true"
                    size={21}
                    weight="bold"
                />
            </summary>
            <div className="bg-background px-4 pt-1 pb-5" id={`${id}-content`}>
                {description ? (
                    <p className="text-muted-foreground max-w-[68ch] leading-relaxed">
                        {description}
                    </p>
                ) : null}
                {children}
            </div>
        </details>
    )
}
