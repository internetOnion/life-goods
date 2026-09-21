import { Calendar, Camera, Images, User, ZoomIn } from "lucide-react"
import React, { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import type { ProductPhoto } from "@/features/product/types"

import { translateTaxonomyValue, useProductTranslation } from "../translations"

interface PhotosGalleryCardProps {
    photos: ProductPhoto[]
    productName: string
}

export const PhotosGalleryCard: React.FC<PhotosGalleryCardProps> = ({
    photos,
    productName,
}) => {
    const { locale, t } = useProductTranslation()
    const [selectedPhoto, setSelectedPhoto] = useState<ProductPhoto | null>(
        null,
    )
    const [activeFilter, setActiveFilter] = useState<string>("all")
    const [failedPhotoIds, setFailedPhotoIds] = useState<Set<string>>(new Set())

    if (photos.length === 0) {
        return (
            <Card className="rounded-2xl border-neutral-200/90 bg-white shadow-xs">
                <CardHeader className="p-4 pb-2 sm:p-5 sm:pb-2">
                    <div className="flex items-center gap-2">
                        <Images className="h-4 w-4 text-neutral-500" />
                        <CardTitle className="text-sm font-semibold text-neutral-900">
                            {t("photoArchive")}
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-1 p-4 pt-1 sm:p-5 sm:pt-1">
                    <p className="text-xs font-semibold text-neutral-700">
                        {t("sourceDataUnavailable")}
                    </p>
                    <p className="text-caption text-neutral-500">
                        {t("noPackagePhotographs")}
                    </p>
                </CardContent>
            </Card>
        )
    }

    const roles = [
        "all",
        ...Array.from(new Set(photos.map((p) => p.role))).filter(Boolean),
    ]

    const filteredPhotos = photos
        .filter((p) =>
            activeFilter === "all" ? true : p.role === activeFilter,
        )
        .filter((p) => !failedPhotoIds.has(p.id))

    return (
        <Card className="border-neutral-200/90 bg-white shadow-xs">
            <CardHeader className="flex flex-col justify-between gap-3 p-4 pb-2 sm:flex-row sm:items-center sm:p-5 sm:pb-2">
                <div className="flex items-center gap-2">
                    <Images className="h-4 w-4 text-neutral-500" />
                    <CardTitle className="text-sm font-semibold text-neutral-900">
                        {t("photoArchiveTitle")}
                    </CardTitle>
                    <Badge variant="subtle" className="text-micro font-mono">
                        {photos.length} {t("total")}
                    </Badge>
                </div>

                {/* Role Filters */}
                {roles.length > 2 && (
                    <div className="flex flex-wrap gap-1">
                        {roles.map((r) => (
                            <Button
                                key={r}
                                variant={
                                    activeFilter === r ? "default" : "secondary"
                                }
                                size="sm"
                                type="button"
                                onClick={() => setActiveFilter(r)}
                                className={`h-auto rounded-lg px-2.5 py-1 text-xs capitalize transition-all ${
                                    activeFilter === r
                                        ? "font-semibold shadow-2xs"
                                        : "hover:text-neutral-900"
                                }`}
                            >
                                {translateTaxonomyValue(locale, r)}
                            </Button>
                        ))}
                    </div>
                )}
            </CardHeader>

            <CardContent className="p-4 pt-2 sm:p-5 sm:pt-2">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 md:grid-cols-4">
                    {filteredPhotos.map((photo) => (
                        <div
                            key={photo.id}
                            onClick={() => setSelectedPhoto(photo)}
                            className="group hover:border-primary-500 relative flex aspect-square cursor-pointer flex-col overflow-hidden rounded-2xl border border-neutral-200/80 bg-neutral-100/70 transition-all hover:shadow-xs"
                        >
                            <img
                                src={photo.url}
                                alt={`${productName} - ${translateTaxonomyValue(locale, photo.role)}`}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                onError={() =>
                                    setFailedPhotoIds(
                                        (prev) => new Set([...prev, photo.id]),
                                    )
                                }
                                loading="lazy"
                            />

                            <div className="backdrop-blur-2xs absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                                <ZoomIn className="h-6 w-6 text-white" />
                            </div>

                            <div className="absolute top-2 left-2">
                                <Badge
                                    variant="subtle"
                                    className="text-micro bg-white/90 font-semibold text-neutral-800 uppercase backdrop-blur-xs"
                                >
                                    {translateTaxonomyValue(locale, photo.role)}
                                </Badge>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Photo Zoom Modal */}
                {selectedPhoto && (
                    <Dialog
                        open={Boolean(selectedPhoto)}
                        onOpenChange={(open) => !open && setSelectedPhoto(null)}
                    >
                        <DialogContent
                            closeLabel={t("close")}
                            className="max-w-3xl border-neutral-800 bg-neutral-950 p-4 text-white"
                        >
                            <DialogTitle className="flex items-center justify-between pr-8 text-sm font-semibold text-neutral-200">
                                <span>
                                    {productName} —{" "}
                                    {translateTaxonomyValue(
                                        locale,
                                        selectedPhoto.role,
                                    )}
                                </span>
                                <Badge
                                    variant="outline"
                                    className="border-neutral-700 text-neutral-400"
                                >
                                    {t("photoId")}: {selectedPhoto.id}
                                </Badge>
                            </DialogTitle>

                            <div className="relative flex max-h-[70vh] min-h-[300px] w-full items-center justify-center p-2">
                                <img
                                    src={selectedPhoto.originalUrl}
                                    alt={productName}
                                    className="max-h-[68vh] max-w-full rounded-xl object-contain"
                                />
                            </div>

                            <div className="text-caption flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 pt-2 text-neutral-400">
                                <div className="flex items-center gap-3">
                                    {selectedPhoto.uploader && (
                                        <span className="flex items-center gap-1">
                                            <User className="h-3 w-3" />
                                            {selectedPhoto.uploader}
                                        </span>
                                    )}
                                    {selectedPhoto.uploadedAt && (
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {selectedPhoto.uploadedAt}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 text-neutral-500">
                                    <Camera className="h-3 w-3" />
                                    <span>{t("highResOriginalAvailable")}</span>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </CardContent>
        </Card>
    )
}
