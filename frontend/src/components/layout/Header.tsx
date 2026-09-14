import { ArrowLeft, RotateCcw } from "lucide-react"
import React from "react"

import { BrandLockup } from "@/components/brand/BrandMark"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface HeaderProps {
    appearance?: "solid" | "glass"
    showBackButton?: boolean
    onBack?: () => void
    identifier?: string
    backLabel?: string
    secondaryActionLabel?: string
}

export const Header: React.FC<HeaderProps> = ({
    appearance = "solid",
    showBackButton = false,
    onBack,
    identifier,
    backLabel = "Back to scanner",
    secondaryActionLabel = "New Scan",
}) => {
    const isGlass = appearance === "glass"

    return (
        <header
            data-glass-surface={isGlass ? "" : undefined}
            className={cn(
                "sticky top-0 z-40 w-full border-b border-neutral-200/80 transition-all",
                isGlass ? "glass-surface" : "bg-white/92 backdrop-blur-md",
            )}
        >
            <div className="mx-auto flex h-16 w-full max-w-xl items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-2.5">
                    {showBackButton && (
                        <Button
                            variant="ghost"
                            appearance={isGlass ? "glass" : undefined}
                            glassTone="neutral"
                            size="icon-sm"
                            onClick={onBack}
                            className="-ml-1 shrink-0 rounded-full text-neutral-600 hover:text-neutral-950"
                            aria-label={backLabel}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}

                    {showBackButton ? (
                        <Button
                            variant="ghost"
                            onClick={onBack}
                            className="h-11 w-auto px-1 hover:bg-transparent"
                            aria-label={backLabel}
                        >
                            <BrandLockup compact />
                        </Button>
                    ) : (
                        <BrandLockup compact />
                    )}
                </div>

                {showBackButton && identifier && (
                    <div className="flex items-center gap-1.5">
                        <Button
                            variant="subtle"
                            appearance={isGlass ? "glass" : undefined}
                            glassTone="neutral"
                            size="sm"
                            onClick={onBack}
                            className="gap-1 rounded-full font-mono text-xs text-neutral-600 hover:text-neutral-950"
                        >
                            <RotateCcw className="h-3 w-3" />
                            <span>{secondaryActionLabel}</span>
                        </Button>
                    </div>
                )}
            </div>
        </header>
    )
}
