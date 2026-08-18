import type { Point } from '../types'

export interface MagicWandOptions {
  colorTolerance?: number
  edgeThreshold?: number
  simplifyEpsilon?: number
}

const MAX_FILL_RATIO = 0.55
const MAX_BOUNDS_RATIO = 0.78
const HIGH_SENSITIVITY = 40

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function colorDistanceAt(
  data: Uint8ClampedArray,
  index: number,
  seedR: number,
  seedG: number,
  seedB: number,
): number {
  const r = data[index]
  const g = data[index + 1]
  const b = data[index + 2]
  return Math.hypot(r - seedR, g - seedG, b - seedB)
}

function rgbDistanceAt(
  data: Uint8ClampedArray,
  indexA: number,
  indexB: number,
): number {
  const dr = data[indexA] - data[indexB]
  const dg = data[indexA + 1] - data[indexB + 1]
  const db = data[indexA + 2] - data[indexB + 2]
  return Math.hypot(dr, dg, db)
}

function estimateLocalTolerance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  userTolerance: number,
): number {
  const seedIndex = (seedY * width + seedX) * 4
  const seedR = data[seedIndex]
  const seedG = data[seedIndex + 1]
  const seedB = data[seedIndex + 2]

  let sum = 0
  let sumSq = 0
  let count = 0

  for (let dy = -3; dy <= 3; dy += 1) {
    for (let dx = -3; dx <= 3; dx += 1) {
      const x = seedX + dx
      const y = seedY + dy
      if (x < 0 || y < 0 || x >= width || y >= height) continue

      const index = (y * width + x) * 4
      if (data[index + 3] < 16) continue

      const distance = colorDistanceAt(data, index, seedR, seedG, seedB)
      sum += distance
      sumSq += distance * distance
      count += 1
    }
  }

  if (count === 0) return userTolerance

  const mean = sum / count
  const variance = Math.max(0, sumSq / count - mean * mean)
  const stdDev = Math.sqrt(variance)
  const adaptiveCap = mean + stdDev * 1.15 + 4

  if (userTolerance <= HIGH_SENSITIVITY) {
    return Math.min(userTolerance, Math.max(8, adaptiveCap))
  }

  return userTolerance
}

function getStepTolerance(tolerance: number, userTolerance: number): number {
  const stepRatio = 0.52 + Math.min(0.43, userTolerance / 180)
  return Math.max(10, tolerance * stepRatio)
}

function stepBoundaryStrength(
  data: Uint8ClampedArray,
  width: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const i1 = (y1 * width + x1) * 4
  const i2 = (y2 * width + x2) * 4
  const lum1 = luminance(data[i1], data[i1 + 1], data[i1 + 2])
  const lum2 = luminance(data[i2], data[i2 + 1], data[i2 + 2])
  const lumDiff = Math.abs(lum1 - lum2)
  const rgbDiff = rgbDistanceAt(data, i1, i2)
  return Math.max(lumDiff, rgbDiff * 0.9)
}

function canIncludePixel(
  data: Uint8ClampedArray,
  index: number,
  seedR: number,
  seedG: number,
  seedB: number,
  tolerance: number,
): boolean {
  if (data[index + 3] < 16) return false
  return colorDistanceAt(data, index, seedR, seedG, seedB) <= tolerance
}

function canExpandToNeighbor(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  nx: number,
  ny: number,
  seedR: number,
  seedG: number,
  seedB: number,
  tolerance: number,
  stepTolerance: number,
  edgeThreshold: number,
): boolean {
  const parentIndex = (y * width + x) * 4
  const neighborIndex = (ny * width + nx) * 4

  if (!canIncludePixel(data, neighborIndex, seedR, seedG, seedB, tolerance)) {
    return false
  }

  if (rgbDistanceAt(data, parentIndex, neighborIndex) > stepTolerance) {
    return false
  }

  return stepBoundaryStrength(data, width, x, y, nx, ny) <= edgeThreshold
}

