import * as Dialog from "@radix-ui/react-dialog"
import { XIcon } from "@phosphor-icons/react"
import type { ReactNode } from "react"
import { useRef } from "react"

import { Button } from "@/components/ui/button"

export type ContextualSheetProps = {
    open: boolean
    title: string
    description: string
    closeLabel: string
    children: ReactNode
    onOpenChange: (open: boolean) => void
    onRestoreFocus?: () => void
}

/** A small, accessible contextual explainer surface shared by shopper features. */
export function ContextualSheet({
    open,
    title,
    description,
    closeLabel,
    children,
    onOpenChange,
    onRestoreFocus,
}: ContextualSheetProps) {
    const titleRef = useRef<HTMLHeadingElement>(null)

    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="bg-foreground/35 data-[state=closed]:animate-out data-[state=open]:animate-in fixed inset-0 z-50" />
                <Dialog.Content
                    className="bg-background fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[min(90svh,48rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border-t p-5 shadow-[0_-12px_40px_rgba(23,24,26,0.16)] outline-none sm:inset-y-8 sm:bottom-auto sm:max-h-[calc(100svh-4rem)] sm:rounded-2xl sm:border"
                    onOpenAutoFocus={(event) => {
                        event.preventDefault()
                        titleRef.current?.focus()
                    }}
                    onCloseAutoFocus={(event) => {
                        event.preventDefault()
                        onRestoreFocus?.()
                    }}
                >
                    <div className="flex items-start justify-between gap-4 border-b pb-4">
                        <div className="min-w-0">
                            <Dialog.Title
                                ref={titleRef}
                                tabIndex={-1}
                                className="text-xl leading-[1.7] font-bold text-balance sm:text-2xl"
                            >
                                {title}
                            </Dialog.Title>
                            <Dialog.Description className="text-muted-foreground mt-1 text-sm leading-relaxed">
                                {description}
                            </Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <Button
                                className="shrink-0"
                                size="icon"
                                variant="ghost"
                                type="button"
                                aria-label={closeLabel}
                            >
                                <XIcon
                                    aria-hidden="true"
                                    size={22}
                                    weight="bold"
                                />
                            </Button>
                        </Dialog.Close>
                    </div>
                    <div className="min-h-0 overflow-y-auto pt-5">
                        {children}
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
