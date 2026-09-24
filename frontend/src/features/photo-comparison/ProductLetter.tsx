import { cn } from "@/lib/utils"

/**
 * The A/B mark that ties a Product's name to its bars and table column. Two
 * neutral tones tell the sides apart without implying that either is better.
 */
export function ProductLetter({
    side,
    size = "md",
    className,
}: {
    side: "left" | "right"
    size?: "sm" | "md"
    className?: string
}) {
    return (
        <span
            aria-hidden="true"
            className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-lg font-extrabold text-white",
                size === "sm" ? "size-7 text-xs" : "size-9 text-sm",
                side === "left" ? "bg-neutral-900" : "bg-neutral-500",
                className,
            )}
        >
            {side === "left" ? "A" : "B"}
        </span>
    )
}
