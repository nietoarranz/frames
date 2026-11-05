import {
  collectionFrames,
  DEFAULT_COLLECTION_FRAME_ID,
  getCollectionFrame,
  spacingFromFrame,
  type CollectionFrameSpacing,
} from "@/lib/collection-frames"
import {
  clampPan,
  coverFit,
  DEFAULT_IMAGE_FIT,
  DEFAULT_IMAGE_PAN,
  isImageFit,
  type ImageFit,
  type ImagePan,
} from "@/lib/image-pan"
import { loadImage } from "@/lib/story"

const DB_NAME = "frames"
const DB_VERSION = 1
const STORE_NAME = "drafts"
const DRAFT_KEY = "collection"
const DRAFT_VERSION = 4
const LEGACY_DRAFT_VERSION = 1
const SUPPORTED_DRAFT_VERSIONS = new Set([2, 3, DRAFT_VERSION])

export type LoadedSlotPhoto = {
  file: File
  image: HTMLImageElement
  url: string
}

export type BackgroundMode = "color" | "image"

export type FrameBackground = {
  mode: BackgroundMode
  color: string
  image: LoadedSlotPhoto | null
  imagePan: ImagePan
}

type PersistedPhoto = {
  name: string
  type: string
  lastModified: number
  blob: Blob
}

type PersistedBackground = {
  mode: BackgroundMode
  color: string
  image: PersistedPhoto | null
  imagePan: ImagePan
}

export type CollectionStoryState = {
  id: string
  frameId: string
  pans: ImagePan[]
  fits: ImageFit[]
  backgrounds: Record<string, FrameBackground>
  spacings: Record<string, CollectionFrameSpacing>
  photos: Array<LoadedSlotPhoto | null>
  transparentSlots: boolean[]
}

type PersistedStory = {
  id: string
  frameId: string
  pans: ImagePan[]
  fits: ImageFit[]
  backgrounds: Record<string, PersistedBackground>
  spacings: Record<string, CollectionFrameSpacing>
  photos: Array<PersistedPhoto | null>
  transparentSlots: boolean[]
}

export type CollectionDraft = {
  version: typeof DRAFT_VERSION
  activeIndex: number
  stories: PersistedStory[]
}

export type RestoredCollectionDraft = {
  activeIndex: number
  stories: CollectionStoryState[]
}

let dbPromise: Promise<IDBDatabase> | null = null
let latestDraft: CollectionDraft | null = null
let isWriting = false

