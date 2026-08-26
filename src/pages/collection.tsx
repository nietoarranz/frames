import {
  Copy,
  Download,
  LayoutTemplate,
  Palette,
  Plus,
  SquareDashed,
  Trash2,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { CollectionFrame } from "@/components/collection-frame"
import { CollectionFramePreview } from "@/components/collection-frame-preview"
import { FittedFrame } from "@/components/fitted-frame"
import {
  CollectionMargins,
  spacingFromFrame,
} from "@/components/collection-margins"
import { FrameBackgroundEditor } from "@/components/frame-background-picker"
import { StoryCarousel } from "@/components/story-carousel"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  cloneCollectionStory,
  collectionDraftFromState,
  createEmptyCollectionStory,
  getStoryBackground,
  restoreCollectionDraft,
  revokeCollectionStories,
  revokeCollectionStory,
  revokeLoadedPhoto,
  saveCollectionDraft,
  type CollectionStoryState,
  type FrameBackground,
  type LoadedSlotPhoto,
} from "@/lib/collection-draft"
import {
  collectionFrames,
  frameUsesGap,
  getCollectionFrame,
} from "@/lib/collection-frames"
import {
  coverFit,
  DEFAULT_IMAGE_FIT,
  DEFAULT_IMAGE_PAN,
  type ImageFit,
  type ImagePan,
} from "@/lib/image-pan"
import { composeCollectionStoryBlob } from "@/lib/collection-story"
import { loadImage, shareFile, shareImage } from "@/lib/story"
import { cn } from "@/lib/utils"

type PreparedExport = {
  file: File
  url: string
}

function storyFilename(photos: Array<LoadedSlotPhoto | null>, frameId: string) {
  const firstName = photos[0]?.file.name.replace(/\.[^.]+$/, "")
  return firstName ? `${firstName}-story.png` : `${frameId}-story.png`
}

function slotPhotosFromState(
  photos: Array<LoadedSlotPhoto | null>,
  pans: ImagePan[],
  fits: ImageFit[]
) {
  return photos.map((photo, index) =>
    photo
      ? {
          file: photo.file,
          image: photo.image,
          imageWidth: photo.image.naturalWidth,
          imageHeight: photo.image.naturalHeight,
          pan: pans[index] ?? DEFAULT_IMAGE_PAN,
          fit: fits[index] ?? DEFAULT_IMAGE_FIT,
        }
      : null
  )
}

