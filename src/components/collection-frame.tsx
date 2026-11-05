import { Fragment, useId, useRef, useState, type CSSProperties } from "react"
import { EyeDashed, ImagePlus, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { PannablePhoto } from "@/components/pannable-photo"
import {
  slotLabel,
  type CollectionFrameDesign,
  type CollectionFramePadding,
} from "@/lib/collection-frames"
import {
  DEFAULT_IMAGE_FIT,
  DEFAULT_IMAGE_PAN,
  toggleImageFit,
  type ImageFit,
  type ImagePan,
} from "@/lib/image-pan"
import { cn } from "@/lib/utils"

const FRAME_RADIUS = "1.5rem"

function slotCornerRadius(
  index: number,
  lastIndex: number,
  padding: CollectionFramePadding
): CSSProperties {
  const isFirst = index === 0
  const isLast = index === lastIndex

  return {
    borderTopLeftRadius:
      isFirst && padding.top === 0 && padding.left === 0 ? FRAME_RADIUS : 0,
    borderTopRightRadius:
      isFirst && padding.top === 0 && padding.right === 0 ? FRAME_RADIUS : 0,
    borderBottomLeftRadius:
      isLast && padding.bottom === 0 && padding.left === 0 ? FRAME_RADIUS : 0,
    borderBottomRightRadius:
      isLast && padding.bottom === 0 && padding.right === 0 ? FRAME_RADIUS : 0,
  }
}

type CollectionFrameProps = {
  design: CollectionFrameDesign
  photoUrls: Array<string | null>
  pans?: ImagePan[]
  fits?: ImageFit[]
  transparentSlots?: boolean[]
  backgroundImageUrl?: string | null
  backgroundPan?: ImagePan
  onPanChange?: (index: number, pan: ImagePan) => void
  onFitChange?: (index: number, fit: ImageFit) => void
  onBackgroundPanChange?: (pan: ImagePan) => void
  onPhotoSelect?: (index: number, file: File) => void
  onPhotoPick?: (index: number) => void
  onPhotoRemove?: (index: number) => void
  onToggleTransparent?: (index: number) => void
  passthroughHorizontalSwipe?: boolean
  className?: string
}

type FramePhotoSlotProps = {
  imageName: string
  aspectWidth: number
  aspectHeight: number
  label: string
  photoUrl: string | null
  pan: ImagePan
  fit: ImageFit
  transparent?: boolean
  onPanChange?: (pan: ImagePan) => void
  onFitChange?: (fit: ImageFit) => void
  onSelect?: (file: File) => void
  onPick?: () => void
  onRemove?: () => void
  onToggleTransparent?: () => void
  passthroughHorizontalSwipe?: boolean
  radius?: CSSProperties
}

function isImageFile(file: File | undefined): file is File {
  return Boolean(file?.type.startsWith("image/"))
}

function FramePhotoSlot({
  imageName,
  aspectWidth,
  aspectHeight,
  label,
  photoUrl,
  pan,
  fit,
  transparent = false,
  onPanChange,
  onFitChange,
  onSelect,
  onPick,
  onRemove,
  onToggleTransparent,
  passthroughHorizontalSwipe,
  radius,
}: FramePhotoSlotProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDropTarget, setIsDropTarget] = useState(false)
  const showBackground = transparent && !photoUrl

  function handleFiles(files: FileList | null) {
    const file = files?.[0]
    if (!isImageFile(file) || !onSelect) {
      return
    }

    onSelect(file)
  }

  return (
    <div
      className={cn(
        "pointer-events-auto relative w-full shrink-0 overflow-hidden",
        photoUrl || showBackground ? "bg-transparent" : "bg-neutral-100",
        isDropTarget && "ring-2 ring-neutral-900/30 ring-inset"
      )}
      data-name={imageName}
      style={{
        aspectRatio: `${aspectWidth} / ${aspectHeight}`,
        ...radius,
      }}
      onDragOver={(event) => {
        if (!onSelect) {
          return
        }
        event.preventDefault()
        setIsDropTarget(true)
      }}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget
        if (
          nextTarget instanceof Node &&
          event.currentTarget.contains(nextTarget)
        ) {
          return
        }
        setIsDropTarget(false)
      }}
      onDrop={(event) => {
        if (!onSelect) {
          return
        }
        event.preventDefault()
        setIsDropTarget(false)
        handleFiles(event.dataTransfer.files)
      }}
    >
      {onSelect ? (
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files)
            event.target.value = ""
          }}
        />
      ) : null}
      {photoUrl ? (
        <>
          <PannablePhoto
            src={photoUrl}
            pan={pan}
            fit={fit}
            onPanChange={onPanChange}
            onClick={
              onFitChange
                ? () => {
                    onFitChange(toggleImageFit(fit))
                  }
                : undefined
            }
            passthroughHorizontalSwipe={passthroughHorizontalSwipe}
          />
          {onRemove ? (
            <Button
              type="button"
              variant="secondary"
              size="icon-xs"
              className="absolute top-2 right-2 z-10 shadow-sm"
              aria-label={`Remove ${label}`}
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.stopPropagation()
                onRemove()
              }}
            >
              <X />
            </Button>
          ) : null}
        </>
      ) : onSelect || onPick ? (
        <>
          {onPick ? (
            <button
              type="button"
              className="flex size-full cursor-pointer items-center justify-center text-muted-foreground"
              onClick={onPick}
            >
              <span className="sr-only">Add {label}</span>
              {showBackground ? null : <ImagePlus className="size-6" />}
            </button>
          ) : (
            <label
              htmlFor={inputId}
              className="flex size-full cursor-pointer items-center justify-center text-muted-foreground"
            >
              <span className="sr-only">Add {label}</span>
              {showBackground ? null : <ImagePlus className="size-6" />}
            </label>
          )}
          {onToggleTransparent ? (
            <Button
              type="button"
              variant={showBackground ? "default" : "secondary"}
              size="icon-xs"
              className="absolute top-2 left-2 z-10 shadow-sm"
              aria-pressed={showBackground}
              aria-label={
                showBackground
                  ? `Hide background in ${label}`
                  : `Show background in ${label}`
              }
              title={showBackground ? "Show photo slot" : "Show background"}
              onPointerDown={(event) => {
                event.stopPropagation()
              }}
              onClick={(event) => {
                event.stopPropagation()
                onToggleTransparent()
              }}
            >
              <EyeDashed />
            </Button>
          ) : null}
        </>
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImagePlus className="size-6" />
        </div>
      )}
    </div>
  )
}

