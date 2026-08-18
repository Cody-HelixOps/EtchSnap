import { buildOverlayRegions, getLargestRegion } from './selectionLayout.ts'
import { mergeSelectionRegions } from './selectionMerge.ts'
import type { Point, Selection } from '../types.ts'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function getPathBounds(points: Point[]) {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)

  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  }
}

function testLargestRegionPicked(): void {
  const selection: Selection = {
    regions: [
      {
        points: [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 10 },
          { x: 0, y: 10 },
        ],
        closed: true,
      },
      {
        points: [
          { x: 0, y: 20 },
          { x: 80, y: 20 },
          { x: 80, y: 40 },
          { x: 0, y: 40 },
        ],
        closed: true,
      },
    ],
  }

  const largest = getLargestRegion(selection)
  assert(largest.points[1].x === 80, 'largest region should be the wide scale')
}

function testOverlayCombinesRegionsIntoSingleObject(): void {
  const selection: Selection = {
    regions: [
      {
        points: [
          { x: 10, y: 10 },
          { x: 90, y: 10 },
          { x: 90, y: 30 },
          { x: 10, y: 30 },
        ],
        closed: true,
      },
      {
        points: [
          { x: 10, y: 50 },
          { x: 90, y: 50 },
          { x: 90, y: 70 },
          { x: 10, y: 70 },
        ],
        closed: true,
      },
    ],
  }

  const overlays = buildOverlayRegions(selection, 100, 100)
  assert(overlays.length === 1, 'all selected areas should preview as one combined object')
  assert(Math.abs(overlays[0].y - 0.1) < 0.001, 'combined overlay starts at top-most region')
  assert(Math.abs(overlays[0].height - 0.6) < 0.001, 'combined overlay spans all selected areas')
  assert(overlays[0].clipPath === undefined, 'multi-region combined overlay should not clip')
}

function testOverlappingRegionsMergeIntoSingleSelection(): void {
  const merged = mergeSelectionRegions(
    [
      {
        points: [
          { x: 10, y: 10 },
          { x: 50, y: 10 },
          { x: 50, y: 40 },
          { x: 10, y: 40 },
        ],
        closed: true,
      },
    ],
    {
      points: [
        { x: 30, y: 20 },
        { x: 70, y: 20 },
        { x: 70, y: 50 },
        { x: 30, y: 50 },
      ],
      closed: true,
    },
  )

  assert(merged.length === 1, 'overlapping regions should merge into one selection')
  const bounds = getPathBounds(merged[0].points)
  assert(bounds.x === 10, 'merged region should extend to the left-most overlapping edge')
  assert(bounds.y === 10, 'merged region should extend to the top-most overlapping edge')
  assert(bounds.width >= 59, 'merged region should span the union width')
  assert(bounds.height >= 39, 'merged region should span the union height')
}

function testDisjointRegionsStaySeparate(): void {
  const merged = mergeSelectionRegions(
    [
      {
        points: [
          { x: 10, y: 10 },
          { x: 30, y: 10 },
          { x: 30, y: 30 },
          { x: 10, y: 30 },
        ],
        closed: true,
      },
    ],
    {
      points: [
        { x: 50, y: 10 },
        { x: 70, y: 10 },
        { x: 70, y: 30 },
        { x: 50, y: 30 },
      ],
      closed: true,
    },
  )

  assert(merged.length === 2, 'separate regions should continue to append independently')
}

function testNearbyDisjointRegionsCanMergeForWandSelections(): void {
  const merged = mergeSelectionRegions(
    [
      {
        points: [
          { x: 10, y: 10 },
          { x: 40, y: 10 },
          { x: 40, y: 36 },
          { x: 10, y: 36 },
        ],
        closed: true,
      },
    ],
    {
      points: [
        { x: 48, y: 14 },
        { x: 82, y: 14 },
        { x: 82, y: 42 },
        { x: 48, y: 42 },
      ],
      closed: true,
    },
    { mergeNearbyGap: 12 },
  )

  assert(merged.length === 1, 'nearby disjoint wand regions should merge into one selection')
  const bounds = getPathBounds(merged[0].points)
  assert(bounds.x === 10, 'merged wand selection should keep the left-most bound')
  assert(bounds.width >= 72, 'merged wand selection should cover both separated regions')
  assert(bounds.height >= 31, 'merged wand selection should cover the full merged height')
}

const tests = [
  ['largest region picked', testLargestRegionPicked],
  ['overlay combines regions into single object', testOverlayCombinesRegionsIntoSingleObject],
  ['overlapping regions merge into one selection', testOverlappingRegionsMergeIntoSingleSelection],
  ['disjoint regions stay separate', testDisjointRegionsStaySeparate],
  ['nearby disjoint regions can merge for wand selections', testNearbyDisjointRegionsCanMergeForWandSelections],
] as const

let failed = 0
for (const [name, run] of tests) {
  try {
    run()
    console.log(`ok  ${name}`)
  } catch (error) {
    failed += 1
    console.error(`fail  ${name}`)
    console.error(error instanceof Error ? error.message : error)
  }
}

if (failed > 0) process.exit(1)
console.log(`\n${tests.length - failed}/${tests.length} selection layout tests passed`)
