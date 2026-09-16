import { ArrowLeft } from "lucide-react"
import React from "react"

import { BrandLockup } from "@/components/brand/BrandMark"
import { Button } from "@/components/ui/button"
import { useAppTranslation } from "@/i18n/translations"
import { cn } from "@/lib/utils"

interface HeaderProps {
    appearance?: "solid" | "glass"
    showBackButton?: boolean
    onBack?: () => void
    backLabel?: string
}

export const Header: React.FC<HeaderProps> = ({
    appearance = "solid",
    showBackButton = false,
    onBack,
    backLabel,
}) => {
    const { t } = useAppTranslation()
    const isGlass = appearance === "glass"
    const resolvedBackLabel = backLabel ?? t("backToScanner")

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
                            aria-label={resolvedBackLabel}
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}

                    <BrandLockup compact />
                </div>
            </div>
        </header>
    )
}
