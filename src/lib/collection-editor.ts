import {
  getCollectionFrame,
  spacingFromFrame,
  type CollectionFrameSpacing,
} from "@/lib/collection-frames"
import {
  getStoryBackground,
  type CollectionStoryState,
  type FrameBackground,
  type LoadedSlotPhoto,
} from "@/lib/collection-draft"
import {
  composeCollectionStoryBlob,
  type CollectionBackgroundImage,
  type CollectionSlotPhoto,
} from "@/lib/collection-story"
import {
  coverFit,
  DEFAULT_IMAGE_FIT,
  DEFAULT_IMAGE_PAN,
  type ImageFit,
  type ImagePan,
} from "@/lib/image-pan"

export type EditorState = {
  stories: CollectionStoryState[]
  activeIndex: number
}

export function designFromStory(story: CollectionStoryState) {
  const selectedFrame = getCollectionFrame(story.frameId)
  const spacing =
    story.spacings[story.frameId] ?? spacingFromFrame(selectedFrame)
  const background = getStoryBackground(story)
  const backgroundImage = background.mode === "image" ? background.image : null

  return {
    selectedFrame,
    spacing,
    background,
    backgroundImage,
    design: {
      ...selectedFrame,
      background: background.color,
      padding: spacing.padding,
      gap: spacing.gap,
    },
  }
}

/** Every slot has a photo or deliberately shows the background. */
export function isStoryReady(story: CollectionStoryState) {
  const slotCount = getCollectionFrame(story.frameId).images.length

  return (
    story.photos.length === slotCount &&
    story.photos.every(
      (photo, index) =>
        Boolean(photo) || story.transparentSlots?.[index] === true
    )
  )
}

function slotPhotosForExport(
  story: CollectionStoryState
): Array<CollectionSlotPhoto | null> {
  return story.photos.map((photo, index) =>
    photo
      ? {
          file: photo.file,
          image: photo.image,
          imageWidth: photo.image.naturalWidth,
          imageHeight: photo.image.naturalHeight,
          pan: story.pans[index] ?? DEFAULT_IMAGE_PAN,
          fit: story.fits?.[index] ?? DEFAULT_IMAGE_FIT,
        }
      : null
  )
}

function backgroundForExport(
  background: FrameBackground
): CollectionBackgroundImage | null {
  if (background.mode !== "image" || !background.image) {
    return null
  }

  return {
    image: background.image.image,
    imageWidth: background.image.image.naturalWidth,
    imageHeight: background.image.image.naturalHeight,
    pan: background.imagePan,
  }
}

export function storyFilename(story: CollectionStoryState) {
  const firstName = story.photos
    .find((photo) => photo)
    ?.file.name.replace(/\.[^.]+$/, "")
  return firstName ? `${firstName}-story.png` : `${story.frameId}-story.png`
}

/** Appends -2, -3… before the extension so names don't overwrite each other. */
export function uniqueFilenames(names: string[]) {
  const seen = new Map<string, number>()

  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1
    seen.set(name, count)
    if (count === 1) {
      return name
    }

    const dot = name.lastIndexOf(".")
    return dot > 0
      ? `${name.slice(0, dot)}-${count}${name.slice(dot)}`
      : `${name}-${count}`
  })
}

export async function composeStoryFile(story: CollectionStoryState) {
  const { design, background } = designFromStory(story)
  const blob = await composeCollectionStoryBlob(
    design,
    slotPhotosForExport(story),
    backgroundForExport(background)
  )

  return new File([blob], storyFilename(story), {
    type: blob.type || "image/png",
  })
}

export function patchStoryBackground(
  story: CollectionStoryState,
  frameId: string,
  patch: Partial<FrameBackground>
): CollectionStoryState {
  const current = getStoryBackground(story, frameId)

  return {
    ...story,
    backgrounds: {
      ...story.backgrounds,
      [frameId]: { ...current, ...patch },
    },
  }
}

function replaceAt<T>(items: T[], index: number, value: T) {
  const next = [...items]
  next[index] = value
  return next
}

function slotFit(photo: LoadedSlotPhoto, frameId: string, index: number) {
  const slot = getCollectionFrame(frameId).images[index]

  return coverFit(
    photo.image.naturalWidth,
    photo.image.naturalHeight,
    slot?.aspectWidth ?? 1,
    slot?.aspectHeight ?? 1
  )
}

