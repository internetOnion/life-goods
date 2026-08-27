import * as React from "react"

import { cn } from "@/lib/utils"

type TabsContextValue = {
    value: string
    setValue: (value: string) => void
    register: (value: string, element: HTMLButtonElement | null) => void
    values: string[]
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

type TabsProps = {
    defaultValue: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
}

export function Tabs({ defaultValue, onValueChange, children }: TabsProps) {
    const [value, setValueState] = React.useState(defaultValue)
    const [values, setValues] = React.useState<string[]>([])
    const registered = React.useRef(new Map<string, HTMLButtonElement | null>())

    const setValue = React.useCallback(
        (nextValue: string) => {
            setValueState(nextValue)
            onValueChange?.(nextValue)
        },
        [onValueChange],
    )

    const register = React.useCallback(
        (tabValue: string, element: HTMLButtonElement | null) => {
            if (element) registered.current.set(tabValue, element)
            else registered.current.delete(tabValue)
            setValues(Array.from(registered.current.keys()))
        },
        [],
    )

    const context = React.useMemo<TabsContextValue>(
        () => ({
            value,
            setValue,
            register,
            values,
        }),
        [register, setValue, value, values],
    )

    return (
        <TabsContext.Provider value={context}>{children}</TabsContext.Provider>
    )
}

export const TabsList = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        role="tablist"
        className={cn("flex items-center", className)}
        {...props}
    />
))
TabsList.displayName = "TabsList"

type TabsTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
    value: string
}

export const TabsTrigger = React.forwardRef<
    HTMLButtonElement,
    TabsTriggerProps
>(
    (
        { className, value: tabValue, onClick, onKeyDown, ...props },
        forwardedRef,
    ) => {
        const context = React.useContext(TabsContext)
        if (!context) throw new Error("TabsTrigger must be used inside Tabs")
        const { register } = context
        const localRef = React.useRef<HTMLButtonElement | null>(null)
        const selected = context.value === tabValue

        React.useEffect(() => {
            register(tabValue, localRef.current)
            return () => register(tabValue, null)
        }, [register, tabValue])

        const setRefs = (element: HTMLButtonElement | null) => {
            localRef.current = element
            if (typeof forwardedRef === "function") forwardedRef(element)
            else if (forwardedRef) forwardedRef.current = element
        }

        const handleKeyDown = (
            event: React.KeyboardEvent<HTMLButtonElement>,
        ) => {
            if (context.values.length === 0) return
            const currentIndex = context.values.indexOf(tabValue)
            const nextIndex =
                event.key === "ArrowRight"
                    ? (currentIndex + 1) % context.values.length
                    : event.key === "ArrowLeft"
                      ? (currentIndex - 1 + context.values.length) %
                        context.values.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? context.values.length - 1
                          : -1
            if (nextIndex < 0 || !context.values[nextIndex]) {
                onKeyDown?.(event)
                return
            }
            event.preventDefault()
            const nextValue = context.values[nextIndex]
            context.setValue(nextValue)
            registeredButton(nextValue)?.focus()
            onKeyDown?.(event)
        }

        return (
            <button
                ref={setRefs}
                type="button"
                role="tab"
                id={`tabs-trigger-${tabValue}`}
                data-tabs-value={tabValue}
                data-state={selected ? "active" : "inactive"}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                onClick={(event) => {
                    context.setValue(tabValue)
                    onClick?.(event)
                }}
                onKeyDown={handleKeyDown}
                className={cn("min-h-11", className)}
                {...props}
            />
        )
    },
)
TabsTrigger.displayName = "TabsTrigger"

export function TabsContent({
    value: tabValue,
    className,
    children,
    ...props
}: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
    const context = React.useContext(TabsContext)
    if (!context) throw new Error("TabsContent must be used inside Tabs")
    if (context.value !== tabValue) return null

    return (
        <div
            id={`tabs-panel-${tabValue}`}
            role="tabpanel"
            tabIndex={0}
            aria-labelledby={`tabs-trigger-${tabValue}`}
            className={className}
            {...props}
        >
            {children}
        </div>
    )
}

function registeredButton(value: string) {
    const element = document.querySelector<HTMLButtonElement>(
        `[data-tabs-value="${value}"]`,
    )
    return element
}
