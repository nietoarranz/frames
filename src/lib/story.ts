export type ImageRect = {
  x: number
  y: number
  width: number
  height: number
}

export async function loadImage(src: string): Promise<HTMLImageElement> {
  const image = new Image()
  image.src = src
  await image.decode()
  return image
}

export function fallbackDownload(imageUrl: string, filename: string) {
  const link = document.createElement("a")
  link.href = imageUrl
  link.download = filename
  link.click()
}

export async function shareFile(file: File, fallbackUrl: string) {
  if (typeof navigator.share !== "function") {
    fallbackDownload(fallbackUrl, file.name)
    return
  }

  try {
    await navigator.share({ files: [file] })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return
    }
  }
}

export async function shareImage(imageUrl: string, filename = "image.png") {
  const response = await fetch(imageUrl)
  const blob = await response.blob()
  const file = new File([blob], filename, { type: blob.type })
  await shareFile(file, imageUrl)
}
