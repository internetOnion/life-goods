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
                "mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl flex-col px-4 py-6 sm:px-6 sm:py-8",
                className,
            )}
            {...props}
        >
            {children}
        </div>
    )
}
