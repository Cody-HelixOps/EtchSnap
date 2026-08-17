export interface PixelImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

const OPAQUE_ALPHA = 35
const MIN_REMAINING_PIXELS = 180
const MIN_REMAINING_RATIO = 0.06
const SOURCE_CANVAS_MATCH = 0.22
const SOURCE_OPAQUE_MATCH = 0.32

export function countOpaque(image: PixelImage, alphaThreshold = OPAQUE_ALPHA): number {
  const { data } = image
  let count = 0
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > alphaThreshold) count += 1
  }
  return count
}

export function clonePixels(image: PixelImage): PixelImage {
  return {
    data: new Uint8ClampedArray(image.data),
    width: image.width,
    height: image.height,
  }
}

function colorDistance(
  data: Uint8ClampedArray,
  indexA: number,
  indexB: number,
): number {
  return Math.hypot(
    data[indexA] - data[indexB],
    data[indexA + 1] - data[indexB + 1],
    data[indexA + 2] - data[indexB + 2],
  )
}

function colorDistanceRgb(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function floodTolerance(r: number, g: number, b: number): number {
  const lum = luminance(r, g, b)
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  if (lum > 228 && sat < 22) return 50
  if (lum < 22 && sat < 18) return 30
  return 34
}

function remainingIsSafe(originalOpaque: number, remaining: number): boolean {
  if (remaining < MIN_REMAINING_PIXELS) return false
  if (originalOpaque <= 0) return false
  return remaining / originalOpaque >= MIN_REMAINING_RATIO
}

export function resizeNearest(source: PixelImage, width: number, height: number): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(
      source.height - 1,
      Math.floor(((y + 0.5) * source.height) / height),
    )
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(
        source.width - 1,
        Math.floor(((x + 0.5) * source.width) / width),
      )
      const srcIndex = (sourceY * source.width + sourceX) * 4
      const destIndex = (y * width + x) * 4
      data[destIndex] = source.data[srcIndex]
      data[destIndex + 1] = source.data[srcIndex + 1]
      data[destIndex + 2] = source.data[srcIndex + 2]
      data[destIndex + 3] = source.data[srcIndex + 3]
    }
  }
  return { data, width, height }
}

export function containOnto(
  source: PixelImage,
  width: number,
  height: number,
): PixelImage {
  const scale = Math.min(width / source.width, height / source.height)
  const drawWidth = Math.max(1, Math.round(source.width * scale))
  const drawHeight = Math.max(1, Math.round(source.height * scale))
  const resized = resizeNearest(source, drawWidth, drawHeight)
  const data = new Uint8ClampedArray(width * height * 4)
  const offsetX = Math.floor((width - drawWidth) / 2)
  const offsetY = Math.floor((height - drawHeight) / 2)

  for (let y = 0; y < drawHeight; y += 1) {
    for (let x = 0; x < drawWidth; x += 1) {
      const srcIndex = (y * drawWidth + x) * 4
      const destIndex = ((y + offsetY) * width + (x + offsetX)) * 4
      data[destIndex] = resized.data[srcIndex]
      data[destIndex + 1] = resized.data[srcIndex + 1]
      data[destIndex + 2] = resized.data[srcIndex + 2]
      data[destIndex + 3] = resized.data[srcIndex + 3]
    }
  }

  return { data, width, height }
}

function localVariance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  radius = 2,
): number {
  const center = (y * width + x) * 4
  const cr = data[center]
  const cg = data[center + 1]
  const cb = data[center + 2]
  let sum = 0
  let count = 0

  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const index = (ny * width + nx) * 4
      if (data[index + 3] < OPAQUE_ALPHA) continue
      const distance = colorDistanceRgb(cr, cg, cb, data[index], data[index + 1], data[index + 2])
      sum += distance * distance
      count += 1
    }
  }

  return count === 0 ? 0 : sum / count
}