function createId() {
  try {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID()
    }

    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("")
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  } catch {
    return `story-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    }).catch((error) => {
      dbPromise = null
      throw error
    })
  }

  return dbPromise
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isPan(value: unknown): value is ImagePan {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

function isPadding(value: unknown): value is CollectionFrameSpacing["padding"] {
  return (
    isRecord(value) &&
    isFiniteNumber(value.top) &&
    isFiniteNumber(value.right) &&
    isFiniteNumber(value.bottom) &&
    isFiniteNumber(value.left)
  )
}

function isSpacing(value: unknown): value is CollectionFrameSpacing {
  return (
    isRecord(value) &&
    isPadding(value.padding) &&
    isFiniteNumber(value.gap) &&
    typeof value.linkHorizontal === "boolean" &&
    typeof value.linkVertical === "boolean"
  )
}

function isHexColor(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(value)
  )
}

function isBackgroundMode(value: unknown): value is BackgroundMode {
  return value === "color" || value === "image"
}

function isPersistedPhoto(value: unknown): value is PersistedPhoto {
  if (!isRecord(value)) {
    return false
  }

  return (
    typeof value.name === "string" &&
    typeof value.type === "string" &&
    isFiniteNumber(value.lastModified) &&
    value.blob instanceof Blob
  )
}

function defaultFrameBackground(color: string): FrameBackground {
  return {
    mode: "color",
    color,
    image: null,
    imagePan: DEFAULT_IMAGE_PAN,
  }
}

function defaultBackgrounds() {
  return Object.fromEntries(
    collectionFrames.map((frame) => [
      frame.id,
      defaultFrameBackground(frame.background),
    ])
  )
}

export function getStoryBackground(
  story: Pick<CollectionStoryState, "backgrounds" | "frameId">,
  frameId = story.frameId
): FrameBackground {
  return (
    story.backgrounds[frameId] ??
    defaultFrameBackground(getCollectionFrame(frameId).background)
  )
}

function persistPhoto(photo: LoadedSlotPhoto): PersistedPhoto {
  return {
    name: photo.file.name,
    type: photo.file.type,
    lastModified: photo.file.lastModified,
    blob: photo.file,
  }
}

function persistBackground(background: FrameBackground): PersistedBackground {
  return {
    mode: background.mode,
    color: background.color,
    imagePan: background.imagePan,
    image: background.image ? persistPhoto(background.image) : null,
  }
}

async function cloneLoadedPhoto(
  photo: LoadedSlotPhoto
): Promise<LoadedSlotPhoto | null> {
  const url = URL.createObjectURL(photo.file)

  try {
    return {
      file: photo.file,
      url,
      image: await loadImage(url),
    }
  } catch {
    URL.revokeObjectURL(url)
    return null
  }
}

async function cloneBackground(
  background: FrameBackground
): Promise<FrameBackground> {
  return {
    mode: background.mode,
    color: background.color,
    imagePan: { ...background.imagePan },
    image: background.image ? await cloneLoadedPhoto(background.image) : null,
  }
}

async function restoreBackground(
  value: unknown,
  fallbackColor: string
): Promise<FrameBackground> {
  const fallback = defaultFrameBackground(fallbackColor)

  if (isHexColor(value)) {
    return { ...fallback, color: value }
  }

  if (!isRecord(value) || !isHexColor(value.color)) {
    return fallback
  }

  return {
    mode: isBackgroundMode(value.mode) ? value.mode : "color",
    color: value.color,
    imagePan: isPan(value.imagePan)
      ? clampPan(value.imagePan)
      : DEFAULT_IMAGE_PAN,
    image: await restorePhoto(
      isPersistedPhoto(value.image) ? value.image : null
    ),
  }
}

function defaultSpacings() {
  return Object.fromEntries(
    collectionFrames.map((frame) => [frame.id, spacingFromFrame(frame)])
  )
}

function padToCount<T>(items: T[], count: number, fallback: T): T[] {
  return Array.from({ length: count }, (_, index) => items[index] ?? fallback)
}

async function restorePhoto(photo: PersistedPhoto | null) {
  if (!photo) {
    return null
  }

  const file = new File([photo.blob], photo.name || "photo", {
    type: photo.type || photo.blob.type || "image/jpeg",
    lastModified: photo.lastModified,
  })
  const url = URL.createObjectURL(file)

  try {
    return {
      file,
      url,
      image: await loadImage(url),
    }
  } catch {
    URL.revokeObjectURL(url)
    return null
  }
}

export function emptySlotPhotos(count: number) {
  return Array.from({ length: count }, () => null)
}

export function emptyPans(count: number) {
  return Array.from({ length: count }, () => DEFAULT_IMAGE_PAN)
}

export function emptyFits(count: number) {
  return Array.from({ length: count }, () => DEFAULT_IMAGE_FIT)
}

export function emptyTransparentSlots(count: number) {
  return Array.from({ length: count }, () => false)
}

export function createEmptyCollectionStory(): CollectionStoryState {
  const frameId = DEFAULT_COLLECTION_FRAME_ID
  const slotCount = getCollectionFrame(frameId).images.length

  return {
    id: createId(),
    frameId,
    photos: emptySlotPhotos(slotCount),
    pans: emptyPans(slotCount),
    fits: emptyFits(slotCount),
    transparentSlots: emptyTransparentSlots(slotCount),
    backgrounds: defaultBackgrounds(),
    spacings: defaultSpacings(),
  }
}

export async function cloneCollectionStory(
  story: CollectionStoryState
): Promise<CollectionStoryState> {
  const photos = await Promise.all(
    story.photos.map((photo) =>
      photo ? cloneLoadedPhoto(photo) : Promise.resolve(null)
    )
  )
  const backgrounds = Object.fromEntries(
    await Promise.all(
      Object.entries(story.backgrounds).map(async ([id, background]) => [
        id,
        await cloneBackground(background),
      ])
    )
  )

  return {
    id: createId(),
    frameId: story.frameId,
    photos,
    pans: story.pans.map((pan) => ({ ...pan })),
    fits: Array.from({ length: photos.length }, (_, index) =>
      isImageFit(story.fits?.[index]) ? story.fits[index] : DEFAULT_IMAGE_FIT
    ),
    transparentSlots: Array.from(
      { length: photos.length },
      (_, index) => story.transparentSlots?.[index] === true
    ),
    backgrounds,
    spacings: Object.fromEntries(
      Object.entries(story.spacings).map(([id, spacing]) => [
        id,
        {
          padding: { ...spacing.padding },
          gap: spacing.gap,
          linkHorizontal: spacing.linkHorizontal,
          linkVertical: spacing.linkVertical,
        },
      ])
    ),
  }
}

export function revokeLoadedPhoto(photo: LoadedSlotPhoto | null) {
  if (photo) {
    URL.revokeObjectURL(photo.url)
  }
}

export function revokeSlotPhotos(photos: Array<LoadedSlotPhoto | null>) {
  photos.forEach(revokeLoadedPhoto)
}

export function revokeFrameBackgrounds(
  backgrounds: Record<string, FrameBackground>
) {
  Object.values(backgrounds).forEach((background) => {
    revokeLoadedPhoto(background.image)
  })
}

export function revokeCollectionStory(story: CollectionStoryState) {
  revokeSlotPhotos(story.photos)
  revokeFrameBackgrounds(story.backgrounds)
}

export function revokeCollectionStories(stories: CollectionStoryState[]) {
  stories.forEach(revokeCollectionStory)
}

function persistPhotos(photos: Array<LoadedSlotPhoto | null>) {
  return photos.map((photo) => (photo ? persistPhoto(photo) : null))
}

export function collectionDraftFromState(state: {
  activeIndex: number
  stories: CollectionStoryState[]
}): CollectionDraft {
  const stories = state.stories.length
    ? state.stories
    : [createEmptyCollectionStory()]

  return {
    version: DRAFT_VERSION,
    activeIndex: Math.min(Math.max(state.activeIndex, 0), stories.length - 1),
    stories: stories.map((story) => ({
      id: story.id,
      frameId: story.frameId,
      pans: story.pans,
      fits: Array.from({ length: story.photos.length }, (_, index) =>
        isImageFit(story.fits?.[index]) ? story.fits[index] : DEFAULT_IMAGE_FIT
      ),
      backgrounds: Object.fromEntries(
        Object.entries(story.backgrounds).map(([id, background]) => [
          id,
          persistBackground(background),
        ])
      ),
      spacings: story.spacings,
      photos: persistPhotos(story.photos),
      transparentSlots: Array.from(
        { length: story.photos.length },
        (_, index) => story.transparentSlots?.[index] === true
      ),
    })),
  }
}

async function restoreStoryState(
  record: Record<string, unknown>
): Promise<CollectionStoryState> {
  const frameId =
    typeof record.frameId === "string" &&
    collectionFrames.some((frame) => frame.id === record.frameId)
      ? record.frameId
      : DEFAULT_COLLECTION_FRAME_ID
  const slotCount = getCollectionFrame(frameId).images.length
  const savedPhotos = Array.isArray(record.photos) ? record.photos : []
  const savedPans = Array.isArray(record.pans) ? record.pans : []
  const savedFits = Array.isArray(record.fits) ? record.fits : []
  const savedTransparentSlots = Array.isArray(record.transparentSlots)
    ? record.transparentSlots
    : []
  const photos = await Promise.all(
    padToCount(
      savedPhotos.map((photo) => (isPersistedPhoto(photo) ? photo : null)),
      slotCount,
      null
    ).map(restorePhoto)
  )
  const backgrounds = defaultBackgrounds()
  const spacings = { ...defaultSpacings() }

  if (isRecord(record.backgrounds)) {
    await Promise.all(
      Object.entries(record.backgrounds).map(async ([id, value]) => {
        if (!(id in backgrounds)) {
          return
        }

        backgrounds[id] = await restoreBackground(
          value,
          backgrounds[id]?.color ?? getCollectionFrame(id).background
        )
      })
    )
  }

  if (isRecord(record.spacings)) {
    for (const [id, value] of Object.entries(record.spacings)) {
      if (id in spacings && isSpacing(value)) {
        spacings[id] = {
          padding: { ...value.padding },
          gap: value.gap,
          linkHorizontal: value.linkHorizontal,
          linkVertical: value.linkVertical,
        }
      }
    }
  }

  return {
    id:
      typeof record.id === "string" && record.id.length > 0
        ? record.id
        : createId(),
    frameId,
    photos,
    backgrounds,
    spacings,
    pans: padToCount(
      savedPans.map((pan) => (isPan(pan) ? clampPan(pan) : DEFAULT_IMAGE_PAN)),
      slotCount,
      DEFAULT_IMAGE_PAN
    ),
    fits: padToCount(
      savedFits.map((fit) => (isImageFit(fit) ? fit : null)),
      slotCount,
      null
    ).map((fit, index) => {
      if (fit) {
        return fit
      }

      const photo = photos[index]
      const slot = getCollectionFrame(frameId).images[index]
      if (!photo || !slot) {
        return DEFAULT_IMAGE_FIT
      }

      return coverFit(
        photo.image.naturalWidth,
        photo.image.naturalHeight,
        slot.aspectWidth,
        slot.aspectHeight
      )
    }),
    transparentSlots: padToCount(
      savedTransparentSlots.map((value) => value === true),
      slotCount,
      false
    ),
  }
}

export async function restoreCollectionDraft(): Promise<RestoredCollectionDraft | null> {
  try {
    const db = await openDb()
    const record = await requestToPromise(
      db
        .transaction(STORE_NAME, "readonly")
        .objectStore(STORE_NAME)
        .get(DRAFT_KEY)
    )

    if (!isRecord(record)) {
      return null
    }

    if (record.version === LEGACY_DRAFT_VERSION) {
      return {
        activeIndex: 0,
        stories: [await restoreStoryState(record)],
      }
    }

    if (
      !isFiniteNumber(record.version) ||
      !SUPPORTED_DRAFT_VERSIONS.has(record.version) ||
      !Array.isArray(record.stories)
    ) {
      return null
    }

    const stories = (
      await Promise.all(
        record.stories.map((story) =>
          isRecord(story) ? restoreStoryState(story) : null
        )
      )
    ).filter((story): story is CollectionStoryState => story !== null)

    if (stories.length === 0) {
      return null
    }

    const savedIndex = isFiniteNumber(record.activeIndex)
      ? Math.trunc(record.activeIndex)
      : 0

    return {
      stories,
      activeIndex: Math.min(Math.max(savedIndex, 0), stories.length - 1),
    }
  } catch {
    return null
  }
}

async function writeDraft(draft: CollectionDraft) {
  const db = await openDb()
  const transaction = db.transaction(STORE_NAME, "readwrite")
  transaction.objectStore(STORE_NAME).put(draft, DRAFT_KEY)

  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

async function drainDraftWrites() {
  if (isWriting) {
    return
  }

  isWriting = true

  try {
    while (latestDraft) {
      const next = latestDraft
      latestDraft = null
      await writeDraft(next)
    }
  } catch {
    latestDraft = null
  } finally {
    isWriting = false
  }

  if (latestDraft) {
    await drainDraftWrites()
  }
}

export function saveCollectionDraft(draft: CollectionDraft) {
  latestDraft = draft
  return drainDraftWrites()
}
