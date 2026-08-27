import { useCallback, useEffect, useRef, useState, type RefObject } from "react"
import { useLocation, useNavigate } from "react-router"

import { appRoutes } from "@/app/routes"

import {
    createBrowserPackageCamera,
    type CapturedPackagePhoto,
} from "./browserPackageCamera"
import {
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
        ingredients: CapturedPackagePhoto | null
        current: CapturedPackagePhoto | null
    }
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
        goBack: () => void
        continueJourney: () => void
        exitCapture: () => void
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

export function usePackageCaptureJourney(): PackageCaptureJourney {
    const location = useLocation()
    const navigate = useNavigate()
    const requestedStep = getRequestedCaptureStep(location.search)
    const [camera] = useState(createBrowserPackageCamera)
    const videoRef = useRef<HTMLVideoElement>(null)
    const headingRef = useRef<HTMLHeadingElement>(null)
    const endingRef = useRef(false)
    const mountedRef = useRef(true)
    const [frontPhoto, setFrontPhoto] = useState<CapturedPackagePhoto | null>(
        null,
    )
    const [ingredientPhoto, setIngredientPhoto] =
        useState<CapturedPackagePhoto | null>(null)
    const [cameraState, setCameraState] = useState<CameraState>("idle")
    const [cameraReady, setCameraReady] = useState(false)
    const [cameraError, setCameraError] = useState<CameraError | null>(null)
    const [showReloadRecovery] = useState(requestedStep !== "front")

    const step = resolveCaptureStep(
        requestedStep,
        frontPhoto !== null,
        ingredientPhoto !== null,
    )
    const currentPhoto = step === "front" ? frontPhoto : ingredientPhoto

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
            !endingRef.current &&
            `${location.pathname}${location.search}` !== normalizedUrl
        ) {
            void navigate(normalizedUrl, { replace: true })
        }
    }, [location.pathname, location.search, navigate, step])

    useEffect(() => {
        headingRef.current?.focus()
        camera.stop()
        setCameraState("idle")
        setCameraReady(false)
        setCameraError(null)
    }, [camera, step])

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
            camera.dispose()
        }
    }, [camera])

    useEffect(() => {
        const interruptHiddenCamera = () => {
            if (
                document.visibilityState !== "visible" &&
                (cameraState === "live" || cameraState === "opening")
            ) {
                handleCameraInterruption()
            }
        }
        const clearLeavingPage = () => {
            camera.dispose()
            setFrontPhoto(null)
            setIngredientPhoto(null)
            if (mountedRef.current) {
                setCameraState("idle")
                setCameraReady(false)
                setCameraError(null)
            }
        }
        const restartRestoredPage = (event: PageTransitionEvent) => {
            if (!event.persisted) return
            endingRef.current = false
            camera.dispose()
            setFrontPhoto(null)
            setIngredientPhoto(null)
            setCameraState("idle")
            setCameraReady(false)
            setCameraError(null)
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
        handleCameraInterruption,
        location.search,
        navigate,
    ])

    const goToStep = (nextStep: CaptureStep) => {
        camera.stop()
        void navigate(buildCaptureUrl(nextStep, location.search))
    }

    const goBack = () => {
        goToStep(step === "review" ? "ingredients" : "front")
    }

    const continueJourney = () => {
        goToStep(step === "front" ? "ingredients" : "review")
    }

    const exitCapture = () => {
        camera.dispose()
        setFrontPhoto(null)
        setIngredientPhoto(null)
        void navigate(appRoutes.home)
    }

    const openCamera = async () => {
        const video = videoRef.current
        if (!video) return
        setCameraState("opening")
        setCameraReady(false)
        setCameraError(null)
        try {
            await camera.open(video, handleCameraInterruption)
            if (!mountedRef.current) return
            setCameraState("live")
        } catch (error) {
            if (!mountedRef.current) return
            camera.stop()
            setCameraState("error")
            setCameraError(cameraErrorFrom(error))
        }
    }

    const takePhoto = async () => {
        const video = videoRef.current
        if (!video || !cameraReady) return
        setCameraError(null)
        try {
            const photo = await camera.capture(video)
            if (step === "front") setFrontPhoto(photo)
            else setIngredientPhoto(photo)
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
        camera.discard(currentPhoto)
        if (step === "front") setFrontPhoto(null)
        else setIngredientPhoto(null)
        setCameraState("idle")
        setCameraError(null)
    }

    const startDemo = () => {
        if (!frontPhoto || !ingredientPhoto) return
        endingRef.current = true
        camera.dispose()
        setFrontPhoto(null)
        setIngredientPhoto(null)
        void navigate("/captures/demo-capture?scenario=queued")
    }

    return {
        step,
        photos: {
            front: frontPhoto,
            ingredients: ingredientPhoto,
            current: currentPhoto,
        },
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
            goBack,
            continueJourney,
            exitCapture,
            startDemo,
        },
    }
}
