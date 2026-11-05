import { useCallback, useEffect, useRef, useState } from "react"

import {
  createLibraryPhoto,
  createThumbnail,
  isImageFile,
  restorePhotoLibrary,
  revokeLibraryPhotos,
  savePhotoLibrary,
  withThumbnail,
  type LibraryPhoto,
} from "@/lib/photo-library"

/** The user's uploaded photos, persisted in IndexedDB between visits. */
export function usePhotoLibrary() {
  const [photos, setPhotos] = useState<LibraryPhoto[]>([])
  const [ready, setReady] = useState(false)
  const photosRef = useRef(photos)
  const aliveRef = useRef(true)

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  /** Fills in missing thumbnails one at a time. */
  const generateThumbnails = useCallback(async (targets: LibraryPhoto[]) => {
    for (const target of targets) {
      if (target.thumb) {
        continue
      }

      const thumb = await createThumbnail(target.url)
      if (!thumb) {
        continue
      }

      const updated = withThumbnail(target, thumb)
      if (
        !aliveRef.current ||
        !photosRef.current.some((photo) => photo.id === target.id)
      ) {
        // Deleted or unmounted while the thumbnail was being made.
        URL.revokeObjectURL(updated.thumbUrl)
        continue
      }

      setPhotos((current) =>
        current.map((photo) =>
          photo.id === target.id
            ? { ...photo, thumb: updated.thumb, thumbUrl: updated.thumbUrl }
            : photo
        )
      )
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    void restorePhotoLibrary().then((restored) => {
      if (cancelled) {
        revokeLibraryPhotos(restored)
        return
      }

      setPhotos((current) => [...restored, ...current])
      setReady(true)
      void generateThumbnails(restored)
    })

    return () => {
      cancelled = true
    }
  }, [generateThumbnails])

  useEffect(() => {
    if (ready) {
      void savePhotoLibrary(photos)
    }
  }, [photos, ready])

  useEffect(() => {
    return () => {
      revokeLibraryPhotos(photosRef.current)
    }
  }, [])

  /** Adds the image files and returns the new library entries. */
  const addPhotos = useCallback(
    (files: File[]) => {
      const added = files.filter(isImageFile).map(createLibraryPhoto)
      if (added.length > 0) {
        setPhotos((current) => [...current, ...added])
        void generateThumbnails(added)
      }

      return added
    },
    [generateThumbnails]
  )

  const removePhotos = useCallback((ids: string[]) => {
    const doomed = new Set(ids)
    revokeLibraryPhotos(
      photosRef.current.filter((photo) => doomed.has(photo.id))
    )
    setPhotos((current) => current.filter((photo) => !doomed.has(photo.id)))
  }, [])

  return { photos, addPhotos, removePhotos }
}
