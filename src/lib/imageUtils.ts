import type { OutputMode, Point, SelectionPath } from '../types'
import { removeFrameBorder, stripOuterEdgePixels } from './borderRemoval'
import { imageDataToDataUrl, trimImageData } from './trimUtils'

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

export function getPathBounds(points: Point[]) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const maxX = Math.max(...xs)
  const maxY = Math.max(...ys)

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

export function cropPathToBase64(
  image: HTMLImageElement,
  path: SelectionPath,
  displayWidth: number,
  displayHeight: number,
): { base64: string; mimeType: string } {
  const scaleX = image.naturalWidth / displayWidth
  const scaleY = image.naturalHeight / displayHeight

  const scaledPoints = path.points.map((point) => ({
    x: point.x * scaleX,
    y: point.y * scaleY,
  }))

  const bounds = getPathBounds(scaledPoints)
  const sw = Math.max(1, Math.ceil(bounds.width))
  const sh = Math.max(1, Math.ceil(bounds.height))

  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context')

  ctx.beginPath()
  scaledPoints.forEach((point, index) => {
    const x = point.x - bounds.x
    const y = point.y - bounds.y
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.closePath()
  ctx.clip()

  ctx.drawImage(image, bounds.x, bounds.y, sw, sh, 0, 0, sw, sh)

  const dataUrl = canvas.toDataURL('image/png')
  const [, base64] = dataUrl.split(',')
  return { base64, mimeType: 'image/png' }
}

export function base64ToDataUrl(base64: string, mimeType = 'image/png'): string {
  return `data:${mimeType};base64,${base64}`
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

export function downloadText(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function postProcessDesign(
  base64: string,
  mode: OutputMode,
): Promise<string> {
  const img = await loadImageFromBase64(base64)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context')

  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  for (let pass = 0; pass < 3; pass += 1) {
    if (!removeFrameBorder(imageData)) break
  }
  stripOuterEdgePixels(imageData, 2)

  const { data } = imageData

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]

    if (a < 16) {
      data[i + 3] = 0
      continue
    }

    const luminance = 0.299 * r + 0.587 * g + 0.114 * b

    if (luminance > 245 && a < 220) {
      data[i + 3] = 0
      continue
    }

    if (mode === 'laser') {
      const ink = luminance < 140 ? 0 : 255
      data[i] = ink
      data[i + 1] = ink
      data[i + 2] = ink
      data[i + 3] = ink === 255 ? 0 : 255
    }
  }

  ctx.putImageData(imageData, 0, 0)
  const trimmed = trimImageData(
    ctx.getImageData(0, 0, canvas.width, canvas.height),
    4,
  )
  return imageDataToDataUrl(trimmed)
}

function loadImageFromBase64(base64: string): Promise<HTMLImageElement> {
  return loadImageFromDataUrl(base64ToDataUrl(base64))
}

export function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to decode image'))
    img.src = dataUrl
  })
}
