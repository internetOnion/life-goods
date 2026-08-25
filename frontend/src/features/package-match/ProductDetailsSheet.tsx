import {
    BarcodeIcon,
    FactoryIcon,
    ForkKnifeIcon,
    ImageSquareIcon,
    InfoIcon,
    LeafIcon,
    XIcon,
} from "@phosphor-icons/react"
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type PointerEvent as ReactPointerEvent,
    type ReactNode,
} from "react"
import { useTranslation } from "react-i18next"

type ProductDetailsSheetData = {
    name?: string
    brand?: string
    origin?: string
    category?: string
    quantity?: string
    ingredients?: string
    allergens?: string
    manufacturer?: string
    energy?: string
    protein?: string
    fat?: string
    carbohydrates?: string
    sugars?: string
}

export type ProductDetailsSheetProps = {
    identifier: string
    open: boolean
    onClose: () => void
    placeholderData?: ProductDetailsSheetData
}

const unavailable = "—"

export function ProductDetailsSheet({
    identifier,
    open,
    onClose,
    placeholderData,
}: ProductDetailsSheetProps) {
    const { t } = useTranslation()
    const sheetRef = useRef<HTMLElement>(null)
    const closeTimerRef = useRef<number | null>(null)
    const dragStartYRef = useRef<number | null>(null)
    const [isClosing, setIsClosing] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [dragOffset, setDragOffset] = useState(0)

    const data = placeholderData ?? {}
    const display = (value?: string) => value?.trim() || unavailable

    const requestClose = useCallback(() => {
        if (isClosing) return

        setIsClosing(true)
        closeTimerRef.current = window.setTimeout(() => {
            onClose()
        }, 220)
    }, [isClosing, onClose])

    useEffect(() => {
        if (!open) {
            setIsClosing(false)
            setDragOffset(0)
            setIsDragging(false)
            return
        }

        sheetRef.current?.focus()

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        return () => {
            document.body.style.overflow = previousOverflow
        }
    }, [open])

    useEffect(() => {
        return () => {
            if (closeTimerRef.current !== null) {
                window.clearTimeout(closeTimerRef.current)
            }
        }
    }, [])

    useEffect(() => {
        if (!open) return

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault()
                requestClose()
            }
        }

        document.addEventListener("keydown", handleKeyDown)
        return () => document.removeEventListener("keydown", handleKeyDown)
    }, [open, requestClose])

    const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "mouse" && event.button !== 0) return

        dragStartYRef.current = event.clientY
        setIsDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
    }

    const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (dragStartYRef.current === null) return

        const offset = Math.max(0, event.clientY - dragStartYRef.current)
        setDragOffset(offset)
    }

    const finishPointerDrag = () => {
        if (dragStartYRef.current === null) return

        const closeThreshold = Math.max(
            120,
            (sheetRef.current?.offsetHeight ?? window.innerHeight) * 0.24,
        )
        const shouldClose = dragOffset >= closeThreshold

        dragStartYRef.current = null
        setIsDragging(false)

        if (shouldClose) {
            requestClose()
            return
        }

        setDragOffset(0)
    }

    if (!open && !isClosing) return null

    const sheetStyle =
        isDragging || dragOffset > 0 || isClosing
            ? {
                  transform: `translateY(${isClosing ? "100%" : `${dragOffset}px`})`,
                  transition: isDragging ? "none" : undefined,
              }
            : undefined

    return (
        <div className="product-sheet-layer">
            <div className="product-sheet-backdrop" aria-hidden="true" />
            <section
                ref={sheetRef}
                className={`product-sheet${isClosing ? " product-sheet--closing" : ""}`}
                style={sheetStyle}
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-details-title"
                aria-describedby="product-details-description"
                tabIndex={-1}
            >
                <header className="product-sheet__header">
                    <div
                        className="product-sheet__drag-handle"
                        aria-hidden="true"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={finishPointerDrag}
                        onPointerCancel={finishPointerDrag}
                    >
                        <span />
                    </div>
                    <h2 id="product-details-title">
                        {t("productDetailsTitle")}
                    </h2>
                    <button
                        className="product-sheet__close"
                        type="button"
                        aria-label={t("productDetailsClose")}
                        onClick={requestClose}
                    >
                        <XIcon aria-hidden="true" size={22} weight="regular" />
                    </button>
                </header>

                <div
                    className="product-sheet__scroll"
                    aria-label={t("productDetailsScrollRegion")}
                    tabIndex={0}
                >
                    <p
                        className="product-sheet__description"
                        id="product-details-description"
                    >
                        {t("productDetailsDescription")}
                    </p>

                    <section
                        className="product-sheet__identity"
                        aria-label={t("productDetailsIdentity")}
                    >
                        <div
                            className="product-sheet__image-placeholder"
                            role="img"
                            aria-label={t("productDetailsImageAlt")}
                        >
                            <ImageSquareIcon
                                aria-hidden="true"
                                size={40}
                                weight="light"
                            />
                            <span>{t("productDetailsImagePlaceholder")}</span>
                        </div>
                        <div className="product-sheet__identity-copy">
                            <h3>{display(data.name)}</h3>
                            <div
                                className="product-sheet__chips"
                                aria-label={t("productDetailsTags")}
                            >
                                <span>{display(data.category)}</span>
                                <span>{display(data.quantity)}</span>
                            </div>
                            <p className="product-sheet__placeholder-note">
                                {t("productDetailsPlaceholderNote")}
                            </p>
                        </div>
                    </section>

                    <SheetPanel
                        icon={<InfoIcon aria-hidden="true" size={20} />}
                        title={t("productDetailsInformation")}
                    >
                        <dl className="product-sheet__facts">
                            <FactRow label={t("productDetailsBrand")} value={display(data.brand)} />
                            <FactRow label={t("productDetailsOrigin")} value={display(data.origin)} />
                            <FactRow label={t("productDetailsBarcode")} value={display(identifier)} />
                            <FactRow label={t("productDetailsCategory")} value={display(data.category)} />
                        </dl>
                    </SheetPanel>

                    <SheetPanel
                        icon={<ForkKnifeIcon aria-hidden="true" size={20} />}
                        title={t("productDetailsNutrition")}
                        trailing={t("productDetailsPer100")}
                    >
                        <dl className="product-sheet__nutrition">
                            <FactRow label={t("productDetailsEnergy")} value={display(data.energy)} />
                            <FactRow label={t("productDetailsProtein")} value={display(data.protein)} />
                            <FactRow label={t("productDetailsFat")} value={display(data.fat)} />
                            <FactRow label={t("productDetailsCarbohydrates")} value={display(data.carbohydrates)} />
                            <FactRow label={t("productDetailsSugars")} value={display(data.sugars)} />
                        </dl>
                    </SheetPanel>

                    <SheetPanel
                        icon={<LeafIcon aria-hidden="true" size={20} />}
                        title={t("productDetailsIngredients")}
                    >
                        <p className="product-sheet__panel-value">
                            {display(data.ingredients)}
                        </p>
                    </SheetPanel>

                    <SheetPanel
                        icon={<InfoIcon aria-hidden="true" size={20} />}
                        title={t("productDetailsAllergens")}
                    >
                        <p className="product-sheet__panel-value">
                            {display(data.allergens)}
                        </p>
                    </SheetPanel>

                    <SheetPanel
                        icon={<FactoryIcon aria-hidden="true" size={20} />}
                        title={t("productDetailsManufacturer")}
                    >
                        <p className="product-sheet__panel-value">
                            {display(data.manufacturer)}
                        </p>
                    </SheetPanel>

                    <div className="product-sheet__footer-note">
                        <BarcodeIcon aria-hidden="true" size={18} />
                        <span>{t("productDetailsSourceNotice")}</span>
                    </div>
                </div>
            </section>
        </div>
    )
}

function SheetPanel({
    children,
    icon,
    title,
    trailing,
}: {
    children: ReactNode
    icon: ReactNode
    title: string
    trailing?: string
}) {
    return (
        <section className="product-sheet__panel">
            <div className="product-sheet__panel-heading">
                <div className="product-sheet__panel-title">
                    {icon}
                    <h3>{title}</h3>
                </div>
                {trailing ? (
                    <span className="product-sheet__panel-trailing">
                        {trailing}
                    </span>
                ) : null}
            </div>
            {children}
        </section>
    )
}

function FactRow({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt>{label}</dt>
            <dd>{value}</dd>
        </div>
    )
}
