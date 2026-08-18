import type { Point, SelectionPath } from '../types'

const EPSILON = 1e-6

function getBounds(points: Point[]) {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const point of points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  return { minX, minY, maxX, maxY }
}

function crossProduct(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
}

function pointOnSegment(point: Point, start: Point, end: Point): boolean {
  if (Math.abs(crossProduct(start, end, point)) > EPSILON) return false

  return (
    point.x >= Math.min(start.x, end.x) - EPSILON &&
    point.x <= Math.max(start.x, end.x) + EPSILON &&
    point.y >= Math.min(start.y, end.y) - EPSILON &&
    point.y <= Math.max(start.y, end.y) + EPSILON
  )
}

function segmentsIntersectOrTouch(a1: Point, a2: Point, b1: Point, b2: Point): boolean {
  const aBounds = getBounds([a1, a2])
  const bBounds = getBounds([b1, b2])
  if (
    aBounds.maxX < bBounds.minX - EPSILON ||
    bBounds.maxX < aBounds.minX - EPSILON ||
    aBounds.maxY < bBounds.minY - EPSILON ||
    bBounds.maxY < aBounds.minY - EPSILON
  ) {
    return false
  }

  const d1 = crossProduct(a1, a2, b1)
  const d2 = crossProduct(a1, a2, b2)
  const d3 = crossProduct(b1, b2, a1)
  const d4 = crossProduct(b1, b2, a2)

  if (
    ((d1 > EPSILON && d2 < -EPSILON) || (d1 < -EPSILON && d2 > EPSILON)) &&
    ((d3 > EPSILON && d4 < -EPSILON) || (d3 < -EPSILON && d4 > EPSILON))
  ) {
    return true
  }

  return (
    pointOnSegment(b1, a1, a2) ||
    pointOnSegment(b2, a1, a2) ||
    pointOnSegment(a1, b1, b2) ||
    pointOnSegment(a2, b1, b2)
  )
}

function pointInPolygonOrOnEdge(point: Point, polygon: Point[]): boolean {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const start = polygon[j]
    const end = polygon[i]

    if (pointOnSegment(point, start, end)) return true

    const intersects =
      (end.y > point.y) !== (start.y > point.y) &&
      point.x <
        ((start.x - end.x) * (point.y - end.y)) / (start.y - end.y || Number.EPSILON) + end.x

    if (intersects) inside = !inside
  }

  return inside
}

function regionsOverlapOrTouch(a: SelectionPath, b: SelectionPath): boolean {
  const aBounds = getBounds(a.points)
  const bBounds = getBounds(b.points)
  if (
    aBounds.maxX < bBounds.minX - EPSILON ||
    bBounds.maxX < aBounds.minX - EPSILON ||
    aBounds.maxY < bBounds.minY - EPSILON ||
    bBounds.maxY < aBounds.minY - EPSILON
  ) {
    return false
  }

  for (let i = 0; i < a.points.length; i += 1) {
    const a1 = a.points[i]
    const a2 = a.points[(i + 1) % a.points.length]
    for (let j = 0; j < b.points.length; j += 1) {
      const b1 = b.points[j]
      const b2 = b.points[(j + 1) % b.points.length]
      if (segmentsIntersectOrTouch(a1, a2, b1, b2)) return true
    }
  }

  return pointInPolygonOrOnEdge(a.points[0], b.points) || pointInPolygonOrOnEdge(b.points[0], a.points)
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
      // Start by checking the neighbor just behind the incoming edge, then sweep
      // clockwise to keep the contour walker hugging the outer boundary.
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

function mergeRegionGroup(regions: SelectionPath[]): SelectionPath | null {
  const allPoints = regions.flatMap((region) => region.points)
  if (allPoints.length === 0) return null

  const bounds = getBounds(allPoints)
  const offsetX = Math.floor(bounds.minX) - 1
  const offsetY = Math.floor(bounds.minY) - 1
  const width = Math.max(3, Math.ceil(bounds.maxX) - Math.floor(bounds.minX) + 3)
  const height = Math.max(3, Math.ceil(bounds.maxY) - Math.floor(bounds.minY) + 3)
  const mask = new Uint8Array(width * height)

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const point = { x: x + offsetX + 0.5, y: y + offsetY + 0.5 }
      if (regions.some((region) => pointInPolygonOrOnEdge(point, region.points))) {
        mask[y * width + x] = 1
      }
    }
  }

  fillInternalHoles(mask, width, height)

  const boundary = traceBoundary(mask, width, height)
  if (boundary.length < 3) return null

  // Match the magic-wand simplification bands so merged regions keep a similar
  // balance between smooth outlines and preserving sharper corners.
  const epsilon =
    boundary.length > 400
      ? 4.5
      : boundary.length > 180
        ? 3.5
        : 2.5
  const points = simplifyPath(boundary, epsilon).map((point) => ({
    x: point.x + offsetX,
    y: point.y + offsetY,
  }))

  return points.length >= 3 ? { points, closed: true } : null
}

export function mergeSelectionRegions(
  existingRegions: SelectionPath[],
  nextRegion: SelectionPath,
): SelectionPath[] {
  if (existingRegions.length === 0) return [nextRegion]

  const overlapping = new Set<number>()
  const queue: SelectionPath[] = [nextRegion]

  while (queue.length > 0) {
    const candidate = queue.pop()
    if (!candidate) continue

    for (let index = 0; index < existingRegions.length; index += 1) {
      if (overlapping.has(index)) continue
      if (!regionsOverlapOrTouch(candidate, existingRegions[index])) continue
      overlapping.add(index)
      queue.push(existingRegions[index])
    }
  }

  if (overlapping.size === 0) {
    return [...existingRegions, nextRegion]
  }

  const overlapIndexes = [...overlapping].sort((a, b) => a - b)
  const merged = mergeRegionGroup([
    nextRegion,
    ...overlapIndexes.map((index) => existingRegions[index]),
  ])
  if (!merged) {
    return [...existingRegions, nextRegion]
  }

  const firstOverlapIndex = overlapIndexes[0]
  const result: SelectionPath[] = []
  let inserted = false

  existingRegions.forEach((region, index) => {
    if (index === firstOverlapIndex) {
      result.push(merged)
      inserted = true
    }
    if (!overlapping.has(index)) {
      result.push(region)
    }
  })

  if (!inserted) result.push(merged)
  return result
}
