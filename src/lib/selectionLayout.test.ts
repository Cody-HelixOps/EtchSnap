import { buildOverlayRegions, getLargestRegion } from './selectionLayout.ts'
import type { Selection } from '../types.ts'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
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

function testOverlayPlacesEachRegionSeparately(): void {
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
  assert(overlays.length === 2, 'each selected area gets its own overlay')
  assert(Math.abs(overlays[0].y - 0.1) < 0.001, 'first region stays at its own top')
  assert(Math.abs(overlays[1].y - 0.5) < 0.001, 'second region is not merged into the first bbox')
  assert(overlays[0].height < 0.25 && overlays[1].height < 0.25, 'gap between regions is not filled')
  assert(overlays[0].clipPath.includes('polygon('), 'overlay is clipped to the region shape')
}

const tests = [
  ['largest region picked', testLargestRegionPicked],
  ['overlay places each region separately', testOverlayPlacesEachRegionSeparately],
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
