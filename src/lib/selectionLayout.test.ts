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

const tests = [
  ['largest region picked', testLargestRegionPicked],
  ['overlay combines regions into single object', testOverlayCombinesRegionsIntoSingleObject],
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
