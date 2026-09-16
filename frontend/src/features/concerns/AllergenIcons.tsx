import type { ComponentPropsWithoutRef } from "react"

export interface AllergenIconProps extends ComponentPropsWithoutRef<"svg"> {
    size?: number | string
    weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone"
}

export function PeanutIcon({
    size = 24,
    weight = "regular",
    className,
    ...props
}: AllergenIconProps) {
    const strokeWidth = weight === "bold" ? 22 : 16
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
            {...props}
        >
            {/* Peanut pod shell with two lobes and narrow waist */}
            <path d="M106 52 C74 58 58 84 60 110 C62 126 72 136 82 142 C72 148 60 162 62 184 C64 212 90 228 128 228 C166 228 192 212 194 184 C196 162 184 148 174 142 C184 136 194 126 196 110 C198 84 182 58 150 52 C134 49 122 49 106 52 Z" />
            {/* Shell surface ridge texture */}
            <path d="M102 86 Q128 100 154 86" />
            <path d="M108 112 Q128 122 148 112" />
            <path d="M98 168 Q128 182 158 168" />
            <path d="M104 196 Q128 206 152 196" />
            <path d="M128 66 V118" />
            <path d="M128 150 V210" />
        </svg>
    )
}

export function TreeNutIcon({
    size = 24,
    weight = "regular",
    className,
    ...props
}: AllergenIconProps) {
    const strokeWidth = weight === "bold" ? 22 : 16
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
            {...props}
        >
            {/* Stem */}
            <path d="M128 60 C128 42 138 32 148 30" />
            {/* Acorn / hazelnut textured cap */}
            <path d="M64 104 C64 68 92 60 128 60 C164 60 192 68 192 104 C192 108 188 112 184 112 L72 112 C68 112 64 108 64 104 Z" />
            <path d="M96 66 L108 108" />
            <path d="M128 60 V108" />
            <path d="M160 66 L148 108" />
            {/* Nut body tapering to a tip */}
            <path d="M72 112 C72 168 104 212 128 226 C152 212 184 168 184 112" />
            <path d="M112 136 C106 162 114 186 128 214" />
        </svg>
    )
}

export function SoybeanIcon({
    size = 24,
    weight = "regular",
    className,
    ...props
}: AllergenIconProps) {
    const strokeWidth = weight === "bold" ? 22 : 16
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
            {...props}
        >
            {/* Curved edamame / soy pod stem */}
            <path d="M40 188 C36 196 32 208 30 216" />
            {/* Three-segment undulating pod contour */}
            <path d="M40 188 C48 152 64 126 90 116 C104 78 134 68 154 74 C174 54 200 58 216 70 C222 74 228 78 230 82 C226 96 208 114 190 128 C174 154 148 174 120 182 C96 200 66 202 40 188 Z" />
            {/* Three distinct round beans nestled inside */}
            <circle cx="86" cy="148" r="18" />
            <circle cx="132" cy="122" r="18" />
            <circle cx="178" cy="94" r="18" />
        </svg>
    )
}

export function CeleryIcon({
    size = 24,
    weight = "regular",
    className,
    ...props
}: AllergenIconProps) {
    const strokeWidth = weight === "bold" ? 22 : 16
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
            {...props}
        >
            {/* Celery stalks grouped at base */}
            <path d="M84 224 C80 180 82 130 92 88" />
            <path d="M172 224 C176 180 174 130 164 88" />
            <path d="M84 224 H172" />
            {/* Longitudinal rib lines */}
            <path d="M112 224 C110 176 112 132 118 92" />
            <path d="M144 224 C146 176 144 132 138 92" />
            {/* Leaf sprigs at the top */}
            <path d="M92 88 C76 76 60 76 52 82 C56 68 70 60 88 64 C86 52 96 40 108 42 C108 58 100 76 92 88 Z" />
            <path d="M164 88 C180 76 196 76 204 82 C200 68 186 60 168 64 C170 52 160 40 148 42 C148 58 156 76 164 88 Z" />
            <path d="M128 88 C120 70 120 54 128 36 C136 54 136 70 128 88 Z" />
        </svg>
    )
}

export function GlutenIcon({
    size = 24,
    weight = "regular",
    className,
    ...props
}: AllergenIconProps) {
    const strokeWidth = weight === "bold" ? 22 : 16
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
            {...props}
        >
            {/* Wheat stalk with paired grain heads */}
            <path d="M128 224 V42" />
            <path d="M128 78 C112 72 99 60 92 44 C110 46 123 57 128 72" />
            <path d="M128 108 C110 102 96 90 88 74 C106 76 121 87 128 102" />
            <path d="M128 138 C110 132 96 120 88 104 C106 106 121 117 128 132" />
            <path d="M128 78 C144 72 157 60 164 44 C146 46 133 57 128 72" />
            <path d="M128 108 C146 102 160 90 168 74 C150 76 135 87 128 102" />
            <path d="M128 138 C146 132 160 120 168 104 C150 106 135 117 128 132" />
        </svg>
    )
}

