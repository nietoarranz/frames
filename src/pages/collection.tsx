import {
  Copy,
  Download,
  Image as ImageIcon,
  Images,
  LayoutTemplate,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  SquareDashed,
  Trash2,
  Undo2,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { CollectionFrame } from "@/components/collection-frame"
import { CollectionFramePreview } from "@/components/collection-frame-preview"
import { CollectionMargins } from "@/components/collection-margins"
import { FittedFrame } from "@/components/fitted-frame"
import { FrameBackgroundEditor } from "@/components/frame-background-picker"
import { Notice } from "@/components/notice"
import { PhotoLibraryTab } from "@/components/photo-library-tab"
import { PhotoPickerDialog } from "@/components/photo-picker-dialog"
import { StoryCarousel } from "@/components/story-carousel"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCollectionEditor } from "@/hooks/use-collection-editor"
import { useNotice } from "@/hooks/use-notice"
import { usePhotoLibrary } from "@/hooks/use-photo-library"
import { useStoryExports } from "@/hooks/use-story-exports"
import {
  cloneCollectionStory,
  createEmptyCollectionStory,
  type CollectionStoryState,
  type LoadedSlotPhoto,
} from "@/lib/collection-draft"
import {
  designFromStory,
  insertStory,
  isStoryReady,
  patchStoryBackground,
  removeStory,
  withFit,
  withFrame,
  withoutPhoto,
  withPan,
  withPhoto,
  withSpacing,
  withTransparentToggled,
} from "@/lib/collection-editor"
import {
  collectionFrames,
  frameUsesGap,
  spacingFromFrame,
} from "@/lib/collection-frames"
import { DEFAULT_IMAGE_PAN } from "@/lib/image-pan"
import { extractPalette, mergePalettes } from "@/lib/palette"
import { fileSignature, type LibraryPhoto } from "@/lib/photo-library"
import { loadImage } from "@/lib/story"
import { cn } from "@/lib/utils"

const TAB_TRIGGER_CLASS =
  "h-auto flex-none flex-col gap-1 px-3 py-1.5 text-xs group-data-horizontal/tabs:after:top-[-5px] group-data-horizontal/tabs:after:bottom-auto"

function pluralStories(count: number) {
  return count === 1 ? "1 story" : `${count} stories`
}

function isTextInput(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest("input, textarea, select") !== null)
  )
}

