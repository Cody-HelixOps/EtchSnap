import { CHROMA_KEY } from './chromaKey.ts'
import { createSilhouetteReference, fitDesignToMask } from './fitToMask.ts'
import type { PixelImage } from './isolateArtwork.ts'

function createImage(width: number, height: number, r = 0, g = 0, b = 0, a = 0): PixelImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = a
  }
  return { data, width, height }
}

function fillRect(
  image: PixelImage,
  x: number,
  y: number,
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      const index = (py * image.width + px) * 4
      image.data[index] = r
      image.data[index + 1] = g
      image.data[index + 2] = b
      image.data[index + 3] = a
    }
  }
}

function sample(image: PixelImage, x: number, y: number) {
  const index = (y * image.width + x) * 4
  return {
    r: image.data[index],
    g: image.data[index + 1],
    b: image.data[index + 2],
    a: image.data[index + 3],
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function testOutputMatchesMaskSizeAndClip(): void {
  const mask = createImage(120, 40)
  fillRect(mask, 10, 8, 100, 24, 10, 10, 10, 255)
  fillRect(mask, 55, 16, 10, 8, 0, 0, 0, 0)

  const design = createImage(60, 60, 0, 0, 0, 255)
  const fitted = fitDesignToMask(design, mask)

  assert(fitted.width === 120 && fitted.height === 40, 'fitted design must match the selected crop size')
  assert(sample(fitted, 2, 2).a === 0, 'pixels outside the selection must be transparent')
  assert(sample(fitted, 118, 38).a === 0, 'far corner outside the selection must be transparent')
  assert(sample(fitted, 60, 20).a === 0, 'holes inside the selection must stay transparent')
  assert(sample(fitted, 20, 20).a > 200, 'pixels inside the selection must keep the design')
  assert(sample(fitted, 100, 20).a > 200, 'design must cover the full width of the selection')
}

function testCoverScaleFillsWideSelection(): void {
  const mask = createImage(200, 50)
  fillRect(mask, 0, 0, 200, 50, 255, 255, 255, 255)

  const design = createImage(40, 40, 20, 20, 20, 255)
  const fitted = fitDesignToMask(design, mask)

  assert(sample(fitted, 4, 25).a > 200, 'cover-fit should fill the left edge of a wide selection')
  assert(sample(fitted, 195, 25).a > 200, 'cover-fit should fill the right edge of a wide selection')
}

function testSilhouetteUsesMaskShape(): void {
  const mask = createImage(80, 30)
  fillRect(mask, 8, 6, 64, 18, 40, 40, 40, 255)

  const silhouette = createSilhouetteReference(mask)
  const inside = sample(silhouette, 20, 12)
  const outside = sample(silhouette, 1, 1)

  assert(inside.r === 255 && inside.g === 255 && inside.b === 255, 'selected area should be white in the silhouette')
  assert(
    outside.r === CHROMA_KEY.r && outside.g === CHROMA_KEY.g && outside.b === CHROMA_KEY.b,
    'outside the selection should be chroma key',
  )
  assert(outside.a === 255, 'silhouette background must be opaque so the model sees the shape')
}

const tests = [
  ['output matches mask size and clip', testOutputMatchesMaskSizeAndClip],
  ['cover scale fills wide selection', testCoverScaleFillsWideSelection],
  ['silhouette uses mask shape', testSilhouetteUsesMaskShape],
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
console.log(`\n${tests.length - failed}/${tests.length} fit-to-mask tests passed`)
