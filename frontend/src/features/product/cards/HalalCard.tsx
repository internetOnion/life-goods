import {
    AlertCircle,
    BookOpen,
    CheckCircle2,
    HelpCircle,
    Info,
    ShieldCheck,
    XCircle,
} from "lucide-react"
import React from "react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type {
    HalalIngredientAssessmentOutcome,
    HalalIngredientAssessmentResponse,
    PackageMatchEvidenceResponse,
} from "@/features/product/types"

interface HalalCardProps {
    assessment?: HalalIngredientAssessmentResponse | null
    labelEvidence?: PackageMatchEvidenceResponse[]
}

const OUTCOME_CONFIG: Record<
    HalalIngredientAssessmentOutcome,
    {
        title: string
        desc: string
        variant: "success" | "warning" | "error" | "secondary"
        Icon: React.FC<{ className?: string }>
    }
> = {
    NO_NON_HALAL_INGREDIENT_DETECTED_IN_READABLE_LABEL: {
        title: "No Non-Halal Ingredients Detected",
        desc: "All declared ingredients in the readable label conform to permissible dietary standards under assessed rules.",
        variant: "success",
        Icon: CheckCircle2,
    },
    SOURCE_AMBIGUOUS: {
        title: "Source Ambiguous Ingredients Present",
        desc: "Contains ingredients (e.g. gelatine, enzymes, mono-glycerides) whose animal or synthetic origin is not specified on the label.",
        variant: "warning",
        Icon: HelpCircle,
    },
    EXPLICIT_PROHIBITED_INGREDIENT_DECLARED: {
        title: "Explicit Prohibited Ingredient Declared",
        desc: "Label explicitly declares prohibited substances (e.g. pork, lard, alcohol, non-halal animal fats).",
        variant: "error",
        Icon: XCircle,
    },
    LABEL_INCOMPLETE_OR_UNREADABLE: {
        title: "Label Incomplete or Unreadable",
        desc: "The ingredient declaration could not be completely verified due to missing or low-resolution label data.",
        variant: "secondary",
        Icon: AlertCircle,
    },
    NOT_ASSESSED: {
        title: "Raw Product Record (Unassessed)",
        desc: "Open Food Facts community record without automated jurisprudence assessment.",
        variant: "secondary",
        Icon: Info,
    },
}

export const HalalCard: React.FC<HalalCardProps> = ({
    assessment,
    labelEvidence,
}) => {
    // Check if label explicitly carries Halal certification claim
    const halalClaimItem = labelEvidence?.find(
        (e) => e.field === "halal_label_claim",
    )
    const hasHalalClaim = Boolean(halalClaimItem?.value)

    const outcome = assessment?.outcome || "NOT_ASSESSED"
    const config = OUTCOME_CONFIG[outcome] || OUTCOME_CONFIG.NOT_ASSESSED
    const OutcomeIcon = config.Icon
    const findings = assessment?.findings || []
    const hasAssessment =
        assessment?.status === "COMPLETED" && outcome !== "NOT_ASSESSED"

    if (!hasHalalClaim && !hasAssessment && findings.length === 0) return null

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2 sm:p-5 sm:pb-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-neutral-500" />
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        Halal & Dietary Assessment
                    </CardTitle>
                </div>

                {hasHalalClaim && (
                    <Badge
                        variant="accent"
                        className="py-0.2 text-caption px-2 font-semibold"
                    >
                        Halal Claim on Label
                    </Badge>
                )}
            </CardHeader>

            <CardContent className="space-y-4 p-4 pt-2 sm:p-5 sm:pt-2">
                {/* Outcome Summary Box */}
                {hasAssessment && (
                    <div
                        className={`space-y-1.5 rounded-2xl border p-3.5 ${
                            config.variant === "success"
                                ? "border-success-200 bg-success-50/60 text-success-950"
                                : config.variant === "warning"
                                  ? "border-warning-200 bg-warning-50/70 text-warning-950"
                                  : config.variant === "error"
                                    ? "border-error-200 bg-error-50/70 text-error-950"
                                    : "border-neutral-200/80 bg-neutral-50/70 text-neutral-800"
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <OutcomeIcon
                                className={`h-4 w-4 shrink-0 ${
                                    config.variant === "success"
                                        ? "text-success-600"
                                        : config.variant === "warning"
                                          ? "text-warning-600"
                                          : config.variant === "error"
                                            ? "text-error-600"
                                            : "text-neutral-500"
                                }`}
                            />
                            <h4 className="text-xs font-bold sm:text-sm">
                                {config.title}
                            </h4>
                        </div>
                        <p className="text-xs leading-relaxed opacity-95 sm:text-sm">
                            {config.desc}
                        </p>
                    </div>
                )}

                {/* Manufacturer Claim */}
                {hasHalalClaim && (
                    <div className="rounded-xl border border-neutral-200/70 bg-neutral-50 p-3">
                        <p className="text-xs leading-relaxed font-medium text-neutral-800 italic sm:text-sm">
                            Open Food Facts lists a Halal label claim for this
                            Product. Life Goods has not verified the claim or a
                            certificate.
                        </p>
                    </div>
                )}

                {/* Assessed Ingredient Findings */}
                {findings.length > 0 && (
                    <div className="space-y-2">
                        <span className="text-xs font-bold text-neutral-900 sm:text-sm">
                            Evaluated Ingredient Findings ({findings.length}):
                        </span>
                        <div className="space-y-1.5">
                            {findings.map((f) => (
                                <div
                                    key={f.id}
                                    className="flex flex-col justify-between gap-1.5 rounded-xl border border-neutral-200/70 bg-neutral-50 p-2.5 text-xs sm:flex-row sm:items-center"
                                >
                                    <div className="min-w-0">
                                        <span className="font-bold text-neutral-900">
                                            "{f.matched_text}"
                                        </span>
                                        <span className="text-caption ml-1.5 text-neutral-500">
                                            ({f.relationship_type})
                                        </span>
                                    </div>
                                    <Badge
                                        variant={
                                            f.classification ===
                                            "EXPLICIT_PROHIBITED"
                                                ? "error"
                                                : "warning"
                                        }
                                        className="py-0.2 text-micro shrink-0 self-start px-2 font-bold tracking-wider uppercase sm:self-auto"
                                    >
                                        {f.classification.replace(/_/g, " ")}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Citations Reference */}
                {assessment?.reference_dataset_version && (
                    <div className="text-caption flex items-center gap-1.5 border-t border-neutral-100 pt-1 text-neutral-600">
                        <BookOpen className="h-3 w-3 shrink-0" />
                        <span>
                            Jurisprudence ruleset:{" "}
                            {assessment.reference_dataset_version.review_kind ||
                                "Standards Ref"}{" "}
                            v{assessment.reference_dataset_version.id}
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