/**
 * Switches frame, keeping photos that still have a slot. Kept photos are
 * re-fitted to cover their new slot shape and re-centered.
 */
export function withFrame(
  story: CollectionStoryState,
  frameId: string
): CollectionStoryState {
  if (story.frameId === frameId) {
    return story
  }

  const slotCount = getCollectionFrame(frameId).images.length
  const photos = Array.from(
    { length: slotCount },
    (_, index) => story.photos[index] ?? null
  )

  return {
    ...story,
    frameId,
    photos,
    pans: photos.map(() => DEFAULT_IMAGE_PAN),
    fits: photos.map((photo, index) =>
      photo ? slotFit(photo, frameId, index) : DEFAULT_IMAGE_FIT
    ),
    transparentSlots: photos.map(
      (_, index) => story.transparentSlots?.[index] ?? false
    ),
  }
}

export function withPhoto(
  story: CollectionStoryState,
  index: number,
  photo: LoadedSlotPhoto
): CollectionStoryState {
  return {
    ...story,
    photos: replaceAt(story.photos, index, photo),
    pans: replaceAt(story.pans, index, DEFAULT_IMAGE_PAN),
    fits: replaceAt(
      story.fits ?? [],
      index,
      slotFit(photo, story.frameId, index)
    ),
    transparentSlots: replaceAt(story.transparentSlots ?? [], index, false),
  }
}

export function withoutPhoto(
  story: CollectionStoryState,
  index: number
): CollectionStoryState {
  return {
    ...story,
    photos: replaceAt(story.photos, index, null),
    pans: replaceAt(story.pans, index, DEFAULT_IMAGE_PAN),
    fits: replaceAt(story.fits ?? [], index, DEFAULT_IMAGE_FIT),
    transparentSlots: replaceAt(story.transparentSlots ?? [], index, false),
  }
}

export function withTransparentToggled(
  story: CollectionStoryState,
  index: number
): CollectionStoryState {
  const transparent = !story.transparentSlots?.[index]
  const cleared = transparent ? withoutPhoto(story, index) : story

  return {
    ...cleared,
    transparentSlots: replaceAt(
      cleared.transparentSlots ?? [],
      index,
      transparent
    ),
  }
}

export function withPan(
  story: CollectionStoryState,
  index: number,
  pan: ImagePan
): CollectionStoryState {
  return { ...story, pans: replaceAt(story.pans, index, pan) }
}

export function withFit(
  story: CollectionStoryState,
  index: number,
  fit: ImageFit
): CollectionStoryState {
  return { ...story, fits: replaceAt(story.fits ?? [], index, fit) }
}

export function withSpacing(
  story: CollectionStoryState,
  spacing: CollectionFrameSpacing
): CollectionStoryState {
  return {
    ...story,
    spacings: { ...story.spacings, [story.frameId]: spacing },
  }
}

export function updateStory(
  state: EditorState,
  storyId: string,
  updater: (story: CollectionStoryState) => CollectionStoryState
): EditorState {
  let changed = false
  const stories = state.stories.map((story) => {
    if (story.id !== storyId) {
      return story
    }

    const next = updater(story)
    changed ||= next !== story
    return next
  })

  return changed ? { ...state, stories } : state
}

export function insertStory(
  state: EditorState,
  story: CollectionStoryState,
  at: number
): EditorState {
  const index = Math.min(Math.max(at, 0), state.stories.length)
  const stories = [...state.stories]
  stories.splice(index, 0, story)
  return { stories, activeIndex: index }
}

export function removeStory(state: EditorState, storyId: string): EditorState {
  if (state.stories.length <= 1) {
    return state
  }

  const index = state.stories.findIndex((story) => story.id === storyId)
  if (index === -1) {
    return state
  }

  const stories = state.stories.filter((story) => story.id !== storyId)
  const activeIndex =
    state.activeIndex > index
      ? state.activeIndex - 1
      : Math.min(state.activeIndex, stories.length - 1)

  return { stories, activeIndex }
}

/** Object URLs referenced by photos and background images. */
export function collectObjectUrls(
  stories: CollectionStoryState[],
  into = new Set<string>()
) {
  for (const story of stories) {
    for (const photo of story.photos) {
      if (photo) {
        into.add(photo.url)
      }
    }
    for (const background of Object.values(story.backgrounds)) {
      if (background.image) {
        into.add(background.image.url)
      }
    }
  }

  return into
}
