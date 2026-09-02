import { ArrowLeft, RotateCcw } from "lucide-react"
import React from "react"

import { Button } from "@/components/ui/button"

interface HeaderProps {
    showBackButton?: boolean
    onBack?: () => void
    identifier?: string
}

export const Header: React.FC<HeaderProps> = ({
    showBackButton = false,
    onBack,
    identifier,
}) => {
    return (
        <header className="sticky top-0 z-40 w-full border-b border-neutral-200/80 bg-white/90 backdrop-blur-md transition-all">
            <div className="mx-auto flex h-16 max-w-xl items-center justify-between px-4 sm:px-6">
                <div className="flex items-center gap-2.5">
                    {showBackButton && (
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={onBack}
                            className="-ml-1 shrink-0 rounded-full text-neutral-600 hover:text-neutral-950"
                            aria-label="Back to scanner"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    )}

                    <div
                        onClick={showBackButton ? onBack : undefined}
                        className={`flex items-center gap-2.5 ${showBackButton ? "group cursor-pointer" : ""}`}
                        role={showBackButton ? "button" : undefined}
                        tabIndex={showBackButton ? 0 : undefined}
                        onKeyDown={
                            showBackButton
                                ? (e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault()
                                          onBack?.()
                                      }
                                  }
                                : undefined
                        }
                    >
                        <img
                            src="/branding/lifegoods-mark.svg"
                            alt="LifeGoods logo"
                            className="h-9 w-9 shrink-0 object-contain"
                        />

                        <span className="text-base leading-tight font-bold tracking-tight text-neutral-950">
                            Life Goods
                        </span>
                    </div>
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
                            <span>New Scan</span>
                        </Button>
                    </div>
                )}
            </div>
        </header>
    )
}
