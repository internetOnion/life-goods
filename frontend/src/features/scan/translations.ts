import type { AppLocale } from "@/i18n/locale"

const englishScan = {
    title: "Scan a Barcode",
    cameraLabel: "Barcode scanner",
    searchPlaceholder: "barcode, product, or brand",
    searchLabel: "Search",
    privacyTitle: "Private camera scanning",
    privacyBody: "Scanning happens on your device.",
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
    flashOn: "Turn flash on",
    flashOff: "Turn flash off",
    flashUnavailable: "Flash is not available on this camera.",
    flashError: "Could not change the flash. Try again.",
    unavailable: "Camera unavailable",
    tryAgain: "Try camera again",
    enterBarcode: "Enter a Barcode instead",
    enterBarcodeHint: "Type the digits printed below the bars",
    errorPermission:
        "Allow camera access in your browser settings, then try again.",
    errorNoDevice: "No camera was found. Enter the Barcode instead.",
    errorBusy: "Close the other app using the camera, then try again.",
    errorPreview: "Reload this page, then try again.",
    errorGeneric: "Check your browser settings, then try again.",
    errorInsecure: "Open this page over HTTPS to use the camera.",
    errorUnsupported: "Use a current browser over HTTPS to scan.",
    errorInterrupted: "Return to this page and try again.",
    errorTimeout:
        "The camera took too long to start. Try again, or enter the Barcode instead.",
} as const

type ScanTranslations = { [Key in keyof typeof englishScan]: string }

const khmerScan: ScanTranslations = {
    title: "ស្កេនបាកូដ",
    cameraLabel: "ម៉ាស៊ីនស្កេនបាកូដ",
    searchPlaceholder: "បញ្ចូលបាកូដ ឈ្មោះផលិតផល ឬម៉ាក",
    searchLabel: "ស្វែងរក",
    privacyTitle: "ស្កេនដោយរក្សាភាពឯកជន",
    privacyBody: "ការស្កេនកើតឡើងនៅលើឧបករណ៍របស់អ្នក។",
    start: "ចាប់ផ្តើមកាមេរ៉ា",
    starting: "កំពុងចាប់ផ្តើមកាមេរ៉ា…",
    scanning: "កាន់បាកូដនៅក្នុងស៊ុម",
    ready: "រួចរាល់សម្រាប់ស្កេន",
    detected: "បានរកឃើញបាកូដ",
    paused: "កាមេរ៉ាបានផ្អាក",
    pausedBody: "បន្តនៅពេលអ្នករួចរាល់ដើម្បីស្កេនបាកូដមួយទៀត។",
    pause: "ផ្អាកកាមេរ៉ា",
    resume: "បន្តកាមេរ៉ា",
    switch: "ប្តូរកាមេរ៉ា",
    flashOn: "បើកពន្លឺកាមេរ៉ា",
    flashOff: "បិទពន្លឺកាមេរ៉ា",
    flashUnavailable: "កាមេរ៉ានេះមិនមានពន្លឺទេ។",
    flashError: "មិនអាចប្តូរពន្លឺបានទេ។ សាកល្បងម្តងទៀត។",
    unavailable: "មិនអាចប្រើកាមេរ៉ាបាន",
    tryAgain: "សាកល្បងកាមេរ៉ាម្តងទៀត",
    enterBarcode: "បញ្ចូលបាកូដជំនួស",
    enterBarcodeHint: "វាយលេខដែលបោះពុម្ពនៅក្រោមបន្ទាត់",
    errorPermission:
        "អនុញ្ញាតឱ្យប្រើកាមេរ៉ាក្នុងការកំណត់កម្មវិធីរុករករបស់អ្នក បន្ទាប់មកសាកល្បងម្តងទៀត។",
    errorNoDevice: "រកមិនឃើញកាមេរ៉ាទេ។ បញ្ចូលបាកូដជំនួស។",
    errorBusy: "បិទកម្មវិធីផ្សេងដែលកំពុងប្រើកាមេរ៉ា បន្ទាប់មកសាកល្បងម្តងទៀត។",
    errorPreview: "ផ្ទុកទំព័រនេះឡើងវិញ បន្ទាប់មកសាកល្បងម្តងទៀត។",
    errorGeneric:
        "ពិនិត្យការកំណត់កម្មវិធីរុករករបស់អ្នក បន្ទាប់មកសាកល្បងម្តងទៀត។",
    errorInsecure: "បើកទំព័រនេះតាម HTTPS ដើម្បីប្រើកាមេរ៉ា។",
    errorUnsupported: "ប្រើកម្មវិធីរុករកបច្ចុប្បន្នតាម HTTPS ដើម្បីស្កេន។",
    errorInterrupted: "ត្រឡប់មកទំព័រនេះ ហើយសាកល្បងម្តងទៀត។",
    errorTimeout:
        "កាមេរ៉ាចំណាយពេលយូរពេកក្នុងការចាប់ផ្តើម។ សាកល្បងម្តងទៀត ឬបញ្ចូលបាកូដជំនួស។",
}

export const scanTranslations = {
    en: { scan: englishScan },
    km: { scan: khmerScan },
} as const satisfies Record<AppLocale, { scan: ScanTranslations }>
