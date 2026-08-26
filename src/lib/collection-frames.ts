import { STORY_HEIGHT, STORY_WIDTH } from "@/lib/frames"

export type CollectionFrameImage = {
  id: string
  name: "Image"
  /** Figma fill aspect ratio as width / height. */
  aspectWidth: number
  aspectHeight: number
}

export type CollectionFramePadding = {
  top: number
  right: number
  bottom: number
  left: number
}

export type CollectionFrameDesign = {
  id: string
  name: string
  width: number
  height: number
  background: string
  padding: CollectionFramePadding
  gap: number
  layout: {
    display: "flex"
    flexDirection: "column"
    alignItems: "center"
    justifyContent: "center"
    alignContent: "stretch"
  }
  images: CollectionFrameImage[]
}

export type FrameSlotRect = {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export function getFrameSlotRects(
  design: CollectionFrameDesign
): FrameSlotRect[] {
  const contentWidth = design.width - design.padding.left - design.padding.right
  const contentHeight =
    design.height - design.padding.top - design.padding.bottom
  const heights = design.images.map(
    (image) => contentWidth * (image.aspectHeight / image.aspectWidth)
  )
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    design.gap * Math.max(0, design.images.length - 1)
  let y = design.padding.top + Math.max(0, contentHeight - totalHeight) / 2
  const x = design.padding.left

  return design.images.map((image, index) => {
    const height = heights[index] ?? 0
    const rect = { id: image.id, x, y, width: contentWidth, height }
    y += height + design.gap
    return rect
  })
}

export function uniformPadding(value: number): CollectionFramePadding {
  return { top: value, right: value, bottom: value, left: value }
}

export function frameUsesGap(design: Pick<CollectionFrameDesign, "images">) {
  return design.images.length > 1
}

/**
 * Frame designs from Figma, with layout values taken from the file:
 * https://www.figma.com/design/fQGB1Eg8BqrhxKkxk7zVDo/Frames
 */
export const collectionFrames: CollectionFrameDesign[] = [
  {
    id: "portrait",
    name: "Portrait",
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    background: "#ffffff",
    padding: uniformPadding(80),
    gap: 0,
    layout: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      alignContent: "stretch",
    },
    images: [
      {
        id: "3:13",
        name: "Image",
        aspectWidth: 2723,
        aspectHeight: 4096,
      },
    ],
  },
  {
    id: "stack",
    name: "Stack",
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    background: "#ffffff",
    padding: uniformPadding(80),
    gap: 80,
    layout: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      alignContent: "stretch",
    },
    images: [
      {
        id: "3:26",
        name: "Image",
        aspectWidth: 4096,
        aspectHeight: 2731,
      },
      {
        id: "3:31",
        name: "Image",
        aspectWidth: 4096,
        aspectHeight: 2730,
      },
    ],
  },
  {
    id: "strip",
    name: "Strip",
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
    background: "#ffffff",
    padding: uniformPadding(0),
    gap: 0,
    layout: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      alignContent: "stretch",
    },
    images: [
      {
        id: "3:34",
        name: "Image",
        aspectWidth: 1080,
        aspectHeight: 640,
      },
      {
        id: "3:37",
        name: "Image",
        aspectWidth: 1080,
        aspectHeight: 640,
      },
      {
        id: "3:35",
        name: "Image",
        aspectWidth: 1080,
        aspectHeight: 640,
      },
    ],
  },
]

export const DEFAULT_COLLECTION_FRAME_ID = collectionFrames[0].id

export function getCollectionFrame(id: string): CollectionFrameDesign {
  return (
    collectionFrames.find((frame) => frame.id === id) ?? collectionFrames[0]
  )
}

export function slotLabel(index: number, total: number) {
  if (total <= 1) {
    return "Photo"
  }

  return `Photo ${index + 1}`
}
