import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { useLocation, useNavigate } from "react-router"

import {
    createBrowserPackageCamera,
    type CapturedPackagePhoto,
} from "./browserPackageCamera"
import {
    buildCaptureResultUrl,
    buildCaptureUrl,
    getRequestedCaptureStep,
    resolveCaptureStep,
    type CaptureStep,
} from "./captureRoute"

export type CameraState = "idle" | "opening" | "live" | "error"
export type CameraError = "denied" | "unavailable" | "interrupted" | "capture"

type PackageCaptureJourney = {
    step: CaptureStep
    photos: {
        front: CapturedPackagePhoto | null
        back: CapturedPackagePhoto | null
        ingredients: CapturedPackagePhoto | null
        current: CapturedPackagePhoto | null
    }
    ingredientDecision: "pending" | "captured" | "skipped"
    camera: {
        state: CameraState
        ready: boolean
        error: CameraError | null
        videoRef: RefObject<HTMLVideoElement | null>
    }
    headingRef: RefObject<HTMLHeadingElement | null>
    showReloadRecovery: boolean
    actions: {
        markCameraReady: () => void
        handleCameraInterruption: () => void
        openCamera: () => Promise<void>
        takePhoto: () => Promise<void>
        retake: () => void
        continueJourney: () => void
        skipIngredients: () => void
        editStep: (step: "front" | "back" | "ingredients") => void
        startDemo: () => void
    }
}

function cameraErrorFrom(error: unknown): CameraError {
    if (error instanceof DOMException) {
        if (
            error.name === "NotAllowedError" ||
            error.name === "SecurityError"
        ) {
            return "denied"
        }
        if (
            error.name === "NotFoundError" ||
            error.name === "NotReadableError" ||
            error.name === "NotSupportedError"
        ) {
            return "unavailable"
        }
    }
    return "capture"
}

function isCameraRequestCancelled(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError"
}

