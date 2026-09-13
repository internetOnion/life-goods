import { Info } from "lucide-react"
import React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface CountryTagInfoCardProps {
    languages: string[]
}

export const CountryTagInfoCard: React.FC<CountryTagInfoCardProps> = ({
    languages,
}) => (
    <Card className="border-info-200/90 bg-info-50/90 text-info-950 shadow-none">
        <CardHeader className="flex flex-row items-start gap-2 p-4 pb-2 sm:p-5">
            <Info className="text-info-700 mt-0.5 h-4 w-4 shrink-0" />
            <CardTitle className="text-info-950 text-sm font-bold tracking-[-0.015em] sm:text-base">
                Languages recorded on the label
            </CardTitle>
        </CardHeader>
        <CardContent className="text-info-900 space-y-2 p-4 pt-1 text-xs leading-relaxed sm:p-5">
            <p>
                Open Food Facts lists these languages for the Product label.
                This does not mean that every Product field is available in each
                language.
            </p>
            <div className="border-info-200/80 space-y-1.5 border-t pt-2">
                {languages.length > 0 ? (
                    <div
                        className="flex flex-wrap gap-1.5"
                        aria-label="Languages recorded on the label"
                    >
                        {languages.map((language) => (
                            <code
                                key={language}
                                className="border-info-200 text-info-900 rounded-md border bg-white/70 px-2 py-1 font-mono text-[0.7rem] font-semibold"
                            >
                                {language}
                            </code>
                        ))}
                    </div>
                ) : (
                    <p className="text-info-800 font-medium">
                        Source Data Unavailable
                    </p>
                )}
            </div>
        </CardContent>
    </Card>
)
