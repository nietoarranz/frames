import { openDb } from "@/lib/collection-draft"
import { loadImage } from "@/lib/story"

const STORE_NAME = "drafts"
const LIBRARY_KEY = "library"
const LIBRARY_VERSION = 1

const THUMBNAIL_SIZE = 320

export type LibraryPhoto = {
  id: string
  file: File
  url: string
  /** Small preview blob, null until generated or when it can't be. */
  thumb: Blob | null
  /** Object URL of the thumbnail, or the full photo's until it's ready. */
  thumbUrl: string
}

type PersistedLibraryPhoto = {
  id: string
  name: string
  type: string
  lastModified: number
  blob: Blob
  thumb?: Blob | null
}

let pendingWrite: Promise<void> = Promise.resolve()

export function createLibraryId() {
  try {
    return crypto.randomUUID()
  } catch {
    return `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

export function isImageFile(file: File) {
  return file.type.startsWith("image/")
}

export function createLibraryPhoto(file: File): LibraryPhoto {
  const url = URL.createObjectURL(file)

  return { id: createLibraryId(), file, url, thumb: null, thumbUrl: url }
}

/** Identifies a file across reloads, when File objects are recreated. */
export function fileSignature(file: File) {
  return `${file.name}|${file.size}|${file.lastModified}`
}

/** Downscales a photo to a small JPEG, or null if it can't be decoded. */
export async function createThumbnail(url: string): Promise<Blob | null> {
  try {
    const image = await loadImage(url)
    const scale = Math.min(
      1,
      THUMBNAIL_SIZE / Math.max(image.naturalWidth, image.naturalHeight)
    )
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.8)
    })
  } catch {
    return null
  }
}

export function withThumbnail(photo: LibraryPhoto, thumb: Blob): LibraryPhoto {
  return { ...photo, thumb, thumbUrl: URL.createObjectURL(thumb) }
}

function isPersistedLibraryPhoto(
  value: unknown
): value is PersistedLibraryPhoto {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.type === "string" &&
    typeof record.lastModified === "number" &&
    record.blob instanceof Blob
  )
}

export async function restorePhotoLibrary(): Promise<LibraryPhoto[]> {
  try {
    const db = await openDb()
    const record = await new Promise<unknown>((resolve, reject) => {
      const request = db
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(LIBRARY_KEY)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    if (
      typeof record !== "object" ||
      record === null ||
      !Array.isArray((record as { photos?: unknown }).photos)
    ) {
      return []
    }

    return (record as { photos: unknown[] }).photos
      .filter(isPersistedLibraryPhoto)
      .filter(
        (photo, index, all) =>
          all.findIndex((other) => other.id === photo.id) === index
      )
      .map((photo) => {
        const file = new File([photo.blob], photo.name || "photo", {
          type: photo.type || photo.blob.type || "image/jpeg",
          lastModified: photo.lastModified,
        })

        const url = URL.createObjectURL(file)
        const thumb = photo.thumb instanceof Blob ? photo.thumb : null

        return {
          id: photo.id,
          file,
          url,
          thumb,
          thumbUrl: thumb ? URL.createObjectURL(thumb) : url,
        }
      })
  } catch {
    return []
  }
}

async function writeLibrary(photos: LibraryPhoto[]) {
  const db = await openDb()
  const transaction = db.transaction(STORE_NAME, "readwrite")
  transaction.objectStore(STORE_NAME).put(
    {
      version: LIBRARY_VERSION,
      photos: photos.map((photo): PersistedLibraryPhoto => ({
        id: photo.id,
        name: photo.file.name,
        type: photo.file.type,
        lastModified: photo.file.lastModified,
        blob: photo.file,
        thumb: photo.thumb,
      })),
    },
    LIBRARY_KEY
  )

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

/** Writes run one after another so the last call always wins. */
export function savePhotoLibrary(photos: LibraryPhoto[]) {
  pendingWrite = pendingWrite.then(
    () => writeLibrary(photos),
    () => writeLibrary(photos)
  )
  return pendingWrite.catch(() => undefined)
}

export function revokeLibraryPhotos(photos: LibraryPhoto[]) {
  photos.forEach((photo) => {
    URL.revokeObjectURL(photo.url)
    if (photo.thumbUrl !== photo.url) {
      URL.revokeObjectURL(photo.thumbUrl)
    }
  })
}