export function usePackageCaptureJourney(): PackageCaptureJourney {
    const location = useLocation()
    const navigate = useNavigate()
    const requestedStep = getRequestedCaptureStep(location.search)
    const [camera] = useState(createBrowserPackageCamera)
    const videoRef = useRef<HTMLVideoElement>(null)
    const headingRef = useRef<HTMLHeadingElement>(null)
    const isLeavingCaptureRef = useRef(false)
    const cameraResetStepRef = useRef<CaptureStep | null>(null)
    const autoOpenStepRef = useRef<CaptureStep | null>(null)
    const autoOpenedStepRef = useRef<CaptureStep | null>(null)
    const returnToReviewRef = useRef(false)
    const mountedRef = useRef(true)
    const [frontPhoto, setFrontPhoto] = useState<CapturedPackagePhoto | null>(
        null,
    )
    const [backPhoto, setBackPhoto] = useState<CapturedPackagePhoto | null>(
        null,
    )
    const [ingredientPhoto, setIngredientPhoto] =
        useState<CapturedPackagePhoto | null>(null)
    const [ingredientDecision, setIngredientDecision] = useState<
        "pending" | "captured" | "skipped"
    >("pending")
    const [cameraState, setCameraState] = useState<CameraState>("idle")
    const [cameraReady, setCameraReady] = useState(false)
    const [cameraError, setCameraError] = useState<CameraError | null>(null)
    const [cameraPermissionGranted, setCameraPermissionGranted] =
        useState(false)
    const [showReloadRecovery] = useState(requestedStep !== "front")

    const discardCapturedMedia = useCallback(() => {
        camera.dispose()
        setFrontPhoto(null)
        setBackPhoto(null)
        setIngredientPhoto(null)
        setIngredientDecision("pending")
    }, [camera])

    const resetCameraStatus = useCallback(() => {
        setCameraState("idle")
        setCameraReady(false)
        setCameraError(null)
    }, [])

    const step = resolveCaptureStep(
        requestedStep,
        frontPhoto !== null,
        backPhoto !== null,
        ingredientPhoto !== null,
        ingredientDecision,
    )
    const currentPhoto =
        step === "front"
            ? frontPhoto
            : step === "back"
              ? backPhoto
              : ingredientPhoto

    const handleCameraInterruption = useCallback(() => {
        camera.stop()
        if (!mountedRef.current) return
        setCameraState("error")
        setCameraReady(false)
        setCameraError("interrupted")
    }, [camera])

    useEffect(() => {
        const normalizedUrl = buildCaptureUrl(step, location.search)
        if (
            !isLeavingCaptureRef.current &&
            `${location.pathname}${location.search}` !== normalizedUrl
        ) {
            void navigate(normalizedUrl, { replace: true })
        }
    }, [location.pathname, location.search, navigate, step])

    useEffect(() => {
        headingRef.current?.focus()
        if (cameraResetStepRef.current === step) return
        cameraResetStepRef.current = step
        camera.stop()
        setCameraState("idle")
        setCameraReady(false)
        setCameraError(null)
    }, [camera, step])

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            queueMicrotask(() => {
                if (!mountedRef.current) camera.dispose()
            })
        }
    }, [camera])

    useEffect(() => {
        if (step === "review") return
        if (!navigator.permissions?.query) return

        let cancelled = false
        let permissionStatus: PermissionStatus | null = null
        const syncPermission = () => {
            if (cancelled || !permissionStatus) return
            const granted = permissionStatus.state === "granted"
            setCameraPermissionGranted(granted)
        }

        void navigator.permissions
            .query({ name: "camera" })
            .then((status) => {
                if (cancelled) return
                permissionStatus = status
                syncPermission()
                status.addEventListener("change", syncPermission)
            })
            .catch(() => undefined)

        return () => {
            cancelled = true
            permissionStatus?.removeEventListener("change", syncPermission)
        }
    }, [step])

    useEffect(() => {
        const interruptHiddenCamera = () => {
            if (
                document.visibilityState !== "visible" &&
                cameraState === "live"
            ) {
                handleCameraInterruption()
            }
        }
        const clearLeavingPage = () => {
            discardCapturedMedia()
            if (mountedRef.current) {
                resetCameraStatus()
            }
        }
        const restartRestoredPage = (event: PageTransitionEvent) => {
            if (!event.persisted) return
            isLeavingCaptureRef.current = false
            discardCapturedMedia()
            resetCameraStatus()
            void navigate(buildCaptureUrl("front", location.search), {
                replace: true,
            })
        }
        document.addEventListener("visibilitychange", interruptHiddenCamera)
        window.addEventListener("pagehide", clearLeavingPage)
        window.addEventListener("pageshow", restartRestoredPage)
        return () => {
            document.removeEventListener(
                "visibilitychange",
                interruptHiddenCamera,
            )
            window.removeEventListener("pagehide", clearLeavingPage)
            window.removeEventListener("pageshow", restartRestoredPage)
        }
    }, [
        camera,
        cameraState,
        discardCapturedMedia,
        handleCameraInterruption,
        location.search,
        navigate,
        resetCameraStatus,
    ])

    const goToStep = (nextStep: CaptureStep) => {
        camera.stop()
        if (nextStep !== "review" && nextStep !== "close-up") {
            autoOpenStepRef.current = nextStep
        }
        void navigate(buildCaptureUrl(nextStep, location.search))
    }

    const continueJourney = () => {
        if (step === "close-up") {
            if (!ingredientPhoto) return
            isLeavingCaptureRef.current = true
            discardCapturedMedia()
            void navigate(
                buildCaptureResultUrl(
                    "/captures/demo-capture",
                    "completed",
                    location.search,
                ),
            )
            return
        }
        if (returnToReviewRef.current) {
            returnToReviewRef.current = false
            camera.stop()
            void navigate(buildCaptureUrl("review", location.search))
            return
        }
        goToStep(
            step === "front"
                ? "back"
                : step === "back"
                  ? "ingredients"
                  : "review",
        )
    }

    const skipIngredients = () => {
        if (step !== "ingredients") return
        camera.stop()
        if (ingredientPhoto) camera.discard(ingredientPhoto)
        setIngredientPhoto(null)
        setIngredientDecision("skipped")
        if (returnToReviewRef.current) {
            returnToReviewRef.current = false
            void navigate(buildCaptureUrl("review", location.search))
            return
        }
        void navigate(buildCaptureUrl("review", location.search))
    }

    const editStep = (nextStep: "front" | "back" | "ingredients") => {
        returnToReviewRef.current = true
        if (nextStep === "ingredients" && !ingredientPhoto) {
            setIngredientDecision("pending")
        }
        camera.stop()
        autoOpenStepRef.current = nextStep
        void navigate(buildCaptureUrl(nextStep, location.search))
    }

    const openCamera = useCallback(async () => {
        const video = videoRef.current
        if (!video) return
        setCameraState("opening")
        setCameraReady(false)
        setCameraError(null)
        try {
            await camera.open(video, handleCameraInterruption)
            if (!mountedRef.current) return
            setCameraPermissionGranted(true)
            setCameraState("live")
        } catch (error) {
            if (!mountedRef.current) return
            camera.stop()
            if (isCameraRequestCancelled(error)) {
                resetCameraStatus()
                return
            }
            setCameraState("error")
            setCameraError(cameraErrorFrom(error))
        }
    }, [camera, handleCameraInterruption, resetCameraStatus])

    useEffect(() => {
        if (step === "review") return
        if (autoOpenStepRef.current === null) {
            if (autoOpenedStepRef.current === step) return
            autoOpenStepRef.current = step
        }
        if (autoOpenStepRef.current !== step) return
        autoOpenStepRef.current = null
        autoOpenedStepRef.current = step
        void openCamera()
    }, [openCamera, step])

    const takePhoto = async () => {
        const video = videoRef.current
        if (!video || !cameraReady) return
        setCameraError(null)
        try {
            const photo = await camera.capture(video)
            if (step === "front") setFrontPhoto(photo)
            else if (step === "back") setBackPhoto(photo)
            else {
                setIngredientPhoto(photo)
                setIngredientDecision("captured")
            }
            camera.stop()
            setCameraState("idle")
            setCameraReady(false)
        } catch {
            camera.stop()
            setCameraState("error")
            setCameraError("capture")
        }
    }

    const retake = () => {
        if (!currentPhoto) return
        camera.stop()
        camera.discard(currentPhoto)
        if (step === "front") setFrontPhoto(null)
        else if (step === "back") setBackPhoto(null)
        else {
            setIngredientPhoto(null)
            setIngredientDecision("pending")
        }
        setCameraReady(false)
        setCameraState("idle")
        setCameraError(null)
        if (cameraPermissionGranted) void openCamera()
    }

    const startDemo = () => {
        if (!frontPhoto || !backPhoto || ingredientDecision === "pending")
            return
        isLeavingCaptureRef.current = true
        discardCapturedMedia()
        void navigate(
            buildCaptureResultUrl(
                "/captures/demo-capture",
                "queued",
                location.search,
            ),
        )
    }

    return {
        step,
        photos: {
            front: frontPhoto,
            back: backPhoto,
            ingredients: ingredientPhoto,
            current: currentPhoto,
        },
        ingredientDecision,
        camera: {
            state: cameraState,
            ready: cameraReady,
            error: cameraError,
            videoRef,
        },
        headingRef,
        showReloadRecovery,
        actions: {
            markCameraReady: () => setCameraReady(true),
            handleCameraInterruption,
            openCamera,
            takePhoto,
            retake,
            continueJourney,
            skipIngredients,
            editStep,
            startDemo,
        },
    }
}