export function CollectionFrame({
  design,
  photoUrls,
  pans,
  fits,
  transparentSlots,
  backgroundImageUrl,
  backgroundPan = DEFAULT_IMAGE_PAN,
  onPanChange,
  onFitChange,
  onBackgroundPanChange,
  onPhotoSelect,
  onPhotoPick,
  onPhotoRemove,
  onToggleTransparent,
  passthroughHorizontalSwipe,
  className,
}: CollectionFrameProps) {
  const paddingTouchesEdge =
    design.padding.top === 0 &&
    design.padding.right === 0 &&
    design.padding.bottom === 0 &&
    design.padding.left === 0
  const gapPercent =
    design.gap === 0
      ? 0
      : (design.gap /
          Math.max(
            design.height - design.padding.top - design.padding.bottom,
            1
          )) *
        100
  const frameStyle: CSSProperties = {
    display: design.layout.display,
    flexDirection: design.layout.flexDirection,
    alignItems: design.layout.alignItems,
    justifyContent: design.layout.justifyContent,
    alignContent: design.layout.alignContent,
    paddingTop: `${(design.padding.top / design.width) * 100}%`,
    paddingRight: `${(design.padding.right / design.width) * 100}%`,
    paddingBottom: `${(design.padding.bottom / design.width) * 100}%`,
    paddingLeft: `${(design.padding.left / design.width) * 100}%`,
    gap: paddingTouchesEdge ? 0 : `${gapPercent}%`,
  }

  return (
    <div
      className={cn(
        "overflow-hidden border-0 shadow-none ring-0 outline-hidden",
        className
      )}
      style={{
        aspectRatio: `${design.width} / ${design.height}`,
        borderRadius: FRAME_RADIUS,
      }}
    >
      <div className="relative size-full overflow-hidden rounded-[inherit]">
        {paddingTouchesEdge && !backgroundImageUrl ? null : (
          <div
            className="absolute inset-0 rounded-[inherit]"
            style={{ backgroundColor: design.background }}
          />
        )}
        {backgroundImageUrl ? (
          <div className="absolute inset-0 overflow-hidden rounded-[inherit]">
            <PannablePhoto
              src={backgroundImageUrl}
              pan={backgroundPan}
              label="Background"
              onPanChange={onBackgroundPanChange}
              passthroughHorizontalSwipe={passthroughHorizontalSwipe}
            />
          </div>
        ) : null}
        <div
          className="pointer-events-none relative size-full"
          data-name="Frame"
          style={frameStyle}
        >
          {design.images.map((image, index) => (
            <Fragment key={image.id}>
              {index > 0 && paddingTouchesEdge && gapPercent > 0 ? (
                <div
                  className="w-full shrink-0"
                  style={{
                    height: `${gapPercent}%`,
                    backgroundColor: backgroundImageUrl
                      ? "transparent"
                      : design.background,
                  }}
                />
              ) : null}
              <FramePhotoSlot
                imageName={image.name}
                aspectWidth={image.aspectWidth}
                aspectHeight={image.aspectHeight}
                label={slotLabel(index, design.images.length)}
                photoUrl={photoUrls[index] ?? null}
                pan={pans?.[index] ?? DEFAULT_IMAGE_PAN}
                fit={fits?.[index] ?? DEFAULT_IMAGE_FIT}
                transparent={transparentSlots?.[index] ?? false}
                passthroughHorizontalSwipe={passthroughHorizontalSwipe}
                radius={slotCornerRadius(
                  index,
                  design.images.length - 1,
                  design.padding
                )}
                onPanChange={
                  onPanChange
                    ? (pan) => {
                        onPanChange(index, pan)
                      }
                    : undefined
                }
                onFitChange={
                  onFitChange
                    ? (nextFit) => {
                        onFitChange(index, nextFit)
                      }
                    : undefined
                }
                onSelect={
                  onPhotoSelect
                    ? (file) => {
                        onPhotoSelect(index, file)
                      }
                    : undefined
                }
                onPick={
                  onPhotoPick
                    ? () => {
                        onPhotoPick(index)
                      }
                    : undefined
                }
                onRemove={
                  onPhotoRemove
                    ? () => {
                        onPhotoRemove(index)
                      }
                    : undefined
                }
                onToggleTransparent={
                  onToggleTransparent
                    ? () => {
                        onToggleTransparent(index)
                      }
                    : undefined
                }
              />
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}
