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
                How to read country and language tags
            </CardTitle>
        </CardHeader>
        <CardContent className="text-info-900 space-y-2 p-4 pt-1 text-xs leading-relaxed sm:p-5">
            <p>
                In <code className="font-mono font-semibold">en:algeria</code>,
                <code className="ml-1 font-mono font-semibold">en</code> is the
                language used for the country name, and
                <code className="ml-1 font-mono font-semibold">algeria</code> is
                the country.
            </p>
            <p>
                This does not mean that English appears on the Product label.
                Check{" "}
                <code className="font-mono font-semibold">languages_tags</code>
                for the languages recorded on the label.
            </p>
            <p>
                Language tags use the same format:{" "}
                <code className="font-mono font-semibold">en:english</code>,{" "}
                <code className="font-mono font-semibold">fr:french</code>, or{" "}
                <code className="font-mono font-semibold">km:khmer</code>. The
                first part is the language code; the second part is the language
                name.
            </p>
            <div className="border-info-200/80 space-y-1.5 border-t pt-2">
                <p className="text-info-950 font-bold">
                    Languages recorded on the label
                </p>
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
