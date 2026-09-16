import React from "react"

import { cn } from "@/lib/utils"

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode
}

export const Container: React.FC<ContainerProps> = ({
    children,
    className,
    ...props
}) => {
    return (
        <div
            className={cn(
                "page-rail flex min-h-[calc(100svh-4rem)] flex-col sm:px-6 sm:py-8",
                className,
            )}
            {...props}
        >
            {children}
        </div>
    )
}
