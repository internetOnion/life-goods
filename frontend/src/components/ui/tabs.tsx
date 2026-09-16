import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

type TabsVariant = "line" | "pills"

const TabsContext = React.createContext<{ variant: TabsVariant }>({
    variant: "line",
})

interface TabsProps extends React.ComponentPropsWithoutRef<
    typeof TabsPrimitive.Root
> {
    variant?: TabsVariant
}

const Tabs = React.forwardRef<
    React.ComponentRef<typeof TabsPrimitive.Root>,
    TabsProps
>(({ variant = "line", className, ...props }, ref) => (
    <TabsContext.Provider value={{ variant }}>
        <TabsPrimitive.Root ref={ref} className={className} {...props} />
    </TabsContext.Provider>
))
Tabs.displayName = TabsPrimitive.Root.displayName

const tabsListVariants = cva("flex items-center", {
    variants: {
        variant: {
            line: "w-full border-b border-neutral-200/80 bg-transparent p-0 gap-0",
            pills: "inline-flex h-10 items-center justify-center rounded-xl bg-neutral-100 p-1 text-neutral-500 border border-neutral-200/70",
        },
    },
    defaultVariants: {
        variant: "line",
    },
})

interface TabsListProps
    extends
        React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
        VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<
    React.ComponentRef<typeof TabsPrimitive.List>,
    TabsListProps
>(({ className, variant: variantProp, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    const variant = variantProp || context.variant

    return (
        <TabsPrimitive.List
            ref={ref}
            className={cn(tabsListVariants({ variant }), className)}
            {...props}
        />
    )
})
TabsList.displayName = TabsPrimitive.List.displayName

const tabsTriggerVariants = cva(
    "group relative inline-flex min-h-[44px] cursor-pointer items-center justify-center whitespace-nowrap ring-offset-white transition-all select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                line: "min-h-12 rounded-none px-4 py-3 text-sm font-bold text-neutral-600 hover:bg-transparent hover:text-neutral-950 after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:bg-primary-600 after:opacity-0 after:transition-opacity data-[state=active]:text-neutral-950 data-[state=active]:after:opacity-100",
                pills: "rounded-lg px-3.5 py-1.5 text-sm font-semibold text-neutral-600 hover:text-neutral-900 data-[state=active]:bg-primary-600 data-[state=active]:text-white data-[state=active]:shadow-xs",
            },
        },
        defaultVariants: {
            variant: "line",
        },
    },
)

interface TabsTriggerProps
    extends
        React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
        VariantProps<typeof tabsTriggerVariants> {}

const TabsTrigger = React.forwardRef<
    React.ComponentRef<typeof TabsPrimitive.Trigger>,
    TabsTriggerProps
>(({ className, variant: variantProp, ...props }, ref) => {
    const context = React.useContext(TabsContext)
    const variant = variantProp || context.variant

    return (
        <TabsPrimitive.Trigger
            ref={ref}
            className={cn(tabsTriggerVariants({ variant }), className)}
            {...props}
        />
    )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
    React.ComponentRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
        ref={ref}
        className={cn(
            "focus-visible:ring-primary-500 mt-3 ring-offset-white focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            className,
        )}
        {...props}
    />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsContent, TabsList, TabsTrigger }
