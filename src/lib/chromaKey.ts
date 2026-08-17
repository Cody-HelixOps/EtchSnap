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

const HARD_KEY_DISTANCE = 48
const SOFT_KEY_DISTANCE = 88

function chromaDistance(r: number, g: number, b: number): number {
  return Math.hypot(r - CHROMA_KEY.r, g - CHROMA_KEY.g, b - CHROMA_KEY.b)
}

function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}

export function isMagentaFamily(r: number, g: number, b: number): boolean {
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  return r >= 160 && g <= 95 && b >= 70 && r - g >= 80 && sat >= 70
}

export function isChromaKeyColor(
  r: number,
  g: number,
  b: number,
  threshold = SOFT_KEY_DISTANCE,
): boolean {
  return chromaDistance(r, g, b) <= threshold || isMagentaFamily(r, g, b)
}

function keyPixels(
  image: PixelImage,
  matches: (r: number, g: number, b: number) => number | null,
): number {
  const { data } = image
  let cleared = 0

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) {
      data[i + 3] = 0
      continue
    }

    const alpha = matches(data[i], data[i + 1], data[i + 2])
    if (alpha === null) continue
    if (alpha <= 0) {
      data[i + 3] = 0
      cleared += 1
      continue
    }

    data[i + 3] = Math.round(data[i + 3] * alpha)
    if (data[i + 3] < 16) {
      data[i + 3] = 0
      cleared += 1
    }
  }

  return cleared
}

export function removeChromaKey(image: PixelImage): number {
  return keyPixels(image, (r, g, b) => {
    if (isMagentaFamily(r, g, b)) return 0
    const distance = chromaDistance(r, g, b)
    if (distance <= HARD_KEY_DISTANCE) return 0
    if (distance < SOFT_KEY_DISTANCE) {
      return (distance - HARD_KEY_DISTANCE) / (SOFT_KEY_DISTANCE - HARD_KEY_DISTANCE)
    }
    return null
  })
}

export function detectCornerKeyColor(
  image: PixelImage,
): { r: number; g: number; b: number } | null {
  const { data, width, height } = image
  const samples = [
    [2, 2],
    [width - 3, 2],
    [2, height - 3],
    [width - 3, height - 3],
    [Math.floor(width / 2), 2],
    [Math.floor(width / 2), height - 3],
    [2, Math.floor(height / 2)],
    [width - 3, Math.floor(height / 2)],
  ]

  const colors: Array<[number, number, number]> = []
  for (const [x, y] of samples) {
    const i = (y * width + x) * 4
    if (data[i + 3] < 16) continue
    colors.push([data[i], data[i + 1], data[i + 2]])
  }

  if (colors.length < 4) return null

  for (let i = 1; i < colors.length; i += 1) {
    if (colorDistance(colors[0][0], colors[0][1], colors[0][2], colors[i][0], colors[i][1], colors[i][2]) > 36) {
      return null
    }
  }

  const key = {
    r: Math.round(colors.reduce((sum, color) => sum + color[0], 0) / colors.length),
    g: Math.round(colors.reduce((sum, color) => sum + color[1], 0) / colors.length),
    b: Math.round(colors.reduce((sum, color) => sum + color[2], 0) / colors.length),
  }

  const sat = Math.max(key.r, key.g, key.b) - Math.min(key.r, key.g, key.b)
  if (sat < 50) return null

  const lime = key.g >= 160 && key.r <= 90 && key.b <= 90
  const cyan = key.g >= 140 && key.b >= 140 && key.r <= 80
  if (!isMagentaFamily(key.r, key.g, key.b) && !lime && !cyan) return null
  return key
}

export function removeDetectedSolidBackground(image: PixelImage): number {
  const key = detectCornerKeyColor(image)
  if (!key) return 0

  return keyPixels(image, (r, g, b) => {
    const distance = colorDistance(r, g, b, key.r, key.g, key.b)
    if (distance <= 42) return 0
    if (distance < 70) return (distance - 42) / 28
    return null
  })
}
