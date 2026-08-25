import { BarcodeIcon, CameraSlashIcon } from "@phosphor-icons/react"
import {
    type FormEvent,
    type KeyboardEvent,
    useEffect,
    useRef,
    useState,
} from "react"
import { useTranslation } from "react-i18next"
import { useLocation } from "react-router"

import { validateIdentifier, type IdentifierValidation } from "./identifier"
import { ProductDetailsSheet } from "./ProductDetailsSheet"

type HomePageProps = {
    initialIdentifier: string
    onIdentifierChange: (identifier: string) => void
}

type HomeLocationState = {
    invalidIdentifier?: string
}

export function HomePage({
    initialIdentifier,
    onIdentifierChange,
}: HomePageProps) {
    const { t } = useTranslation()
    const location = useLocation()
    const locationState = location.state as HomeLocationState | null
    const seededIdentifier =
        locationState?.invalidIdentifier ?? initialIdentifier
    const seededValidation = locationState?.invalidIdentifier
        ? validateIdentifier(locationState.invalidIdentifier)
        : undefined
    const [enteredIdentifier, setEnteredIdentifier] = useState(seededIdentifier)
    const [validationReason, setValidationReason] = useState<
        Extract<IdentifierValidation, { valid: false }>["reason"] | null
    >(
        seededValidation && !seededValidation.valid
            ? seededValidation.reason
            : null,
    )
    const inputRef = useRef<HTMLInputElement>(null)
    const wasSheetOpenRef = useRef(false)
    const [sheetIdentifier, setSheetIdentifier] = useState<string | null>(null)

    useEffect(() => {
        if (!enteredIdentifier && initialIdentifier) {
            setEnteredIdentifier(initialIdentifier)
        }
    }, [enteredIdentifier, initialIdentifier])

    useEffect(() => {
        const isSheetOpen = sheetIdentifier !== null
        if (!isSheetOpen && wasSheetOpenRef.current) {
            inputRef.current?.focus()
        }
        wasSheetOpenRef.current = isSheetOpen
    }, [sheetIdentifier])

    const submitIdentifier = (value: string) => {
        const validation = validateIdentifier(value)
        if (!validation.valid) {
            setValidationReason(validation.reason)
            inputRef.current?.focus()
            return
        }

        setValidationReason(null)
        setEnteredIdentifier(validation.value)
        onIdentifierChange(validation.value)
        setSheetIdentifier(validation.value)
    }

    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        submitIdentifier(enteredIdentifier)
    }

    const validationMessage = validationReason
        ? t(`error.${validationReason}`)
        : undefined

    return (
        <>
            <main className="home-page page-with-nav">
            <section
                className="camera-placeholder"
                aria-label={t("cameraTitle")}
            >
                <span className="camera-corner camera-corner--top-left" />
                <span className="camera-corner camera-corner--top-right" />
                <span className="camera-corner camera-corner--bottom-left" />
                <span className="camera-corner camera-corner--bottom-right" />
                <div className="camera-placeholder__content">
                    <span
                        className="camera-placeholder__icon"
                        aria-hidden="true"
                    >
                        <CameraSlashIcon size={52} weight="light" />
                    </span>
                </div>
            </section>

            <form className="barcode-form" noValidate onSubmit={onSubmit}>
                <label htmlFor="identifier">{t("fieldLabel")}</label>
                <div
                    className={`barcode-control${validationMessage ? " barcode-control--invalid" : ""}`}
                >
                    <span className="barcode-control__icon" aria-hidden="true">
                        <BarcodeIcon size={25} />
                    </span>
                    <input
                        ref={inputRef}
                        id="identifier"
                        name="identifier"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={enteredIdentifier}
                        placeholder={t("fieldPlaceholder")}
                        aria-describedby={
                            validationMessage ? "identifier-error" : undefined
                        }
                        aria-errormessage={
                            validationMessage ? "identifier-error" : undefined
                        }
                        aria-invalid={validationMessage ? true : undefined}
                        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                            if (
                                event.key === "Enter" &&
                                !enteredIdentifier.trim()
                            ) {
                                event.preventDefault()
                                submitIdentifier(enteredIdentifier)
                            }
                        }}
                        onChange={(event) => {
                            setEnteredIdentifier(event.target.value)
                            onIdentifierChange(event.target.value)
                            setValidationReason(null)
                        }}
                    />
                    <button type="submit" disabled={!enteredIdentifier.trim()}>
                        <span>{t("submit")}</span>
                    </button>
                </div>
                {validationMessage ? (
                    <p
                        className="field-error"
                        id="identifier-error"
                        role="alert"
                    >
                        {validationMessage}
                    </p>
                ) : null}
            </form>
            </main>
            <ProductDetailsSheet
                identifier={sheetIdentifier ?? ""}
                open={sheetIdentifier !== null}
                onClose={() => setSheetIdentifier(null)}
            />
        </>
    )
}
