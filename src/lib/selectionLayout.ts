import type { Point, Selection, SelectionPath } from '../types'

export interface OverlayRegion {
  x: number
  y: number
  width: number
  height: number
  clipPath?: string
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
  const selectionBounds = pathBounds(selection.regions.flatMap((region) => region.points))
  const normalizedWidth = Math.max(selectionBounds.width, 1)
  const normalizedHeight = Math.max(selectionBounds.height, 1)
  const clipPathSegments = selection.regions
    .map((region) =>
      region.points
        .map((point) => {
          const px = ((point.x - selectionBounds.x) / normalizedWidth) * 100
          const py = ((point.y - selectionBounds.y) / normalizedHeight) * 100
          return `${px.toFixed(3)}% ${py.toFixed(3)}%`
        })
        .join(', '),
    )
    .filter((segment) => segment.length > 0)

  return [
    {
      x: selectionBounds.x / width,
      y: selectionBounds.y / height,
      width: selectionBounds.width / width,
      height: selectionBounds.height / height,
      clipPath: clipPathSegments.length === 1 ? `polygon(${clipPathSegments[0]})` : undefined,
    },
  ]
}
