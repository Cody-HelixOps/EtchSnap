import type { Point } from '../types'

export interface MagicWandOptions {
  colorTolerance?: number
  edgeThreshold?: number
  simplifyEpsilon?: number
}

const MAX_FILL_RATIO = 0.62

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
  const adaptiveCap = mean + stdDev * 1.35 + 4

  return Math.min(userTolerance, Math.max(10, adaptiveCap))
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
  return Math.max(lumDiff, rgbDiff * 0.85)
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
  edgeThreshold: number,
): boolean {
  const neighborIndex = (ny * width + nx) * 4
  if (!canIncludePixel(data, neighborIndex, seedR, seedG, seedB, tolerance)) {
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
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
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

export function magicWandSelection(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  options: MagicWandOptions = {},
): Point[] | null {
  const colorTolerance = options.colorTolerance ?? 24
  const edgeThreshold = options.edgeThreshold ?? 28
  const simplifyEpsilon = options.simplifyEpsilon ?? 2.2

  const mask = floodFillMask(
    imageData,
    seedX,
    seedY,
    colorTolerance,
    edgeThreshold,
  )
  if (!mask) return null

  const boundary = traceBoundary(mask, imageData.width, imageData.height)
  if (boundary.length < 3) return null

  const simplified = simplifyPath(boundary, simplifyEpsilon)
  return simplified.length >= 3 ? simplified : boundary
}

export function getMagicWandEdgeThreshold(colorTolerance: number): number {
  return Math.max(16, Math.round(44 - colorTolerance * 0.28))
}
