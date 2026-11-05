import { Check, ImagePlus, X } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"
import { useId } from "react"

import { Button } from "@/components/ui/button"
import { fileSignature, type LibraryPhoto } from "@/lib/photo-library"

export function UsedBadge() {
  return (
    <span
      title="Used in a story"
      className="absolute right-1 bottom-1 flex size-5 items-center justify-center rounded-full bg-black/60 text-white"
    >
      <Check className="size-3" />
    </span>
  )
}

type PhotoPickerDialogProps = {
  open: boolean
  photos: LibraryPhoto[]
  usedPhotos: ReadonlySet<string>
  onOpenChange: (open: boolean) => void
  onPick: (photo: LibraryPhoto) => void
  onUpload: (files: File[]) => void
}

export function PhotoPickerDialog({
  open,
  photos,
  usedPhotos,
  onOpenChange,
  onPick,
  onUpload,
}: PhotoPickerDialogProps) {
  const inputId = useId()

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[75%] w-full max-w-lg flex-col gap-3 rounded-t-2xl bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-lg outline-hidden duration-200 data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom"
        >
          <div className="flex items-center justify-between gap-2">
            <DialogPrimitive.Title className="text-base font-medium">
              Choose a photo
            </DialogPrimitive.Title>
            <div className="flex items-center gap-1">
              <input
                id={inputId}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(event) => {
                  onUpload(Array.from(event.target.files ?? []))
                  event.target.value = ""
                }}
              />
              <Button variant="outline" size="sm" asChild>
                <label htmlFor={inputId} className="cursor-pointer">
                  <ImagePlus data-icon="inline-start" />
                  Upload
                </label>
              </Button>
              <DialogPrimitive.Close asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close"
                >
                  <X />
                </Button>
              </DialogPrimitive.Close>
            </div>
          </div>

          {photos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Your library is empty. Upload photos to use them here.
            </p>
          ) : (
            <div className="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2 overflow-y-auto">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  aria-label={
                    usedPhotos.has(fileSignature(photo.file))
                      ? `${photo.file.name} (used)`
                      : photo.file.name
                  }
                  className="relative aspect-square overflow-hidden rounded-lg bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onPick(photo)}
                >
                  <img
                    src={photo.thumbUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="size-full object-cover"
                  />
                  {usedPhotos.has(fileSignature(photo.file)) ? (
                    <UsedBadge />
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
