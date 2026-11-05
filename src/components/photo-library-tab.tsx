import { Check, ImagePlus, Plus, Trash2 } from "lucide-react"
import { useId, useRef, useState } from "react"

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
import { UsedBadge } from "@/components/photo-picker-dialog"
import { fileSignature, type LibraryPhoto } from "@/lib/photo-library"
import { cn } from "@/lib/utils"

type Filter = "all" | "unused" | "used"

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unused", label: "Unused" },
  { value: "used", label: "Used" },
]

type PhotoLibraryTabProps = {
  photos: LibraryPhoto[]
  usedPhotos: ReadonlySet<string>
  onAdd: (files: File[]) => void
  onRemove: (ids: string[]) => void
}

function photoCount(count: number) {
  return count === 1 ? "1 photo" : `${count} photos`
}

export function PhotoLibraryTab({
  photos,
  usedPhotos,
  onAdd,
  onRemove,
}: PhotoLibraryTabProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")

  const isUsed = (photo: LibraryPhoto) =>
    usedPhotos.has(fileSignature(photo.file))
  const visiblePhotos = photos.filter(
    (photo) => filter === "all" || (filter === "used") === isUsed(photo)
  )

  // Photos can disappear while selected (e.g. deleted elsewhere).
  const selectedIds = photos
    .filter((photo) => selected.has(photo.id))
    .map((photo) => photo.id)

  function stopSelecting() {
    setSelecting(false)
    setSelected(new Set())
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (!next.delete(id)) {
        next.add(id)
      }
      return next
    })
  }

  function handleDelete() {
    onRemove(selectedIds)
    stopSelecting()
  }

  const fileInput = (
    <input
      id={inputId}
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      className="sr-only"
      onChange={(event) => {
        onAdd(Array.from(event.target.files ?? []))
        event.target.value = ""
      }}
    />
  )

  if (photos.length === 0) {
    return (
      <>
        {fileInput}
        <label
          htmlFor={inputId}
          className="flex size-full min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-center text-sm text-muted-foreground"
        >
          <ImagePlus className="size-6" />
          <span className="font-medium text-foreground">Add your photos</span>
          <span className="max-w-60 text-xs">
            Upload them once, then pick them for any story.
          </span>
        </label>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {fileInput}
      <div className="flex min-h-8 items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          {selecting
            ? `${selectedIds.length} selected`
            : photoCount(photos.length)}
        </span>
        {selecting ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={stopSelecting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={selectedIds.length === 0}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 data-icon="inline-start" />
              Delete
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelecting(true)}
          >
            Select
          </Button>
        )}
      </div>

      <div role="group" aria-label="Filter photos" className="flex gap-1.5">
        {FILTERS.map(({ value, label }) => (
          <Button
            key={value}
            type="button"
            size="xs"
            variant={filter === value ? "secondary" : "ghost"}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
        {selecting ? null : (
          <label
            htmlFor={inputId}
            className="flex aspect-square cursor-pointer items-center justify-center rounded-lg border border-dashed text-muted-foreground hover:bg-muted"
          >
            <span className="sr-only">Add photos</span>
            <Plus className="size-5" />
          </label>
        )}
        {visiblePhotos.map((photo) => {
          const isSelected = selected.has(photo.id)

          return (
            <button
              key={photo.id}
              type="button"
              disabled={!selecting}
              aria-pressed={selecting ? isSelected : undefined}
              aria-label={
                isUsed(photo) ? `${photo.file.name} (used)` : photo.file.name
              }
              className={cn(
                "relative aspect-square overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selecting && isSelected && "ring-2 ring-primary"
              )}
              onClick={() => toggle(photo.id)}
            >
              <img
                src={photo.thumbUrl}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                className={cn(
                  "size-full object-cover",
                  selecting && isSelected && "opacity-60"
                )}
              />
              {isUsed(photo) ? <UsedBadge /> : null}
              {selecting ? (
                <span
                  className={cn(
                    "absolute top-1 right-1 flex size-5 items-center justify-center rounded-full border border-white bg-black/30 text-white",
                    isSelected && "border-primary bg-primary"
                  )}
                >
                  {isSelected ? <Check className="size-3" /> : null}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {visiblePhotos.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {filter === "used"
            ? "No photos are used in a story yet."
            : "Every photo is used in a story."}
        </p>
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {photoCount(selectedIds.length)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              They're removed from your library. Stories that already use them
              keep their copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