export function subtractSourceLookalike(
  generated: PixelImage,
  source: PixelImage,
  threshold = 38,
): number {
  const aligned = containOnto(source, generated.width, generated.height)
  const generatedData = generated.data
  const sourceData = aligned.data
  let cleared = 0

  for (let i = 0; i < generatedData.length; i += 4) {
    if (generatedData[i + 3] < OPAQUE_ALPHA) continue
    if (sourceData[i + 3] < OPAQUE_ALPHA) continue

    const distance = colorDistanceRgb(
      generatedData[i],
      generatedData[i + 1],
      generatedData[i + 2],
      sourceData[i],
      sourceData[i + 1],
      sourceData[i + 2],
    )
    if (distance > threshold) continue

    const pixelIndex = i / 4
    const x = pixelIndex % generated.width
    const y = Math.floor(pixelIndex / generated.width)
    const variance = localVariance(
      generatedData,
      generated.width,
      generated.height,
      x,
      y,
    )
    if (variance > 220) continue

    generatedData[i + 3] = 0
    cleared += 1
  }

  return cleared
}

function floodSimilar(
  image: PixelImage,
  seeds: number[],
  toleranceFor: (index: number) => number,
): number[] {
  const { data, width, height } = image
  const visited = new Uint8Array(width * height)
  const queue = seeds.filter((index) => {
    if (visited[index]) return false
    visited[index] = 1
    return true
  })
  const flooded: number[] = []
  let head = 0

  while (head < queue.length) {
    const pixelIndex = queue[head]
    head += 1
    flooded.push(pixelIndex)

    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)
    const dataIndex = pixelIndex * 4
    const tolerance = toleranceFor(dataIndex)
    const neighbors = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]

    for (const [dx, dy] of neighbors) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      const neighborIndex = ny * width + nx
      if (visited[neighborIndex]) continue
      const neighborDataIndex = neighborIndex * 4
      if (data[neighborDataIndex + 3] < OPAQUE_ALPHA) continue
      if (colorDistance(data, dataIndex, neighborDataIndex) > tolerance) continue
      visited[neighborIndex] = 1
      queue.push(neighborIndex)
    }
  }

  return flooded
}

function applyFloodIfSafe(image: PixelImage, flooded: number[]): number {
  const originalOpaque = countOpaque(image)
  const remaining = originalOpaque - flooded.length
  if (!remainingIsSafe(originalOpaque, remaining)) return 0

  for (const pixelIndex of flooded) {
    image.data[pixelIndex * 4 + 3] = 0
  }

  return flooded.length
}

export function removeBackgroundFromImageEdges(image: PixelImage): number {
  const { data, width, height } = image
  const seeds: number[] = []

  const maybeSeed = (x: number, y: number) => {
    const pixelIndex = y * width + x
    if (data[pixelIndex * 4 + 3] > OPAQUE_ALPHA) seeds.push(pixelIndex)
  }

  for (let x = 0; x < width; x += 1) {
    maybeSeed(x, 0)
    maybeSeed(x, height - 1)
  }
  for (let y = 1; y < height - 1; y += 1) {
    maybeSeed(0, y)
    maybeSeed(width - 1, y)
  }

  if (seeds.length === 0) return 0

  const flooded = floodSimilar(image, seeds, (index) =>
    floodTolerance(data[index], data[index + 1], data[index + 2]),
  )
  return applyFloodIfSafe(image, flooded)
}

function rimStdDev(image: PixelImage, rim: number[]): number {
  if (rim.length === 0) return Number.POSITIVE_INFINITY
  const { data } = image
  let sum = 0
  for (const pixelIndex of rim) {
    const i = pixelIndex * 4
    sum += luminance(data[i], data[i + 1], data[i + 2])
  }
  const mean = sum / rim.length
  let variance = 0
  for (const pixelIndex of rim) {
    const i = pixelIndex * 4
    const delta = luminance(data[i], data[i + 1], data[i + 2]) - mean
    variance += delta * delta
  }
  return Math.sqrt(variance / rim.length)
}

export function removeObjectPlate(image: PixelImage): number {
  const { data, width, height } = image
  const rim: number[] = []

  const isOpaque = (x: number, y: number) =>
    data[(y * width + x) * 4 + 3] > OPAQUE_ALPHA

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isOpaque(x, y)) continue
      const onBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1
      const touchesTransparent =
        (x > 0 && !isOpaque(x - 1, y)) ||
        (x < width - 1 && !isOpaque(x + 1, y)) ||
        (y > 0 && !isOpaque(x, y - 1)) ||
        (y < height - 1 && !isOpaque(x, y + 1))
      if (onBorder || touchesTransparent) rim.push(y * width + x)
    }
  }

  if (rim.length < 12) return 0
  if (rimStdDev(image, rim) > 32) return 0

  const flatRim = rim.filter((pixelIndex) => {
    const x = pixelIndex % width
    const y = Math.floor(pixelIndex / width)
    return localVariance(data, width, height, x, y) < 260
  })

  if (flatRim.length < 12) return 0

  const flooded = floodSimilar(image, flatRim, (index) =>
    floodTolerance(data[index], data[index + 1], data[index + 2]),
  )
  return applyFloodIfSafe(image, flooded)
}

