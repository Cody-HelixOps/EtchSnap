export interface ContentBounds {
  x: number
  y: number
  width: number
  height: number
}

export function getContentBounds(
  imageData: ImageData,
  alphaThreshold = 16,
): ContentBounds | null {
  const { width, height, data } = imageData
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha > alphaThreshold) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (maxX < minX || maxY < minY) return null

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  }
}

export function cropImageData(
  imageData: ImageData,
  bounds: ContentBounds,
  padding = 0,
): ImageData {
  const x = Math.max(0, bounds.x - padding)
  const y = Math.max(0, bounds.y - padding)
  const right = Math.min(imageData.width, bounds.x + bounds.width + padding)
  const bottom = Math.min(imageData.height, bounds.y + bounds.height + padding)
  const width = Math.max(1, right - x)
  const height = Math.max(1, bottom - y)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context')

  ctx.putImageData(imageData, -x, -y)
  return ctx.getImageData(0, 0, width, height)
}

export function trimImageData(imageData: ImageData, padding = 4): ImageData {
  const bounds = getContentBounds(imageData)
  if (!bounds) return imageData
  return cropImageData(imageData, bounds, padding)
}

export function imageDataToDataUrl(imageData: ImageData): string {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context')

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

export async function loadImageDataFromDataUrl(
  dataUrl: string,
): Promise<ImageData> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = dataUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context')

  ctx.drawImage(image, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}