function floodFillMask(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  colorTolerance: number,
  edgeThreshold: number,
): Uint8Array | null {
  const { width, height, data } = imageData
  const sx = Math.max(0, Math.min(width - 1, Math.floor(seedX)))
  const sy = Math.max(0, Math.min(height - 1, Math.floor(seedY)))
  const seedIndex = (sy * width + sx) * 4
  const seedR = data[seedIndex]
  const seedG = data[seedIndex + 1]
  const seedB = data[seedIndex + 2]
  const tolerance = estimateLocalTolerance(data, width, height, sx, sy, colorTolerance)
  const stepTolerance = getStepTolerance(tolerance, colorTolerance)

  if (!canIncludePixel(data, seedIndex, seedR, seedG, seedB, tolerance)) {
    return null
  }

  const mask = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0
  let filled = 0
  const maxFill = Math.floor(width * height * MAX_FILL_RATIO)

  queue[tail++] = sy * width + sx
  mask[sy * width + sx] = 1
  filled = 1

  while (head < tail) {
    const flat = queue[head++]
    const x = flat % width
    const y = Math.floor(flat / width)

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue

      const next = ny * width + nx
      if (mask[next]) continue

      if (
        !canExpandToNeighbor(
          data,
          width,
          x,
          y,
          nx,
          ny,
          seedR,
          seedG,
          seedB,
          tolerance,
          stepTolerance,
          edgeThreshold,
        )
      ) {
        continue
      }

      mask[next] = 1
      filled += 1
      if (filled > maxFill) return null
      queue[tail++] = next
    }
  }

  return filled > 0 ? mask : null
}

function fillInternalHoles(mask: Uint8Array, width: number, height: number): void {
  const exterior = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0

  const enqueueExterior = (x: number, y: number) => {
    const index = y * width + x
    if (mask[index] || exterior[index]) return
    exterior[index] = 1
    queue[tail++] = index
  }

  for (let x = 0; x < width; x += 1) {
    enqueueExterior(x, 0)
    enqueueExterior(x, height - 1)
  }
  for (let y = 0; y < height; y += 1) {
    enqueueExterior(0, y)
    enqueueExterior(width - 1, y)
  }

  while (head < tail) {
    const index = queue[head++]
    const x = index % width
    const y = Math.floor(index / width)

    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      enqueueExterior(nx, ny)
    }
  }

  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] && !exterior[index]) {
      mask[index] = 1
    }
  }
}

function countMaskPixels(mask: Uint8Array): number {
  let count = 0
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index]) count += 1
  }
  return count
}

function getMaskBounds(
  mask: Uint8Array,
  width: number,
  height: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX === -1) return null
  return { minX, minY, maxX, maxY }
}

function countBorderTouches(mask: Uint8Array, width: number, height: number): number {
  let left = false
  let right = false
  let top = false
  let bottom = false

  for (let x = 0; x < width; x += 1) {
    if (mask[x]) top = true
    if (mask[(height - 1) * width + x]) bottom = true
  }
  for (let y = 0; y < height; y += 1) {
    if (mask[y * width]) left = true
    if (mask[y * width + width - 1]) right = true
  }

  return [left, right, top, bottom].filter(Boolean).length
}

function isBackgroundLikeMask(mask: Uint8Array, width: number, height: number): boolean {
  const filled = countMaskPixels(mask)
  const fillRatio = filled / (width * height)
  const borderTouches = countBorderTouches(mask, width, height)

  if (borderTouches >= 3) return true
  if (borderTouches >= 2 && fillRatio > 0.28) return true
  return false
}

function isUsableMask(
  mask: Uint8Array,
  width: number,
  height: number,
  colorTolerance: number,
): boolean {
  const filled = countMaskPixels(mask)
  const total = width * height
  const maxFillRatio =
    colorTolerance >= HIGH_SENSITIVITY ? MAX_FILL_RATIO : Math.min(MAX_FILL_RATIO, 0.48)

  if (filled === 0 || filled / total > maxFillRatio) return false

  const bounds = getMaskBounds(mask, width, height)
  if (!bounds) return false

  const boundsArea = (bounds.maxX - bounds.minX + 1) * (bounds.maxY - bounds.minY + 1)
  const maxBoundsRatio =
    colorTolerance >= HIGH_SENSITIVITY ? MAX_BOUNDS_RATIO : Math.min(MAX_BOUNDS_RATIO, 0.74)

  if (boundsArea / total > maxBoundsRatio) return false
  if (colorTolerance < HIGH_SENSITIVITY && isBackgroundLikeMask(mask, width, height)) {
    return false
  }

  return true
}

