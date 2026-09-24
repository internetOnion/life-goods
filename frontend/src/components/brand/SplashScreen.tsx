import { BrandMark } from "@/components/brand/BrandMark"

export function SplashScreen() {
    return (
        <div
            className="animate-splash-screen-exit motion-reduce:animate-splash-screen-exit-reduced pointer-events-none fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-white text-neutral-950"
            aria-hidden="true"
        >
            <div className="flex w-fit max-w-[90vw] items-center justify-center gap-[clamp(0.5rem,1.5vw,1.125rem)]">
                <BrandMark
                    className="animate-splash-mark-entrance motion-reduce:animate-splash-mark-reduced relative z-[2] shrink-0"
                    size="clamp(5rem, 23vw, 9rem)"
                    variant="primary"
                />
                <span className="animate-splash-wordmark-entrance motion-reduce:animate-splash-wordmark-reduced text-display-splash relative z-[1] leading-none font-extrabold tracking-[-0.04em] whitespace-nowrap text-neutral-950">
                    LifeGoods
                </span>
            </div>
        </div>
    )
}
