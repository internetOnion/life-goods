import { useEffect } from "react"

export const SITE_NAME = "Life Goods"
export const DEFAULT_DESCRIPTION =
    "Scan a Barcode to read attributed Open Food Facts Product information with Life Goods."

type PageMetadataOptions = {
    title?: string
    description?: string
}

export function usePageMetadata({
    title,
    description,
}: PageMetadataOptions = {}) {
    useEffect(() => {
        const previousTitle = document.title
        const formattedTitle =
            title && title !== SITE_NAME ? `${title} | ${SITE_NAME}` : SITE_NAME
        document.title = formattedTitle

        const metaDesc = document.querySelector<HTMLMetaElement>(
            'meta[name="description"]',
        )
        const previousDesc = metaDesc?.getAttribute("content")
        if (metaDesc && description) {
            metaDesc.setAttribute("content", description)
        }

        return () => {
            document.title = previousTitle
            if (metaDesc && previousDesc) {
                metaDesc.setAttribute("content", previousDesc)
            }
        }
    }, [title, description])
}
