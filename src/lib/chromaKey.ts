interface PixelImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

export const CHROMA_KEY = {
  r: 255,
  g: 0,
  b: 255,
  hex: '#FF00FF',
} as const

const HARD_KEY_DISTANCE = 42
const SOFT_KEY_DISTANCE = 78

function chromaDistance(r: number, g: number, b: number): number {
  return Math.hypot(r - CHROMA_KEY.r, g - CHROMA_KEY.g, b - CHROMA_KEY.b)
}

function unmixKey(r: number, g: number, b: number, alpha: number): [number, number, number] {
  if (alpha <= 0) return [0, 0, 0]
  const keyed = 1 - alpha
  return [
    Math.min(255, Math.max(0, (r - CHROMA_KEY.r * keyed) / alpha)),
    Math.min(255, Math.max(0, (g - CHROMA_KEY.g * keyed) / alpha)),
    Math.min(255, Math.max(0, (b - CHROMA_KEY.b * keyed) / alpha)),
  ]
}

export function removeChromaKey(image: PixelImage): number {
  const { data } = image
  let cleared = 0

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) {
      data[i + 3] = 0
      continue
    }

    const distance = chromaDistance(data[i], data[i + 1], data[i + 2])
    if (distance <= HARD_KEY_DISTANCE) {
      data[i + 3] = 0
      cleared += 1
      continue
    }

    if (distance < SOFT_KEY_DISTANCE) {
      const alpha = (distance - HARD_KEY_DISTANCE) / (SOFT_KEY_DISTANCE - HARD_KEY_DISTANCE)
      const [r, g, b] = unmixKey(data[i], data[i + 1], data[i + 2], alpha)
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = Math.round(data[i + 3] * alpha)
      if (data[i + 3] < 16) {
        data[i + 3] = 0
        cleared += 1
      }
    }
  }

  return cleared
}
