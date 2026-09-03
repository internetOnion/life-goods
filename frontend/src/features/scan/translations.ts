export const scanTranslations = {
    en: {
        scan: {
            title: "Scan a Barcode",
            cameraLabel: "Barcode scanner",
            searchPlaceholder: "Search products...",
            searchLabel: "Search",
            privacyTitle: "Your camera stays private",
            privacyBody:
                "Barcode detection happens on this device. Life Goods does not upload, store, or share camera frames.",
            privacySession:
                "Your choice to start the camera is remembered for this browser session only.",
            start: "Start camera",
            starting: "Starting camera...",
            scanning: "Hold the Barcode inside the frame",
            ready: "Ready to scan",
            detected: "Barcode detected",
            paused: "Camera paused",
            pausedBody: "Resume when you are ready to scan another Barcode.",
            pause: "Pause camera",
            resume: "Resume camera",
            switch: "Switch camera",
            unavailable: "Camera unavailable",
            tryAgain: "Try camera again",
            enterBarcode: "Enter a Barcode instead",
            enterBarcodeHint: "Type the digits printed below the bars",
            errorPermission:
                "Camera access was denied. Allow access in your browser settings, then try again, or enter the Barcode instead.",
            errorNoDevice:
                "No camera was found on this device. Enter the Barcode instead.",
            errorBusy:
                "Another app is using the camera. Close that app, then try again.",
            errorPreview:
                "The camera opened, but its preview did not start. Reload this page and try again, or enter the Barcode instead.",
            errorGeneric:
                "The camera could not start. Check your browser settings, then try again, or enter the Barcode instead.",
            errorInsecure:
                "Camera access requires HTTPS. Open this page over a secure connection, or enter the Barcode instead.",
            errorUnsupported:
                "This browser cannot use the camera scanner. Try a current browser over HTTPS, or enter the Barcode instead.",
            errorInterrupted:
                "Camera startup was interrupted. Return to this page and try again, or enter the Barcode instead.",
        },
    },
} as const
