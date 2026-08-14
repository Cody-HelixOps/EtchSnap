import type { Point } from '../types'

export interface MagicWandOptions {
  colorTolerance?: number
  edgeThreshold?: number
  simplifyEpsilon?: number
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function colorDistance(
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

function edgeStrength(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const center = luminance(
    data[(y * width + x) * 4],
    data[(y * width + x) * 4 + 1],
    data[(y * width + x) * 4 + 2],
  )

  let maxDiff = 0
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue

    const i = (ny * width + nx) * 4
    const neighbor = luminance(data[i], data[i + 1], data[i + 2])
    maxDiff = Math.max(maxDiff, Math.abs(center - neighbor))
  }

  return maxDiff
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

  const mask = new Uint8Array(width * height)
  const visited = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0

  queue[tail++] = sy * width + sx
  visited[sy * width + sx] = 1
  let filled = 0
  const maxFill = width * height

  while (head < tail) {
    const flat = queue[head++]
    const x = flat % width
    const y = Math.floor(flat / width)
    const i = flat * 4

    if (data[i + 3] < 16) continue

    const distance = colorDistance(data, i, seedR, seedG, seedB)
    const edge = edgeStrength(data, width, height, x, y)
    const edgeLimit = edgeThreshold + Math.min(edge * 0.35, 18)
    const allowedTolerance =
      edge > edgeThreshold ? colorTolerance * 0.72 : colorTolerance

    if (distance > allowedTolerance && edge > edgeLimit) continue

    mask[flat] = 1
    filled += 1
    if (filled > maxFill) return null

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
      if (visited[next]) continue
      visited[next] = 1
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
  const colorTolerance = options.colorTolerance ?? 34
  const edgeThreshold = options.edgeThreshold ?? 24
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