export function CollectionPage() {
  const {
    stories,
    activeIndex,
    canUndo,
    canRedo,
    commit,
    updateStory,
    setActiveIndex,
    undo,
    redo,
    getState,
  } = useCollectionEditor()
  const { notice, showNotice, dismissNotice } = useNotice()
  const { isExporting, exportStories } = useStoryExports(stories, activeIndex)
  const library = usePhotoLibrary()
  const usedPhotos = useMemo(() => {
    const used = new Set<string>()
    for (const story of stories) {
      for (const photo of story.photos) {
        if (photo) {
          used.add(fileSignature(photo.file))
        }
      }
    }
    return used
  }, [stories])
  const [confirmResetOpen, setConfirmResetOpen] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<{
    storyId: string
    index: number
  } | null>(null)

  const activeStory = stories[activeIndex] ?? stories[0]
  const { selectedFrame, spacing, background, design } =
    designFromStory(activeStory)
  const activeReady = isStoryReady(activeStory)
  const readyCount = stories.filter(isStoryReady).length
  const canSwipe = stories.length > 1
  const photoColors = useMemo(
    () =>
      mergePalettes(
        activeStory.photos
          .filter((photo): photo is LoadedSlotPhoto => photo !== null)
          .map((photo) => extractPalette(photo.image, 4))
      ),
    [activeStory.photos]
  )

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        isTextInput(event.target)
      ) {
        return
      }

      const key = event.key.toLowerCase()
      if (key === "z") {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
      } else if (key === "y" && event.ctrlKey && !event.metaKey) {
        event.preventDefault()
        redo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [redo, undo])

  /** Loads a picked file, or explains why it can't be used. */
  async function openPhoto(storyId: string, file: File) {
    const url = URL.createObjectURL(file)

    try {
      const image = await loadImage(url)
      if (getState().stories.some((story) => story.id === storyId)) {
        return { file, url, image }
      }
    } catch {
      showNotice(`Couldn't open “${file.name}”. Try a JPEG or PNG.`)
    }

    URL.revokeObjectURL(url)
    return null
  }

  async function handlePhotoSelected(
    storyId: string,
    index: number,
    file: File
  ) {
    const photo = await openPhoto(storyId, file)
    if (photo) {
      updateStory(storyId, (story) => withPhoto(story, index, photo))
    }
  }

  /** A photo picked or dropped on a slot joins the library too. */
  async function handleSlotUpload(storyId: string, index: number, file: File) {
    library.addPhotos([file])
    await handlePhotoSelected(storyId, index, file)
  }

  function handleLibraryPick(photo: LibraryPhoto) {
    if (pickerTarget) {
      void handlePhotoSelected(
        pickerTarget.storyId,
        pickerTarget.index,
        photo.file
      )
    }
    setPickerTarget(null)
  }

  function handlePickerUpload(files: File[]) {
    const [first] = library.addPhotos(files)
    if (first) {
      handleLibraryPick(first)
    }
  }

  async function handleBackgroundImageSelected(
    storyId: string,
    frameId: string,
    file: File
  ) {
    const image = await openPhoto(storyId, file)
    if (image) {
      updateStory(storyId, (story) =>
        patchStoryBackground(story, frameId, {
          mode: "image",
          image,
          imagePan: DEFAULT_IMAGE_PAN,
        })
      )
    }
  }

  function handleNewStory() {
    commit((state) =>
      insertStory(state, createEmptyCollectionStory(), state.activeIndex + 1)
    )
  }

  async function handleCopyStory() {
    const source = getState().stories[getState().activeIndex]
    if (!source) {
      return
    }

    const copy = await cloneCollectionStory(source)
    commit((state) => {
      const sourceIndex = state.stories.findIndex(
        (story) => story.id === source.id
      )
      return insertStory(
        state,
        copy,
        sourceIndex === -1 ? state.stories.length : sourceIndex + 1
      )
    })
  }

  function handleDeleteStory() {
    const storyId = activeStory.id
    commit((state) => removeStory(state, storyId))
    showNotice("Story deleted", { label: "Undo", onAction: undo })
  }

  function handleStartOver() {
    library.clearPhotos()
    commit(() => ({
      stories: [createEmptyCollectionStory()],
      activeIndex: 0,
    }))
    showNotice("Started over", { label: "Undo", onAction: undo })
  }

  async function handleExport(targets: CollectionStoryState[]) {
    try {
      const skipped = await exportStories(targets)
      if (skipped > 0 && targets.length > 1) {
        showNotice(`Skipped ${pluralStories(skipped)} with empty slots.`)
      }
    } catch {
      showNotice("Couldn't export. Please try again.")
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden overscroll-none bg-background">
      <header className="flex shrink-0 items-center justify-between gap-2 px-4 pt-3 pb-3 md:px-8 standalone:pt-[max(3rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Undo"
            title="Undo (⌘Z)"
            disabled={!canUndo}
            onClick={undo}
          >
            <Undo2 />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Redo"
            title="Redo (⇧⌘Z)"
            disabled={!canRedo}
            onClick={redo}
          >
            <Redo2 />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Start over"
            title="Start over"
            onClick={() => setConfirmResetOpen(true)}
          >
            <RotateCcw />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {canSwipe ? (
            <Button
              type="button"
              variant="outline"
              disabled={readyCount === 0 || isExporting}
              title={
                readyCount < stories.length
                  ? `${pluralStories(readyCount)} of ${stories.length} ready`
                  : undefined
              }
              onClick={() => {
                void handleExport(stories)
              }}
            >
              <Images data-icon="inline-start" />
              Download all
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={!activeReady || isExporting}
            onClick={() => {
              void handleExport([activeStory])
            }}
          >
            <Download data-icon="inline-start" />
            {isExporting ? "Exporting…" : "Download"}
          </Button>
        </div>
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
                      updateStory(
                        story.id,
                        (item) => withPan(item, index, pan),
                        `pan:${story.id}:${index}`
                      )
                    }}
                    onFitChange={(index, fit) => {
                      updateStory(story.id, (item) => withFit(item, index, fit))
                    }}
                    onBackgroundPanChange={
                      storyDesign.backgroundImage
                        ? (pan) => {
                            updateStory(
                              story.id,
                              (item) =>
                                patchStoryBackground(item, item.frameId, {
                                  imagePan: pan,
                                }),
                              `background-pan:${story.id}`
                            )
                          }
                        : undefined
                    }
                    onPhotoSelect={(index, file) => {
                      void handleSlotUpload(story.id, index, file)
                    }}
                    onPhotoPick={(index) => {
                      setPickerTarget({ storyId: story.id, index })
                    }}
                    onPhotoRemove={(index) => {
                      updateStory(story.id, (item) => withoutPhoto(item, index))
                    }}
                    onToggleTransparent={(index) => {
                      updateStory(story.id, (item) =>
                        withTransparentToggled(item, index)
                      )
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

        <Notice
          notice={notice}
          onDismiss={dismissNotice}
          className="absolute inset-x-0 bottom-9 z-30"
        />
      </section>

      <section className="mt-3 flex h-[35%] min-h-0 shrink-0 flex-col border-t bg-card pb-[env(safe-area-inset-bottom,0px)] standalone:pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <Tabs
          defaultValue="photos"
          className="flex h-full min-h-0 flex-col gap-0"
        >
          <TabsContent
            value="photos"
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
          >
            <PhotoLibraryTab
              photos={library.photos}
              usedPhotos={usedPhotos}
              onAdd={library.addPhotos}
              onRemove={library.removePhotos}
            />
          </TabsContent>

          <TabsContent
            value="frame"
            className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
          >
            <RadioGroup
              value={activeStory.frameId}
              onValueChange={(frameId) => {
                updateStory(activeStory.id, (story) =>
                  withFrame(story, frameId)
                )
              }}
              className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-3"
            >
              {collectionFrames.map((frame) => {
                const optionId = `frame-${frame.id}`

                return (
                  <FieldLabel key={frame.id} htmlFor={optionId}>
                    <Field className="items-center gap-2">
                      <CollectionFramePreview design={frame} className="h-24" />
                      <span className="text-xs font-medium">{frame.name}</span>
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
              photoColors={photoColors}
              onModeChange={(mode) => {
                updateStory(activeStory.id, (story) =>
                  patchStoryBackground(story, story.frameId, { mode })
                )
              }}
              onColorChange={(hex) => {
                updateStory(
                  activeStory.id,
                  (story) =>
                    patchStoryBackground(story, story.frameId, { color: hex }),
                  `color:${activeStory.id}:${activeStory.frameId}`
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
                updateStory(activeStory.id, (story) =>
                  patchStoryBackground(story, story.frameId, {
                    image: null,
                    imagePan: DEFAULT_IMAGE_PAN,
                  })
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
                updateStory(
                  activeStory.id,
                  (story) => withSpacing(story, next),
                  `spacing:${activeStory.id}:${activeStory.frameId}`
                )
              }}
            />
          </TabsContent>

          <TabsList
            variant="line"
            className="h-auto w-full shrink-0 justify-start rounded-none border-t px-4 py-1"
          >
            <TabsTrigger value="photos" className={TAB_TRIGGER_CLASS}>
              <ImageIcon />
              Photos
            </TabsTrigger>
            <TabsTrigger value="frame" className={TAB_TRIGGER_CLASS}>
              <LayoutTemplate />
              Frame
            </TabsTrigger>
            <TabsTrigger value="background" className={TAB_TRIGGER_CLASS}>
              <Palette />
              Background
            </TabsTrigger>
            <TabsTrigger value="margins" className={TAB_TRIGGER_CLASS}>
              <SquareDashed />
              Margins
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </section>

      <PhotoPickerDialog
        open={pickerTarget !== null}
        photos={library.photos}
        usedPhotos={usedPhotos}
        onOpenChange={(open) => {
          if (!open) {
            setPickerTarget(null)
          }
        }}
        onPick={handleLibraryPick}
        onUpload={handlePickerUpload}
      />

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start over?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes all {pluralStories(stories.length)} and every photo in
              the Photos tab so you can start from scratch. Undo only restores
              the stories.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStartOver}>
              Delete all stories
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
