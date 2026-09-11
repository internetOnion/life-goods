import { ArrowLeft, RotateCcw } from "lucide-react"
import React from "react"

import { BrandLockup } from "@/components/brand/BrandMark"
import { Button } from "@/components/ui/button"

interface HeaderProps {
    showBackButton?: boolean
    onBack?: () => void
    identifier?: string
    backLabel?: string
    secondaryActionLabel?: string
}

export const Header: React.FC<HeaderProps> = ({
    showBackButton = false,
    onBack,
    identifier,
    backLabel = "Back to scanner",
    secondaryActionLabel = "New Scan",
}) => {
    return (
        <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 bg-white/92 backdrop-blur-md transition-all">
            <div className="mx-auto flex h-16 w-full max-w-xl items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-2.5">
                    {showBackButton && (
                        <Button
                            variant="ghost"
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
