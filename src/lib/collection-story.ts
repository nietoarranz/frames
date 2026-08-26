import type { CollectionFrameDesign } from "@/lib/collection-frames"
import {
  DEFAULT_IMAGE_PAN,
  clampPan,
  coverFit,
  getCoverSourceRect,
  type ImageFit,
  type ImagePan,
} from "@/lib/image-pan"
import type { ImageRect } from "@/lib/story"

export type CollectionSlotPhoto = {
  file: File
  image: CanvasImageSource
  imageWidth: number
  imageHeight: number
  pan?: ImagePan
  fit?: ImageFit
}

export type CollectionBackgroundImage = {
  image: CanvasImageSource
  imageWidth: number
  imageHeight: number
  pan?: ImagePan
}

export function getCollectionSlotRects(
  design: CollectionFrameDesign
): ImageRect[] {
  const contentWidth = Math.max(
    design.width - design.padding.left - design.padding.right,
    1
  )
  const heights = design.images.map(
    (image) => (contentWidth * image.aspectHeight) / image.aspectWidth
  )
  const stackedHeight =
    heights.reduce((total, height) => total + height, 0) +
    design.gap * Math.max(design.images.length - 1, 0)
  const extra =
    design.height - design.padding.top - design.padding.bottom - stackedHeight

  let y = design.padding.top + extra / 2

  return heights.map((height) => {
    const rect = {
      x: design.padding.left,
      y,
      width: contentWidth,
      height,
    }
    y += height + design.gap
    return rect
  })
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  rect: ImageRect,
  pan: ImagePan = DEFAULT_IMAGE_PAN
) {
  const source = getCoverSourceRect(
    imageWidth,
    imageHeight,
    rect.width,
    rect.height,
    pan
  )

  ctx.drawImage(
    image,
    source.sourceX,
    source.sourceY,
    source.sourceWidth,
    source.sourceHeight,
    rect.x,
    rect.y,
    rect.width,
    rect.height
  )
}

function drawImageFit(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  rect: ImageRect,
  pan: ImagePan = DEFAULT_IMAGE_PAN,
  fit: ImageFit
) {
  const clamped = clampPan(pan)

  if (fit === "width") {
    const scale = rect.width / imageWidth
    const destHeight = imageHeight * scale

    if (destHeight >= rect.height) {
      const sourceHeight = rect.height / scale
      ctx.drawImage(
        image,
        0,
        Math.max(imageHeight - sourceHeight, 0) * clamped.y,
        imageWidth,
        sourceHeight,
        rect.x,
        rect.y,
        rect.width,
        rect.height
      )
      return
    }

    ctx.drawImage(
      image,
      0,
      0,
      imageWidth,
      imageHeight,
      rect.x,
      rect.y + (rect.height - destHeight) / 2,
      rect.width,
      destHeight
    )
    return
  }

  const scale = rect.height / imageHeight
  const destWidth = imageWidth * scale

  if (destWidth >= rect.width) {
    const sourceWidth = rect.width / scale
    ctx.drawImage(
      image,
      Math.max(imageWidth - sourceWidth, 0) * clamped.x,
      0,
      sourceWidth,
      imageHeight,
      rect.x,
      rect.y,
      rect.width,
      rect.height
    )
    return
  }

  ctx.drawImage(
    image,
    0,
    0,
    imageWidth,
    imageHeight,
    rect.x + (rect.width - destWidth) / 2,
    rect.y,
    destWidth,
    rect.height
  )
}

export function drawCollectionStory(
  ctx: CanvasRenderingContext2D,
  design: CollectionFrameDesign,
  photos: Array<CollectionSlotPhoto | null>,
  backgroundImage?: CollectionBackgroundImage | null
) {
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, design.width, design.height)
  ctx.fillStyle = design.background
  ctx.fillRect(0, 0, design.width, design.height)

  if (backgroundImage) {
    drawImageCover(
      ctx,
      backgroundImage.image,
      backgroundImage.imageWidth,
      backgroundImage.imageHeight,
      {
        x: 0,
        y: 0,
        width: design.width,
        height: design.height,
      },
      backgroundImage.pan
    )
  }

  const rects = getCollectionSlotRects(design)

  photos.forEach((photo, index) => {
    const rect = rects[index]
    if (!photo || !rect) {
      return
    }

    drawImageFit(
      ctx,
      photo.image,
      photo.imageWidth,
      photo.imageHeight,
      rect,
      photo.pan,
      photo.fit ??
        coverFit(photo.imageWidth, photo.imageHeight, rect.width, rect.height)
    )
  })

  ctx.restore()
}

export async function composeCollectionStoryBlob(
  design: CollectionFrameDesign,
  photos: Array<CollectionSlotPhoto | null>,
  backgroundImage?: CollectionBackgroundImage | null
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = design.width
  canvas.height = design.height

  const ctx = canvas.getContext("2d")
  if (!ctx) {
    throw new Error("Could not create a 2D canvas context.")
  }

  drawCollectionStory(ctx, design, photos, backgroundImage)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png")
  })

  if (!blob) {
    throw new Error("Could not export the story image.")
  }

  return blob
}