function designFromStory(story: CollectionStoryState) {
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

function exportBackgroundImage(background: FrameBackground) {
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

function patchStoryBackground(
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

export function CollectionPage() {
  const [stories, setStories] = useState<CollectionStoryState[]>(() => [
    createEmptyCollectionStory(),
  ])
  const [activeIndex, setActiveIndex] = useState(0)
  const [isExporting, setIsExporting] = useState(false)
  const [draftReady, setDraftReady] = useState(false)
  const storiesRef = useRef(stories)
  const activeIndexRef = useRef(activeIndex)
  const draftRef = useRef({
    stories,
    activeIndex,
  })
  const draftReadyRef = useRef(false)
  const preparedExportRef = useRef<PreparedExport | null>(null)

  const activeStory = stories[activeIndex] ?? stories[0]
  const { selectedFrame, spacing, background, design } =
    designFromStory(activeStory)
  const allPhotosReady =
    activeStory.photos.length === design.images.length &&
    activeStory.photos.every(
      (photo, index) =>
        Boolean(photo) || activeStory.transparentSlots?.[index] === true
    )
  const canSwipe = stories.length > 1

  useEffect(() => {
    storiesRef.current = stories
    activeIndexRef.current = activeIndex
    draftRef.current = {
      stories,
      activeIndex,
    }
  }, [activeIndex, stories])

  useEffect(() => {
    draftReadyRef.current = draftReady
  }, [draftReady])

  useEffect(() => {
    let cancelled = false

    void restoreCollectionDraft().then((draft) => {
      if (cancelled) {
        if (draft) {
          revokeCollectionStories(draft.stories)
        }
        return
      }

      if (draft) {
        draftRef.current = draft
        setStories(draft.stories)
        setActiveIndex(draft.activeIndex)
      }

      draftReadyRef.current = true
      setDraftReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!draftReady) {
      return
    }

    const timer = window.setTimeout(() => {
      void saveCollectionDraft(collectionDraftFromState(draftRef.current))
    }, 250)

    return () => {
      window.clearTimeout(timer)
    }
  }, [activeIndex, draftReady, stories])

  useEffect(() => {
    function flushDraft() {
      if (!draftReadyRef.current) {
        return
      }

      void saveCollectionDraft(collectionDraftFromState(draftRef.current))
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        flushDraft()
      }
    }

    window.addEventListener("pagehide", flushDraft)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    document.addEventListener("freeze", flushDraft)

    return () => {
      window.removeEventListener("pagehide", flushDraft)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      document.removeEventListener("freeze", flushDraft)
    }
  }, [])

  useEffect(() => {
    return () => {
      revokeCollectionStories(storiesRef.current)
      if (preparedExportRef.current) {
        URL.revokeObjectURL(preparedExportRef.current.url)
      }
    }
  }, [])

  useEffect(() => {
    if (!allPhotosReady) {
      if (preparedExportRef.current) {
        URL.revokeObjectURL(preparedExportRef.current.url)
        preparedExportRef.current = null
      }
      return
    }

    let cancelled = false
    const timer = window.setTimeout(() => {
      void composeCollectionStoryBlob(
        {
          ...selectedFrame,
          background: background.color,
          padding: spacing.padding,
          gap: spacing.gap,
        },
        slotPhotosFromState(
          activeStory.photos,
          activeStory.pans,
          activeStory.fits ?? []
        ),
        exportBackgroundImage(background)
      ).then((blob) => {
        if (cancelled) {
          return
        }

        if (preparedExportRef.current) {
          URL.revokeObjectURL(preparedExportRef.current.url)
        }

        const filename = storyFilename(activeStory.photos, selectedFrame.id)
        preparedExportRef.current = {
          file: new File([blob], filename, {
            type: blob.type || "image/png",
          }),
          url: URL.createObjectURL(blob),
        }
      })
    }, 250)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [
    activeStory.pans,
    activeStory.fits,
    activeStory.photos,
    allPhotosReady,
    background,
    selectedFrame,
    spacing.gap,
    spacing.padding,
    activeStory.transparentSlots,
  ])

  function updateActiveStory(
    updater: (story: CollectionStoryState) => CollectionStoryState
  ) {
    const storyIndex = activeIndexRef.current
    setStories((current) =>
      current.map((story, index) =>
        index === storyIndex ? updater(story) : story
      )
    )
  }

  function handleFrameChange(nextFrameId: string) {
    const nextCount = getCollectionFrame(nextFrameId).images.length

    updateActiveStory((story) => {
      story.photos.slice(nextCount).forEach((photo) => {
        if (photo) {
          URL.revokeObjectURL(photo.url)
        }
      })

      return {
        ...story,
        frameId: nextFrameId,
        photos: Array.from(
          { length: nextCount },
          (_, index) => story.photos[index] ?? null
        ),
        pans: Array.from(
          { length: nextCount },
          (_, index) => story.pans[index] ?? DEFAULT_IMAGE_PAN
        ),
        fits: Array.from(
          { length: nextCount },
          (_, index) => story.fits?.[index] ?? DEFAULT_IMAGE_FIT
        ),
        transparentSlots: Array.from(
          { length: nextCount },
          (_, index) => story.transparentSlots?.[index] ?? false
        ),
      }
    })
  }

  async function handlePhotoSelected(
    storyId: string,
    index: number,
    file: File
  ) {
    const url = URL.createObjectURL(file)
    const image = await loadImage(url)

    setStories((current) =>
      current.map((story) => {
        if (story.id !== storyId) {
          return story
        }

        const nextPhotos = [...story.photos]
        const existing = nextPhotos[index]
        if (existing) {
          URL.revokeObjectURL(existing.url)
        }
        nextPhotos[index] = { file, url, image }

        const nextPans = [...story.pans]
        nextPans[index] = DEFAULT_IMAGE_PAN

        const nextFits = [...(story.fits ?? [])]
        const slot = getCollectionFrame(story.frameId).images[index]
        nextFits[index] = coverFit(
          image.naturalWidth,
          image.naturalHeight,
          slot?.aspectWidth ?? 1,
          slot?.aspectHeight ?? 1
        )

        const nextTransparentSlots = [...(story.transparentSlots ?? [])]
        nextTransparentSlots[index] = false

        return {
          ...story,
          photos: nextPhotos,
          pans: nextPans,
          fits: nextFits,
          transparentSlots: nextTransparentSlots,
        }
      })
    )
  }

  function handlePhotoRemoved(storyId: string, index: number) {
    setStories((current) =>
      current.map((story) => {
        if (story.id !== storyId) {
          return story
        }

        const nextPhotos = [...story.photos]
        const existing = nextPhotos[index]
        if (existing) {
          URL.revokeObjectURL(existing.url)
        }
        nextPhotos[index] = null

        const nextPans = [...story.pans]
        nextPans[index] = DEFAULT_IMAGE_PAN

        const nextFits = [...(story.fits ?? [])]
        nextFits[index] = DEFAULT_IMAGE_FIT

        const nextTransparentSlots = [...(story.transparentSlots ?? [])]
        nextTransparentSlots[index] = false

        return {
          ...story,
          photos: nextPhotos,
          pans: nextPans,
          fits: nextFits,
          transparentSlots: nextTransparentSlots,
        }
      })
    )
  }

  function handleToggleTransparent(storyId: string, index: number) {
    setStories((current) =>
      current.map((story) => {
        if (story.id !== storyId) {
          return story
        }

        const nextTransparentSlots = [...(story.transparentSlots ?? [])]
        const nextValue = !nextTransparentSlots[index]
        nextTransparentSlots[index] = nextValue

        const nextPhotos = [...story.photos]
        const nextPans = [...story.pans]
        const nextFits = [...(story.fits ?? [])]

        if (nextValue) {
          const existing = nextPhotos[index]
          if (existing) {
            URL.revokeObjectURL(existing.url)
          }
          nextPhotos[index] = null
          nextPans[index] = DEFAULT_IMAGE_PAN
          nextFits[index] = DEFAULT_IMAGE_FIT
        }

        return {
          ...story,
          photos: nextPhotos,
          pans: nextPans,
          fits: nextFits,
          transparentSlots: nextTransparentSlots,
        }
      })
    )
  }

  async function handleBackgroundImageSelected(
    storyId: string,
    frameId: string,
    file: File
  ) {
    const url = URL.createObjectURL(file)
    let image: HTMLImageElement

    try {
      image = await loadImage(url)
    } catch {
      URL.revokeObjectURL(url)
      return
    }

    setStories((current) =>
      current.map((story) => {
        if (story.id !== storyId) {
          return story
        }

        const currentBackground = getStoryBackground(story, frameId)
        revokeLoadedPhoto(currentBackground.image)

        return patchStoryBackground(story, frameId, {
          mode: "image",
          image: { file, url, image },
          imagePan: DEFAULT_IMAGE_PAN,
        })
      })
    )
  }

  function handleBackgroundImageRemoved(storyId: string, frameId: string) {
    setStories((current) =>
      current.map((story) => {
        if (story.id !== storyId) {
          return story
        }

        const currentBackground = getStoryBackground(story, frameId)
        revokeLoadedPhoto(currentBackground.image)

        return patchStoryBackground(story, frameId, {
          image: null,
          imagePan: DEFAULT_IMAGE_PAN,
        })
      })
    )
  }

  function handleNewStory() {
    const nextStory = createEmptyCollectionStory()
    const insertAt = activeIndexRef.current + 1

    setStories((current) => {
      const next = [...current]
      next.splice(insertAt, 0, nextStory)
      return next
    })
    setActiveIndex(insertAt)
  }

  async function handleCopyStory() {
    const source = storiesRef.current[activeIndexRef.current]
    if (!source) {
      return
    }

    const copy = await cloneCollectionStory(source)
    const sourceIndex = storiesRef.current.findIndex(
      (story) => story.id === source.id
    )
    const insertAt =
      sourceIndex === -1 ? storiesRef.current.length : sourceIndex + 1

    setStories((current) => {
      if (current.some((story) => story.id === copy.id)) {
        return current
      }

      const next = [...current]
      const currentSourceIndex = next.findIndex(
        (story) => story.id === source.id
      )
      const at =
        currentSourceIndex === -1 ? next.length : currentSourceIndex + 1
      next.splice(at, 0, copy)
      return next
    })
    setActiveIndex(insertAt)
  }

  function handleDeleteStory() {
    const current = storiesRef.current
    if (current.length <= 1) {
      return
    }

    const storyIndex = activeIndexRef.current
    const removed = current[storyIndex]
    if (!removed) {
      return
    }

    revokeCollectionStory(removed)
    setStories((stories) => {
      if (stories.length <= 1) {
        return stories
      }

      return stories.filter((story) => story.id !== removed.id)
    })
    setActiveIndex(Math.min(storyIndex, current.length - 2))
  }

  async function handleDownload() {
    if (!allPhotosReady) {
      return
    }

    const prepared = preparedExportRef.current
    if (prepared) {
      await shareFile(prepared.file, prepared.url)
      return
    }

    setIsExporting(true)

    try {
      const blob = await composeCollectionStoryBlob(
        design,
        slotPhotosFromState(
          activeStory.photos,
          activeStory.pans,
          activeStory.fits ?? []
        ),
        exportBackgroundImage(background)
      )
      const filename = storyFilename(activeStory.photos, design.id)
      const url = URL.createObjectURL(blob)

      try {
        await shareImage(url, filename)
      } finally {
        URL.revokeObjectURL(url)
      }
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden overscroll-none bg-background">
      <header className="flex shrink-0 items-center justify-end px-4 pt-3 pb-3 md:px-8 standalone:pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Button
          type="button"
          variant="outline"
          disabled={!allPhotosReady || isExporting}
          onClick={() => {
            const prepared = preparedExportRef.current
            if (prepared) {
              void shareFile(prepared.file, prepared.url)
              return
            }

            void handleDownload()
          }}
        >
          <Download data-icon="inline-start" />
          {isExporting ? "Exporting…" : "Download story"}
        </Button>
      </header>

      <section className="relative min-h-0 flex-1 touch-none overflow-hidden">
        <div className="absolute inset-0 min-h-0">
          <StoryCarousel index={activeIndex} onIndexChange={setActiveIndex}>
            {stories.map((story) => {
              const storyDesign = designFromStory(story)

              return (
                <FittedFrame
                  key={story.id}
                  className={cn(
                    "px-4 py-2 md:px-8",
                    canSwipe && "pb-8",
                    story.id !== activeStory.id && "pointer-events-none"
                  )}
                >
                  <CollectionFrame
                    className="size-full min-h-0 min-w-0"
                    design={storyDesign.design}
                    photoUrls={story.photos.map((photo) => photo?.url ?? null)}
                    pans={story.pans}
                    fits={story.fits}
                    transparentSlots={story.transparentSlots}
                    backgroundImageUrl={
                      storyDesign.backgroundImage?.url ?? null
                    }
                    backgroundPan={storyDesign.background.imagePan}
                    passthroughHorizontalSwipe={canSwipe}
                    onPanChange={(index, pan) => {
                      setStories((current) =>
                        current.map((item) => {
                          if (item.id !== story.id) {
                            return item
                          }

                          const nextPans = [...item.pans]
                          nextPans[index] = pan
                          return { ...item, pans: nextPans }
                        })
                      )
                    }}
                    onFitChange={(index, fit) => {
                      setStories((current) =>
                        current.map((item) => {
                          if (item.id !== story.id) {
                            return item
                          }

                          const nextFits = [...(item.fits ?? [])]
                          nextFits[index] = fit
                          return { ...item, fits: nextFits }
                        })
                      )
                    }}
                    onBackgroundPanChange={
                      storyDesign.backgroundImage
                        ? (pan) => {
                            setStories((current) =>
                              current.map((item) => {
                                if (item.id !== story.id) {
                                  return item
                                }

                                return patchStoryBackground(
                                  item,
                                  item.frameId,
                                  { imagePan: pan }
                                )
                              })
                            )
                          }
                        : undefined
                    }
                    onPhotoSelect={(index, file) => {
                      void handlePhotoSelected(story.id, index, file)
                    }}
                    onPhotoRemove={(index) => {
                      handlePhotoRemoved(story.id, index)
                    }}
                    onToggleTransparent={(index) => {
                      handleToggleTransparent(story.id, index)
                    }}
                  />
                </FittedFrame>
              )
            })}
          </StoryCarousel>
        </div>

        <div className="absolute top-1/2 right-[max(0.5rem,env(safe-area-inset-right))] z-20 flex -translate-y-1/2 flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-10 rounded-full shadow-lg"
            aria-label="New story"
            title="New story"
            onClick={handleNewStory}
          >
            <Plus />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-10 rounded-full shadow-lg"
            aria-label="Copy story"
            title="Copy story"
            onClick={() => {
              void handleCopyStory()
            }}
          >
            <Copy />
          </Button>
          {canSwipe ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="size-10 rounded-full shadow-lg"
              aria-label="Delete story"
              title="Delete story"
              onClick={handleDeleteStory}
            >
              <Trash2 />
            </Button>
          ) : null}
        </div>
      </section>

      <section className="mt-3 flex h-[35%] min-h-0 shrink-0 flex-col border-t bg-card pb-[env(safe-area-inset-bottom,0px)]">
        <Tabs
          defaultValue="frame"
          className="flex h-full min-h-0 flex-col gap-0"
        >
          <TabsContent
            value="frame"
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
          >
            <RadioGroup
              value={activeStory.frameId}
              onValueChange={handleFrameChange}
              className="grid grid-cols-2 gap-3"
            >
              {collectionFrames.map((frame) => {
                const optionId = `frame-${frame.id}`

                return (
                  <FieldLabel key={frame.id} htmlFor={optionId}>
                    <Field className="items-center">
                      <CollectionFramePreview design={frame} />
                    </Field>
                    <RadioGroupItem
                      value={frame.id}
                      id={optionId}
                      aria-label={frame.name}
                      className="sr-only absolute size-0 overflow-hidden border-0 p-0"
                    />
                  </FieldLabel>
                )
              })}
            </RadioGroup>
          </TabsContent>

          <TabsContent
            value="background"
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
          >
            <FrameBackgroundEditor
              key={`${activeStory.id}-${activeStory.frameId}`}
              background={background}
              onModeChange={(mode) => {
                updateActiveStory((story) =>
                  patchStoryBackground(story, story.frameId, { mode })
                )
              }}
              onColorChange={(hex) => {
                updateActiveStory((story) =>
                  patchStoryBackground(story, story.frameId, { color: hex })
                )
              }}
              onImageSelect={(file) => {
                void handleBackgroundImageSelected(
                  activeStory.id,
                  activeStory.frameId,
                  file
                )
              }}
              onImageRemove={() => {
                handleBackgroundImageRemoved(
                  activeStory.id,
                  activeStory.frameId
                )
              }}
            />
          </TabsContent>

          <TabsContent
            value="margins"
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
          >
            <CollectionMargins
              key={activeStory.id}
              width={design.width}
              height={design.height}
              spacing={spacing}
              defaults={spacingFromFrame(selectedFrame)}
              showGap={frameUsesGap(design)}
              onSpacingChange={(next) => {
                updateActiveStory((story) => ({
                  ...story,
                  spacings: {
                    ...story.spacings,
                    [story.frameId]: next,
                  },
                }))
              }}
            />
          </TabsContent>

          <TabsList
            variant="line"
            className="h-auto w-full shrink-0 justify-start rounded-none border-t px-4 py-1"
          >
            <TabsTrigger
              value="frame"
              className="h-auto flex-none flex-col gap-1 px-3 py-1.5 text-xs group-data-horizontal/tabs:after:top-[-5px] group-data-horizontal/tabs:after:bottom-auto"
            >
              <LayoutTemplate />
              Frame
            </TabsTrigger>
            <TabsTrigger
              value="background"
              className="h-auto flex-none flex-col gap-1 px-3 py-1.5 text-xs group-data-horizontal/tabs:after:top-[-5px] group-data-horizontal/tabs:after:bottom-auto"
            >
              <Palette />
              Background
            </TabsTrigger>
            <TabsTrigger
              value="margins"
              className="h-auto flex-none flex-col gap-1 px-3 py-1.5 text-xs group-data-horizontal/tabs:after:top-[-5px] group-data-horizontal/tabs:after:bottom-auto"
            >
              <SquareDashed />
              Margins
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </section>
    </div>
  )
}