interface CellMean {
  r: number
  g: number
  b: number
  count: number
  lum: number
  sat: number
}

const GRID_CELL_SIZES = [8, 16, 10, 12, 6, 4, 20]
const GRID_MIN_LUM = 118
const GRID_MAX_SAT = 44
const GRID_PAIR_MIN_DELTA = 16
const GRID_PAIR_MAX_DELTA = 110
const GRID_SAME_MAX_DELTA = 14

function cellMean(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x0: number,
  y0: number,
  size: number,
): CellMean | null {
  const x1 = Math.min(width, x0 + size)
  const y1 = Math.min(height, y0 + size)
  let r = 0
  let g = 0
  let b = 0
  let count = 0

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * width + x) * 4
      if (data[index + 3] < OPAQUE_ALPHA) continue
      r += data[index]
      g += data[index + 1]
      b += data[index + 2]
      count += 1
    }
  }

  if (count < size * size * 0.45) return null
  r /= count
  g /= count
  b /= count
  return {
    r,
    g,
    b,
    count,
    lum: luminance(r, g, b),
    sat: Math.max(r, g, b) - Math.min(r, g, b),
  }
}

function isCheckerGray(cell: CellMean): boolean {
  return cell.sat <= GRID_MAX_SAT && cell.lum >= GRID_MIN_LUM && cell.lum <= 252
}

function isCheckerPair(a: CellMean, b: CellMean): boolean {
  if (!isCheckerGray(a) || !isCheckerGray(b)) return false
  const delta = colorDistanceRgb(a.r, a.g, a.b, b.r, b.g, b.b)
  return delta >= GRID_PAIR_MIN_DELTA && delta <= GRID_PAIR_MAX_DELTA
}

function isSameCellColor(a: CellMean, b: CellMean): boolean {
  return colorDistanceRgb(a.r, a.g, a.b, b.r, b.g, b.b) <= GRID_SAME_MAX_DELTA
}

function markCell(
  marked: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  size: number,
): void {
  const x1 = Math.min(width, x0 + size)
  const y1 = Math.min(height, y0 + size)
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      marked[y * width + x] = 1
    }
  }
}

function isLightGrayPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < OPAQUE_ALPHA) return false
  const lum = luminance(r, g, b)
  const sat = Math.max(r, g, b) - Math.min(r, g, b)
  return sat <= GRID_MAX_SAT + 8 && lum >= GRID_MIN_LUM - 8 && lum <= 253
}