function isBoundaryPixel(
  mask: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  if (!mask[y * width + x]) return false

  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return true
    if (!mask[ny * width + nx]) return true
  }

  return false
}

function traceBoundary(mask: Uint8Array, width: number, height: number): Point[] {
  let startX = -1
  let startY = -1

  outer: for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isBoundaryPixel(mask, width, height, x, y)) {
        startX = x
        startY = y
        break outer
      }
    }
  }

  if (startX === -1) return []

  const directions = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ]

  const contour: Point[] = []
  let x = startX
  let y = startY
  let direction = 0
  const maxSteps = width * height * 4

  for (let step = 0; step < maxSteps; step += 1) {
    contour.push({ x, y })

    let found = false
    for (let offset = 0; offset < 8; offset += 1) {
      const nextDirection = (direction + offset + 5) % 8
      const [dx, dy] = directions[nextDirection]
      const nx = x + dx
      const ny = y + dy

      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (!isBoundaryPixel(mask, width, height, nx, ny)) continue

      x = nx
      y = ny
      direction = nextDirection
      found = true
      break
    }

    if (!found) break
    if (x === startX && y === startY && contour.length > 8) break
  }

  return contour
}

function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x
  const dy = end.y - start.y

  if (dx === 0 && dy === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y)
  }

  const numerator = Math.abs(
    dy * point.x - dx * point.y + end.x * start.y - end.y * start.x,
  )
  const denominator = Math.hypot(dx, dy)
  return numerator / denominator
}

function simplifyPath(points: Point[], epsilon: number): Point[] {
  if (points.length <= 2) return points

  let maxDistance = 0
  let index = 0
  const end = points.length - 1

  for (let i = 1; i < end; i += 1) {
    const distance = perpendicularDistance(points[i], points[0], points[end])
    if (distance > maxDistance) {
      maxDistance = distance
      index = i
    }
  }

  if (maxDistance > epsilon) {
    const left = simplifyPath(points.slice(0, index + 1), epsilon)
    const right = simplifyPath(points.slice(index), epsilon)
    return [...left.slice(0, -1), ...right]
  }

  return [points[0], points[end]]
}

export interface MagicWandHit {
  points: Point[]
  mask: Uint8Array
  width: number
  height: number
}

export function magicWandSelection(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  options: MagicWandOptions = {},
): MagicWandHit | null {
  const colorTolerance = options.colorTolerance ?? 32
  const edgeThreshold = options.edgeThreshold ?? getMagicWandEdgeThreshold(colorTolerance)
  const simplifyEpsilon = options.simplifyEpsilon ?? 2.5

  const mask = floodFillMask(
    imageData,
    seedX,
    seedY,
    colorTolerance,
    edgeThreshold,
  )
  if (!mask) return null

  fillInternalHoles(mask, imageData.width, imageData.height)
  if (!isUsableMask(mask, imageData.width, imageData.height, colorTolerance)) return null

  const boundary = traceBoundary(mask, imageData.width, imageData.height)
  if (boundary.length < 3) return null

  const epsilon =
    boundary.length > 400
      ? Math.max(simplifyEpsilon, 4.5)
      : boundary.length > 180
        ? Math.max(simplifyEpsilon, 3.5)
        : simplifyEpsilon
  const simplified = simplifyPath(boundary, epsilon)
  const points = simplified.length >= 3 ? simplified : boundary
  return {
    points,
    mask,
    width: imageData.width,
    height: imageData.height,
  }
}

export function getMagicWandEdgeThreshold(colorTolerance: number): number {
  return Math.round(14 + colorTolerance * 0.45)
}
