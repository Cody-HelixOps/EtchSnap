import { CHROMA_KEY } from './chromaKey.ts'
import type { PixelImage } from './isolateArtwork.ts'

const MASK_ALPHA = 16
const BLANK_FILL = 250
export const TEMPLATE_CONTENT_SCALE = 0.66

export interface TemplateLayout {
  offsetX: number
  offsetY: number
  contentWidth: number
  contentHeight: number
  canvasWidth: number
  canvasHeight: number
}

function sampleBilinear(image: PixelImage, x: number, y: number): [number, number, number, number] {
  const maxX = image.width - 1
  const maxY = image.height - 1
  const x0 = Math.max(0, Math.min(maxX, Math.floor(x)))
  const y0 = Math.max(0, Math.min(maxY, Math.floor(y)))
  const x1 = Math.min(maxX, x0 + 1)
  const y1 = Math.min(maxY, y0 + 1)
  const tx = x - x0
  const ty = y - y0

  const i00 = (y0 * image.width + x0) * 4
  const i10 = (y0 * image.width + x1) * 4
  const i01 = (y1 * image.width + x0) * 4
  const i11 = (y1 * image.width + x1) * 4
  const { data } = image

  const mix = (a: number, b: number, t: number) => a + (b - a) * t
  const channel = (offset: number) =>
    mix(
      mix(data[i00 + offset], data[i10 + offset], tx),
      mix(data[i01 + offset], data[i11 + offset], tx),
      ty,
    )

  return [channel(0), channel(1), channel(2), channel(3)]
}

function fillMagenta(image: PixelImage): void {
  for (let i = 0; i < image.data.length; i += 4) {
    image.data[i] = CHROMA_KEY.r
    image.data[i + 1] = CHROMA_KEY.g
    image.data[i + 2] = CHROMA_KEY.b
    image.data[i + 3] = 255
  }
}

export function createSilhouetteReference(mask: PixelImage): PixelImage {
  const data = new Uint8ClampedArray(mask.data.length)

  for (let i = 0; i < mask.data.length; i += 4) {
    if (mask.data[i + 3] > MASK_ALPHA) {
      data[i] = BLANK_FILL
      data[i + 1] = BLANK_FILL
      data[i + 2] = BLANK_FILL
      data[i + 3] = 255
    } else {
      data[i] = CHROMA_KEY.r
      data[i + 1] = CHROMA_KEY.g
      data[i + 2] = CHROMA_KEY.b
      data[i + 3] = 255
    }
  }

  return { data, width: mask.width, height: mask.height }
}

export function layoutBlankTemplate(
  contentWidth: number,
  contentHeight: number,
  aspectRatio: number,
): TemplateLayout {
  const minWidth = Math.max(1, Math.ceil(contentWidth / TEMPLATE_CONTENT_SCALE))
  const minHeight = Math.max(1, Math.ceil(contentHeight / TEMPLATE_CONTENT_SCALE))
  let canvasWidth = minWidth
  let canvasHeight = minHeight
  const safeAspect = Math.max(aspectRatio, 0.05)

  if (canvasWidth / canvasHeight > safeAspect) {
    canvasHeight = Math.max(minHeight, Math.round(canvasWidth / safeAspect))
  } else {
    canvasWidth = Math.max(minWidth, Math.round(canvasHeight * safeAspect))
  }

  return {
    offsetX: Math.floor((canvasWidth - contentWidth) / 2),
    offsetY: Math.floor((canvasHeight - contentHeight) / 2),
    contentWidth,
    contentHeight,
    canvasWidth,
    canvasHeight,
  }
}

export function createBlankTemplate(mask: PixelImage, aspectRatio: number): {
  image: PixelImage
  layout: TemplateLayout
} {
  const layout = layoutBlankTemplate(mask.width, mask.height, aspectRatio)
  const image: PixelImage = {
    data: new Uint8ClampedArray(layout.canvasWidth * layout.canvasHeight * 4),
    width: layout.canvasWidth,
    height: layout.canvasHeight,
  }
  fillMagenta(image)

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if (mask.data[(y * mask.width + x) * 4 + 3] <= MASK_ALPHA) continue
      const dest = ((y + layout.offsetY) * layout.canvasWidth + (x + layout.offsetX)) * 4
      image.data[dest] = BLANK_FILL
      image.data[dest + 1] = BLANK_FILL
      image.data[dest + 2] = BLANK_FILL
      image.data[dest + 3] = 255
    }
  }

  return { image, layout }
}

export function mapGeneratedFromTemplate(
  generated: PixelImage,
  mask: PixelImage,
  layout: TemplateLayout,
): PixelImage {
  const out = {
    data: new Uint8ClampedArray(mask.width * mask.height * 4),
    width: mask.width,
    height: mask.height,
  }

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      const index = (y * mask.width + x) * 4
      const maskAlpha = mask.data[index + 3]
      if (maskAlpha <= MASK_ALPHA) continue

      const [r, g, b, a] = sampleBilinear(
        generated,
        ((layout.offsetX + x + 0.5) / layout.canvasWidth) * generated.width - 0.5,
        ((layout.offsetY + y + 0.5) / layout.canvasHeight) * generated.height - 0.5,
      )
      const alpha = Math.min(a, maskAlpha)
      if (alpha <= MASK_ALPHA) continue

      out.data[index] = r
      out.data[index + 1] = g
      out.data[index + 2] = b
      out.data[index + 3] = alpha
    }
  }

  return out
}

export function fitDesignToMask(
  design: PixelImage,
  mask: PixelImage,
  aspectRatio: number,
): PixelImage {
  const layout = layoutBlankTemplate(mask.width, mask.height, aspectRatio)
  return mapGeneratedFromTemplate(design, mask, layout)
}
