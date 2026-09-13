import { BadgeCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type SymbolsCardProps = {
    labels: string[]
}

export function SymbolsCard({ labels }: SymbolsCardProps) {
    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="p-4 pb-2 sm:p-5">
                <div className="flex items-center gap-2.5">
                    <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-neutral-100 text-neutral-700">
                        <BadgeCheck className="h-4 w-4" />
                    </div>
                    <CardTitle className="text-sm font-bold tracking-[-0.015em] text-neutral-900 sm:text-base">
                        Labels, Certifications & Awards
                    </CardTitle>
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-2 sm:p-5">
                {labels.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                        {labels.map((label) => (
                            <Badge
                                key={label}
                                variant="outline"
                                className="bg-neutral-50 text-xs font-semibold capitalize"
                            >
                                {label}
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-neutral-600">
                        Source Data Unavailable
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
