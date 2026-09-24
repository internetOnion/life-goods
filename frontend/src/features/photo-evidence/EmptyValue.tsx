/**
 * A table cell with no value from the photo: a plain dash on screen, with the
 * reason (not readable, not printed, unclear) kept for screen readers only.
 */
export function EmptyValue({ reason }: { reason: string }) {
    return (
        <span className="font-mono text-neutral-400">
            <span aria-hidden="true">—</span>
            <span className="sr-only">{reason}</span>
        </span>
    )
}
