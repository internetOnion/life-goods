import { ShieldCheck } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"

import { useCompareTranslation } from "./translations"

/**
 * Pre-submission statement required by SPEC §28/§29: shown beside the control
 * that submits photos, before any photo leaves the device, never collapsed.
 */
export function ProviderDisclosure({ className }: { className?: string }) {
    const { t } = useCompareTranslation()
    return (
        <p
            className={cn(
                "flex items-start gap-2 text-xs leading-relaxed text-neutral-600",
                className,
            )}
            data-testid="provider-disclosure"
        >
            <ShieldCheck
                size={15}
                weight="bold"
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-neutral-500"
            />
            <span>{t("providerDisclosure")}</span>
        </p>
    )
}