export function removeFakeTransparencyGrid(image: PixelImage): number {
  const { data, width, height } = image
  const marked = new Uint8Array(width * height)

  const colorAt = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return null
    const index = (y * width + x) * 4
    if (data[index + 3] < OPAQUE_ALPHA) return null
    return {
      r: data[index],
      g: data[index + 1],
      b: data[index + 2],
      index,
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = colorAt(x, y)
      if (
        !pixel ||
        !isLightGrayPixel(pixel.r, pixel.g, pixel.b, 255)
      ) {
        continue
      }

      for (const size of GRID_CELL_SIZES) {
        const right = colorAt(x + size, y)
        const down = colorAt(x, y + size)
        const diag = colorAt(x + size, y + size)
        if (!right || !down || !diag) continue
        if (
          !isLightGrayPixel(right.r, right.g, right.b, 255) ||
          !isLightGrayPixel(down.r, down.g, down.b, 255) ||
          !isLightGrayPixel(diag.r, diag.g, diag.b, 255)
        ) {
          continue
        }

        const pairRight = colorDistanceRgb(pixel.r, pixel.g, pixel.b, right.r, right.g, right.b)
        const pairDown = colorDistanceRgb(pixel.r, pixel.g, pixel.b, down.r, down.g, down.b)
        const sameDiag = colorDistanceRgb(pixel.r, pixel.g, pixel.b, diag.r, diag.g, diag.b)
        const sameOpposite = colorDistanceRgb(right.r, right.g, right.b, down.r, down.g, down.b)

        if (sameDiag > GRID_SAME_MAX_DELTA || sameOpposite > GRID_SAME_MAX_DELTA) continue
        if (
          pairRight < GRID_PAIR_MIN_DELTA ||
          pairDown < GRID_PAIR_MIN_DELTA ||
          pairRight > GRID_PAIR_MAX_DELTA ||
          pairDown > GRID_PAIR_MAX_DELTA
        ) {
          continue
        }

        marked[pixel.index / 4] = 1
        marked[right.index / 4] = 1
        marked[down.index / 4] = 1
        marked[diag.index / 4] = 1
      }
    }
  }

  for (const size of GRID_CELL_SIZES) {
    const offsets = [0, 1, Math.floor(size / 2)]
    for (const ox of offsets) {
      for (const oy of offsets) {
        const cols = Math.floor((width - ox) / size)
        const rows = Math.floor((height - oy) / size)
        if (cols < 2 || rows < 2) continue

        const cells: Array<CellMean | null> = new Array(cols * rows)
        for (let row = 0; row < rows; row += 1) {
          for (let col = 0; col < cols; col += 1) {
            cells[row * cols + col] = cellMean(
              data,
              width,
              height,
              ox + col * size,
              oy + row * size,
              size,
            )
          }
        }

        for (let row = 0; row < rows - 1; row += 1) {
          for (let col = 0; col < cols - 1; col += 1) {
            const a = cells[row * cols + col]
            const b = cells[row * cols + col + 1]
            const c = cells[(row + 1) * cols + col]
            const d = cells[(row + 1) * cols + col + 1]
            if (!a || !b || !c || !d) continue
            if (!isSameCellColor(a, d) || !isSameCellColor(b, c)) continue
            if (!isCheckerPair(a, b) || !isCheckerPair(a, c)) continue
            if (isSameCellColor(a, b) || isSameCellColor(a, c)) continue

            markCell(marked, width, height, ox + col * size, oy + row * size, size)
            markCell(marked, width, height, ox + (col + 1) * size, oy + row * size, size)
            markCell(marked, width, height, ox + col * size, oy + (row + 1) * size, size)
            markCell(
              marked,
              width,
              height,
              ox + (col + 1) * size,
              oy + (row + 1) * size,
              size,
            )
          }
        }
      }
    }
  }

  const dilated = new Uint8Array(marked)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!marked[y * width + x]) continue
      const neighbors = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]
      for (const [dx, dy] of neighbors) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const index = (ny * width + nx) * 4
        if (
          isLightGrayPixel(data[index], data[index + 1], data[index + 2], data[index + 3])
        ) {
          dilated[ny * width + nx] = 1
        }
      }
    }
  }

  let cleared = 0
  for (let i = 0; i < dilated.length; i += 1) {
    if (!dilated[i]) continue
    const index = i * 4
    if (
      !isLightGrayPixel(data[index], data[index + 1], data[index + 2], data[index + 3])
    ) {
      continue
    }
    data[index + 3] = 0
    cleared += 1
  }

  return cleared
}

export function isolateArtwork(
  generated: PixelImage,
  source?: PixelImage | null,
): PixelImage {
  const work = clonePixels(generated)
  const originalOpaque = countOpaque(work)

  if (source && originalOpaque > 0) {
    const trial = clonePixels(work)
    const cleared = subtractSourceLookalike(trial, source)
    const remaining = countOpaque(trial)
    const canvas = work.width * work.height
    if (
      cleared / canvas >= SOURCE_CANVAS_MATCH &&
      cleared / originalOpaque >= SOURCE_OPAQUE_MATCH &&
      remainingIsSafe(originalOpaque, remaining)
    ) {
      work.data.set(trial.data)
    }
  }

  const edgeTrial = clonePixels(work)
  if (removeBackgroundFromImageEdges(edgeTrial) > 0) {
    work.data.set(edgeTrial.data)
  }

  const plateTrial = clonePixels(work)
  if (removeObjectPlate(plateTrial) > 0) {
    work.data.set(plateTrial.data)
  }

  const gridTrial = clonePixels(work)
  if (removeFakeTransparencyGrid(gridTrial) > 0) {
    work.data.set(gridTrial.data)
  }

  generated.data.set(work.data)
  return generated
}
