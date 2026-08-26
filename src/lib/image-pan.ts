export type ImagePan = {
  x: number
  y: number
}

export type ImageFit = "width" | "height"

export const DEFAULT_IMAGE_PAN: ImagePan = { x: 0.5, y: 0.5 }
export const DEFAULT_IMAGE_FIT: ImageFit = "width"

export function isImageFit(value: unknown): value is ImageFit {
  return value === "width" || value === "height"
}

export function coverFit(
  imageWidth: number,
  imageHeight: number,
  slotWidth: number,
  slotHeight: number
): ImageFit {
  if (
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    slotWidth <= 0 ||
    slotHeight <= 0
  ) {
    return DEFAULT_IMAGE_FIT
  }

  return slotWidth / imageWidth >= slotHeight / imageHeight ? "width" : "height"
}

export function toggleImageFit(fit: ImageFit): ImageFit {
  return fit === "width" ? "height" : "width"
}

export function clamp01(value: number) {
  return Math.min(Math.max(value, 0), 1)
}

export function clampPan(pan: ImagePan): ImagePan {
  return {
    x: clamp01(pan.x),
    y: clamp01(pan.y),
  }
}

export function pansEqual(a: ImagePan, b: ImagePan) {
  return a.x === b.x && a.y === b.y
}

export function getCoverOverflow(
  imageWidth: number,
  imageHeight: number,
  slotWidth: number,
  slotHeight: number
) {
  if (
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    slotWidth <= 0 ||
    slotHeight <= 0
  ) {
    return { overflowX: 0, overflowY: 0 }
  }

  const scale = Math.max(slotWidth / imageWidth, slotHeight / imageHeight)

  return {
    overflowX: Math.max(imageWidth * scale - slotWidth, 0),
    overflowY: Math.max(imageHeight * scale - slotHeight, 0),
  }
}

export function getFitOverflow(
  imageWidth: number,
  imageHeight: number,
  slotWidth: number,
  slotHeight: number,
  fit: ImageFit
) {
  if (
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    slotWidth <= 0 ||
    slotHeight <= 0
  ) {
    return { overflowX: 0, overflowY: 0 }
  }

  if (fit === "width") {
    return {
      overflowX: 0,
      overflowY: Math.max(
        imageHeight * (slotWidth / imageWidth) - slotHeight,
        0
      ),
    }
  }

  return {
    overflowX: Math.max(imageWidth * (slotHeight / imageHeight) - slotWidth, 0),
    overflowY: 0,
  }
}

export function fitImageStyle(
  fit: ImageFit,
  pan: ImagePan,
  overflowX: number,
  overflowY: number
) {
  const clamped = clampPan(pan)

  if (fit === "width") {
    return {
      width: "100%",
      height: "auto",
      left: 0,
      top: overflowY > 0 ? -overflowY * clamped.y : "50%",
      transform: overflowY > 0 ? undefined : "translateY(-50%)",
    }
  }

  return {
    height: "100%",
    width: "auto",
    top: 0,
    left: overflowX > 0 ? -overflowX * clamped.x : "50%",
    transform: overflowX > 0 ? undefined : "translateX(-50%)",
  }
}

export function panFromPointerDelta(
  start: ImagePan,
  dx: number,
  dy: number,
  overflowX: number,
  overflowY: number
): ImagePan {
  return clampPan({
    x: overflowX > 0 ? start.x - dx / overflowX : start.x,
    y: overflowY > 0 ? start.y - dy / overflowY : start.y,
  })
}

export function getCoverSourceRect(
  imageWidth: number,
  imageHeight: number,
  destWidth: number,
  destHeight: number,
  pan: ImagePan = DEFAULT_IMAGE_PAN
) {
  const scale = Math.max(destWidth / imageWidth, destHeight / imageHeight)
  const sourceWidth = destWidth / scale
  const sourceHeight = destHeight / scale
  const clamped = clampPan(pan)

  return {
    sourceX: Math.max(imageWidth - sourceWidth, 0) * clamped.x,
    sourceY: Math.max(imageHeight - sourceHeight, 0) * clamped.y,
    sourceWidth,
    sourceHeight,
  }
}

export function objectPosition(pan: ImagePan) {
  const clamped = clampPan(pan)
  return `${clamped.x * 100}% ${clamped.y * 100}%`
}
