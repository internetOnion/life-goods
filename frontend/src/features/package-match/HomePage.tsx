import {
    BarcodeIcon,
    CameraSlashIcon,
    InfoIcon,
    MagnifyingGlassIcon,
} from "@phosphor-icons/react"
import {
    type FormEvent,
    type KeyboardEvent,
    useEffect,
    useRef,
    useState,
} from "react"
import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { LanguageSwitchButton } from "@/ui/LanguageSwitchButton"
import { validateIdentifier, type IdentifierValidation } from "./identifier"

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
    const navigate = useNavigate()
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
    const [showIdentifierHint, setShowIdentifierHint] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (!enteredIdentifier && initialIdentifier) {
            setEnteredIdentifier(initialIdentifier)
        }
    }, [enteredIdentifier, initialIdentifier])

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
        void navigate(`/results/${validation.value}`)
    }

    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        submitIdentifier(enteredIdentifier)
    }

    const validationMessage = validationReason
        ? t(`error.${validationReason}`)
        : undefined
    const describedBy = [
        showIdentifierHint ? "identifier-hint" : null,
        validationMessage ? "identifier-error" : null,
    ]
        .filter(Boolean)
        .join(" ")

    const toggleIdentifierHint = () => {
        setShowIdentifierHint((isVisible) => !isVisible)
    }

    return (
        <main className="mx-auto w-[min(calc(100%_-_2rem),48rem)] space-y-3 pt-[calc(0.75rem_+_env(safe-area-inset-top))] pb-[calc(6.4rem_+_env(safe-area-inset-bottom))] max-[23.5rem]:w-[min(calc(100%_-_1.25rem),48rem)] sm:w-[min(calc(100%_-_3rem),48rem)] sm:pt-[calc(1.75rem_+_env(safe-area-inset-top))]">
            <section
                className="border-border bg-muted/60 before:border-primary/25 relative grid h-[clamp(16rem,44svh,26rem)] place-items-center overflow-hidden rounded-3xl border before:absolute before:size-[min(78%,22rem)] before:rotate-[-12deg] before:rounded-[42%_58%_48%_52%/54%_44%_56%_46%] before:border before:content-[''] max-[650px]:h-52"
                aria-label={t("cameraTitle")}
            >
                <span className="border-primary/70 absolute top-4 left-4 h-8 w-8 rounded-tl-lg border-t border-l" />
                <span className="border-primary/70 absolute top-4 right-4 h-8 w-8 rounded-tr-lg border-t border-r" />
                <span className="border-primary/70 absolute bottom-4 left-4 h-8 w-8 rounded-bl-lg border-b border-l" />
                <span className="border-primary/70 absolute right-4 bottom-4 h-8 w-8 rounded-br-lg border-r border-b" />
                <div className="relative z-10 grid max-w-md justify-items-center gap-3 px-8 py-8 text-center">
                    <span
                        className="border-primary/15 bg-background text-primary grid size-[4.6rem] place-items-center rounded-[44%_56%_50%_50%/52%_45%_55%_48%] border"
                        aria-hidden="true"
                    >
                        <CameraSlashIcon size={52} weight="light" />
                    </span>
                    <div>
                        <h1 className="text-xl leading-[1.7] font-bold tracking-tight text-balance">
                            {t("cameraTitle")}
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                            {t("cameraComingSoon")}
                        </p>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-[minmax(0,1fr)_3.5rem] px-4 sm:grid-cols-[minmax(0,1fr)_4rem] sm:px-5">
                <div className="col-start-2 justify-self-center">
                    <LanguageSwitchButton />
                </div>
            </div>

            <form
                className="border-border bg-background rounded-2xl border p-4 sm:p-5"
                noValidate
                onSubmit={onSubmit}
            >
                <div className="relative mb-2.5 flex items-center gap-1">
                    <Label className="text-primary" htmlFor="identifier">
                        {t("fieldLabel")}
                    </Label>
                    <Button
                        aria-controls="identifier-hint"
                        aria-expanded={showIdentifierHint}
                        aria-label={t(
                            showIdentifierHint
                                ? "fieldHintHide"
                                : "fieldHintShow",
                        )}
                        className="text-primary size-5 !min-h-0 p-0 hover:bg-transparent"
                        onClick={toggleIdentifierHint}
                        size="icon"
                        type="button"
                        variant="ghost"
                    >
                        <InfoIcon aria-hidden="true" size={19} />
                    </Button>
                    {showIdentifierHint ? (
                        <div
                            className="border-border bg-background text-foreground absolute top-[calc(100%+0.5rem)] right-0 z-20 w-[min(18rem,calc(100vw-2rem))] rounded-xl border p-3 text-left text-sm leading-relaxed shadow-lg sm:top-1/2 sm:right-auto sm:left-full sm:ml-2 sm:-translate-y-1/2"
                            id="identifier-hint"
                            role="note"
                        >
                            {t("fieldHint")}
                        </div>
                    ) : null}
                </div>
                <div
                    className={cn(
                        "border-input bg-background focus-within:border-ring focus-within:ring-ring/40 flex min-h-14 overflow-hidden rounded-xl border transition-colors focus-within:ring-2",
                        validationMessage &&
                            "border-destructive focus-within:border-destructive focus-within:ring-destructive/30",
                    )}
                >
                    <span
                        className="text-muted-foreground grid shrink-0 place-items-center pl-3"
                        aria-hidden="true"
                    >
                        <BarcodeIcon size={25} />
                    </span>
                    <Input
                        ref={inputRef}
                        className="h-auto min-w-0 flex-1 rounded-none border-0 px-3 py-3 text-base shadow-none focus-visible:ring-0"
                        id="identifier"
                        name="identifier"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={enteredIdentifier}
                        placeholder={t("fieldPlaceholder")}
                        aria-describedby={describedBy || undefined}
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
                    <Button
                        aria-label={t("submit")}
                        className="h-auto min-h-14 shrink-0 rounded-none px-4 sm:px-5"
                        type="submit"
                        disabled={!enteredIdentifier.trim()}
                    >
                        <MagnifyingGlassIcon aria-hidden="true" size={24} />
                    </Button>
                </div>
                {validationMessage ? (
                    <p
                        className="text-destructive mt-2 text-sm leading-relaxed font-semibold"
                        id="identifier-error"
                        role="alert"
                    >
                        {validationMessage}
                    </p>
                ) : null}
            </form>
        </main>
    )
}
