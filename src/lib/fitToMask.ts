import { CHROMA_KEY } from './chromaKey.ts'
import type { PixelImage } from './isolateArtwork.ts'

const MASK_ALPHA = 16

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

export function createSilhouetteReference(mask: PixelImage): PixelImage {
  const data = new Uint8ClampedArray(mask.data.length)

  for (let i = 0; i < mask.data.length; i += 4) {
    if (mask.data[i + 3] > MASK_ALPHA) {
      data[i] = 255
      data[i + 1] = 255
      data[i + 2] = 255
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

export function fitDesignToMask(design: PixelImage, mask: PixelImage): PixelImage {
  const out = {
    data: new Uint8ClampedArray(mask.width * mask.height * 4),
    width: mask.width,
    height: mask.height,
  }

  const scale = Math.max(mask.width / Math.max(design.width, 1), mask.height / Math.max(design.height, 1))
  const srcWidth = mask.width / scale
  const srcHeight = mask.height / scale
  const srcX = (design.width - srcWidth) / 2
  const srcY = (design.height - srcHeight) / 2

  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      const index = (y * mask.width + x) * 4
      const maskAlpha = mask.data[index + 3]
      if (maskAlpha <= MASK_ALPHA) continue

      const [r, g, b, a] = sampleBilinear(design, srcX + (x + 0.5) / scale - 0.5, srcY + (y + 0.5) / scale - 0.5)
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