export function LupinIcon({
    size = 24,
    weight = "regular",
    className,
    ...props
}: AllergenIconProps) {
    const strokeWidth = weight === "bold" ? 22 : 16
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
            {...props}
        >
            {/* Lupin's tall flower spike and palmate leaves */}
            <path d="M128 224 V54" />
            <path d="M128 164 C108 164 92 154 82 138 C102 137 119 146 128 158" />
            <path d="M128 164 C148 164 164 154 174 138 C154 137 137 146 128 158" />
            <path d="M128 198 C108 198 94 188 84 174 C103 173 119 181 128 192" />
            <path d="M128 198 C148 198 162 188 172 174 C153 173 137 181 128 192" />
            <path d="M128 38 C116 42 110 52 112 64 C114 76 120 82 128 88 C136 82 142 76 144 64 C146 52 140 42 128 38 Z" />
            <path d="M128 58 C120 56 116 60 116 66 C116 72 121 76 128 78 C135 76 140 72 140 66 C140 60 136 56 128 58 Z" />
            <path d="M128 88 C120 86 116 90 116 96 C116 102 121 106 128 108 C135 106 140 102 140 96 C140 90 136 86 128 88 Z" />
            <path d="M128 118 C120 116 116 120 116 126 C116 132 121 136 128 138 C135 136 140 132 140 126 C140 120 136 116 128 118 Z" />
        </svg>
    )
}

export function MilkIcon({
    size = 24,
    weight = "regular",
    className,
    ...props
}: AllergenIconProps) {
    const strokeWidth = weight === "bold" ? 22 : 16
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
            {...props}
        >
            {/* Milk bottle with cap and label band */}
            <path d="M104 40 H152 V60 H104 Z" />
            <path d="M94 60 H162 V76 C162 86 174 92 178 106 V210 C178 220 170 228 160 228 H96 C86 228 78 220 78 210 V106 C82 92 94 86 94 76 Z" />
            <path d="M82 112 H174" />
            <path d="M94 154 H162" />
        </svg>
    )
}

export function SesameIcon({
    size = 24,
    weight = "regular",
    className,
    ...props
}: AllergenIconProps) {
    const strokeWidth = weight === "bold" ? 22 : 16
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
            {...props}
        >
            {/* Cluster of teardrop sesame seeds with center ridges */}
            {/* Seed 1: top center */}
            <path d="M128 44 C118 64 104 86 108 108 C112 124 128 128 128 128 C128 128 144 124 148 108 C152 86 138 64 128 44 Z" />
            <path d="M128 58 V118" />

            {/* Seed 2: bottom left */}
            <path d="M80 124 C64 140 46 160 46 182 C46 198 60 206 66 204 C74 202 88 192 98 178 C110 162 100 140 80 124 Z" />
            <path d="M76 138 L68 194" />

            {/* Seed 3: bottom right */}
            <path d="M176 124 C192 140 210 160 210 182 C210 198 196 206 190 204 C182 202 168 192 158 178 C146 162 156 140 176 124 Z" />
            <path d="M180 138 L188 194" />
        </svg>
    )
}

export function MolluskIcon({
    size = 24,
    weight = "regular",
    className,
    ...props
}: AllergenIconProps) {
    const strokeWidth = weight === "bold" ? 22 : 16
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
            {...props}
        >
            {/* Bivalve / scallop seashell with fan ridges */}
            <path d="M52 148 C46 112 70 66 128 60 C186 66 210 112 204 148 C200 172 174 198 152 204 H104 C82 198 56 172 52 148 Z" />
            {/* Shell base / hinge ears */}
            <path d="M92 204 L88 220 H168 L164 204" />
            {/* Radiating fan ribs */}
            <path d="M128 204 V60" />
            <path d="M122 204 C112 166 94 124 80 86" />
            <path d="M134 204 C144 166 162 124 176 86" />
            <path d="M116 204 C96 182 72 154 60 128" />
            <path d="M140 204 C160 182 184 154 196 128" />
        </svg>
    )
}

export function MustardIcon({
    size = 24,
    weight = "regular",
    className,
    ...props
}: AllergenIconProps) {
    const strokeWidth = weight === "bold" ? 22 : 16
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width={size}
            height={size}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={className}
            {...props}
        >
            {/* Central flowering mustard stem */}
            <path d="M128 224 V84" />
            {/* Left mustard pod (silique) */}
            <path d="M128 174 C112 164 96 142 90 114" />
            {/* Right mustard pod */}
            <path d="M128 144 C144 134 160 112 166 84" />
            {/* Cruciferous 4-petal mustard flowers */}
            {/* Center flower */}
            <circle cx="128" cy="62" r="8" fill="currentColor" />
            <path d="M128 44 V54" />
            <path d="M128 70 V80" />
            <path d="M110 62 H120" />
            <path d="M136 62 H146" />
            {/* Left flower bud */}
            <circle cx="90" cy="114" r="6" fill="currentColor" />
            {/* Right flower bud */}
            <circle cx="166" cy="84" r="6" fill="currentColor" />
        </svg>
    )
}
