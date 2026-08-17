import type { Point, Selection, SelectionPath } from '../types'

export interface OverlayRegion {
  x: number
  y: number
  width: number
  height: number
  clipPath: string
}

function pathBounds(points: Point[]) {
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

export function getLargestRegion(selection: Selection): SelectionPath {
  return selection.regions.reduce((best, region) => {
    const area = regionArea(region)
    const bestArea = regionArea(best)
    return area > bestArea ? region : best
  })
}

function regionArea(region: SelectionPath): number {
  const bounds = pathBounds(region.points)
  return bounds.width * bounds.height
}

export function buildOverlayRegions(
  selection: Selection,
  displayWidth: number,
  displayHeight: number,
): OverlayRegion[] {
  const width = Math.max(displayWidth, 1)
  const height = Math.max(displayHeight, 1)

  return selection.regions.map((region) => {
    const bounds = pathBounds(region.points)
    const clipPath =
      'polygon(' +
      region.points
        .map((point) => {
          const px = bounds.width <= 0 ? 0 : ((point.x - bounds.x) / bounds.width) * 100
          const py = bounds.height <= 0 ? 0 : ((point.y - bounds.y) / bounds.height) * 100
          return `${px.toFixed(3)}% ${py.toFixed(3)}%`
        })
        .join(', ') +
      ')'

    return {
      x: bounds.x / width,
      y: bounds.y / height,
      width: bounds.width / width,
      height: bounds.height / height,
      clipPath,
    }
  })
}
