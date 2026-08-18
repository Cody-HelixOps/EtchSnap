import { buildOverlayRegions, getLargestRegion } from './selectionLayout.ts'
import { mergeSelectionRegions } from './selectionMerge.ts'
import { magicWandSelection } from './magicWand.ts'
import type { Point, Selection, SelectionPath } from '../types.ts'

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
  assert(bounds.width >= 71, 'merged wand selection should cover both separated regions')
  assert(bounds.height >= 31, 'merged wand selection should cover the full merged height')
}

function makeJaggedBlob(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  amplitude: number,
): SelectionPath {
  const points: Point[] = []
  const steps = 18
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    points.push({ x: x0 + (x1 - x0) * t, y: y0 + (i % 2 === 0 ? 0 : amplitude) })
  }
  for (let i = steps; i >= 0; i -= 1) {
    const t = i / steps
    points.push({ x: x0 + (x1 - x0) * t, y: y1 - (i % 2 === 0 ? 0 : amplitude) })
  }
  return { points, closed: true }
}

function testJaggedOverlappingHandleRegionsMerge(): void {
  const merged = mergeSelectionRegions(
    [makeJaggedBlob(40, 40, 280, 140, 18)],
    makeJaggedBlob(200, 44, 460, 148, 18),
    { mergeNearbyGap: 19.2 },
  )
  assert(merged.length === 1, `jagged overlapping handle regions should merge, got ${merged.length}`)
}

function testCrossingLightningRegionsMerge(): void {
  const merged = mergeSelectionRegions(
    [
      {
        points: [
          { x: 20, y: 80 },
          { x: 80, y: 20 },
          { x: 140, y: 90 },
          { x: 200, y: 30 },
          { x: 260, y: 100 },
          { x: 250, y: 150 },
          { x: 190, y: 80 },
          { x: 130, y: 160 },
          { x: 70, y: 90 },
          { x: 30, y: 150 },
        ],
        closed: true,
      },
    ],
    {
      points: [
        { x: 180, y: 70 },
        { x: 240, y: 10 },
        { x: 300, y: 80 },
        { x: 360, y: 20 },
        { x: 420, y: 90 },
        { x: 410, y: 140 },
        { x: 350, y: 70 },
        { x: 290, y: 150 },
        { x: 230, y: 80 },
        { x: 190, y: 140 },
      ],
      closed: true,
    },
    { mergeNearbyGap: 19.2 },
  )
  assert(merged.length === 1, `crossing lightning regions should merge, got ${merged.length}`)
}

function createImageData(width: number, height: number): ImageData {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
    colorSpace: 'srgb',
  } as ImageData
}

function fillRect(
  image: ImageData,
  x: number,
  y: number,
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): void {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      const index = (py * image.width + px) * 4
      image.data[index] = r
      image.data[index + 1] = g
      image.data[index + 2] = b
      image.data[index + 3] = 255
    }
  }
}

function toWandRegion(hit: NonNullable<ReturnType<typeof magicWandSelection>>): SelectionPath {
  return {
    points: hit.points,
    closed: true,
    mask: hit.mask,
    maskWidth: hit.width,
    maskHeight: hit.height,
  }
}

function testNoisyHandleWandClicksMerge(): void {
  const image = createImageData(420, 160)
  fillRect(image, 0, 0, 420, 160, 168, 90, 196)

  for (let y = 50; y < 110; y += 1) {
    for (let x = 40; x < 380; x += 1) {
      const noise = ((x * 37 + y * 17) % 13) - 6
      const shade = 28 + noise
      const index = (y * image.width + x) * 4
      image.data[index] = shade
      image.data[index + 1] = shade
      image.data[index + 2] = shade
      image.data[index + 3] = 255
    }
  }

  const left = magicWandSelection(image, 110, 80, { colorTolerance: 32 })
  const right = magicWandSelection(image, 300, 80, { colorTolerance: 32 })
  assert(!!left && left.points.length >= 3, 'left noisy wand click should select')
  assert(!!right && right.points.length >= 3, 'right noisy wand click should select')

  const merged = mergeSelectionRegions([toWandRegion(left!)], toWandRegion(right!), {
    mergeNearbyGap: Math.max(12, 32 * 0.6),
  })
  assert(merged.length === 1, `two wand clicks on the same handle should merge, got ${merged.length}`)
}

function testChainedWandClicksOnHandleStayOneRegion(): void {
  const image = createImageData(420, 160)
  fillRect(image, 0, 0, 420, 160, 168, 90, 196)

  for (let y = 50; y < 110; y += 1) {
    for (let x = 40; x < 380; x += 1) {
      const noise = ((x * 37 + y * 17) % 13) - 6
      const shade = 28 + noise
      const index = (y * image.width + x) * 4
      image.data[index] = shade
      image.data[index + 1] = shade
      image.data[index + 2] = shade
      image.data[index + 3] = 255
    }
  }

  const clicks = [110, 180, 260, 330]
  const hits = clicks.map((x) => magicWandSelection(image, x, 80, { colorTolerance: 32 }))
  assert(hits.every((hit) => hit && hit.points.length >= 3), 'every wand click should select')

  let regions: SelectionPath[] = [toWandRegion(hits[0]!)]
  for (let index = 1; index < hits.length; index += 1) {
    regions = mergeSelectionRegions(regions, toWandRegion(hits[index]!), {
      mergeNearbyGap: Math.max(12, 32 * 0.6),
    })
  }

  assert(regions.length === 1, `chained wand clicks on one handle should stay one region, got ${regions.length}`)
}

function testFarApartWandClicksStaySeparate(): void {
  const merged = mergeSelectionRegions(
    [makeJaggedBlob(10, 10, 80, 70, 6)],
    makeJaggedBlob(220, 10, 300, 70, 6),
    { mergeNearbyGap: 19.2 },
  )
  assert(merged.length === 2, `far-apart objects should stay separate, got ${merged.length}`)
}

const tests = [
  ['largest region picked', testLargestRegionPicked],
  ['overlay combines regions into single object', testOverlayCombinesRegionsIntoSingleObject],
  ['overlapping regions merge into one selection', testOverlappingRegionsMergeIntoSingleSelection],
  ['disjoint regions stay separate', testDisjointRegionsStaySeparate],
  ['nearby disjoint regions can merge for wand selections', testNearbyDisjointRegionsCanMergeForWandSelections],
  ['jagged overlapping handle regions merge', testJaggedOverlappingHandleRegionsMerge],
  ['crossing lightning regions merge', testCrossingLightningRegionsMerge],
  ['noisy handle wand clicks merge', testNoisyHandleWandClicksMerge],
  ['chained wand clicks on a handle stay one region', testChainedWandClicksOnHandleStayOneRegion],
  ['far-apart wand clicks stay separate', testFarApartWandClicksStaySeparate],
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
