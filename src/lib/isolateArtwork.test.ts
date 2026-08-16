import {
  countOpaque,
  isolateArtwork,
  type PixelImage,
} from './isolateArtwork.ts'

function createImage(width: number, height: number): PixelImage {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  }
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

function testWhitePlateWithRedDesign(): void {
  const image = createImage(120, 90)
  fillRect(image, 10, 8, 100, 74, 250, 250, 248)
  fillRect(image, 44, 28, 28, 28, 210, 32, 40)

  isolateArtwork(image)

  const design = sample(image, 58, 42)
  const plate = sample(image, 14, 12)
  assert(design.a > 200 && design.r > 180 && design.g < 80, 'red design should remain')
  assert(plate.a < 20, 'white object plate should be removed')
  assert(countOpaque(image) > 400, 'design pixels should remain after isolation')
}

function testTransparentDesignUnchanged(): void {
  const image = createImage(80, 80)
  fillRect(image, 24, 18, 22, 30, 20, 90, 210)
  const before = countOpaque(image)

  isolateArtwork(image)

  const design = sample(image, 30, 30)
  assert(design.a > 200 && design.b > 180, 'standalone design should stay opaque')
  assert(countOpaque(image) >= before * 0.85, 'transparent artwork should not be eaten')
}

function testSourceSubtractionKeepsArtwork(): void {
  const source = createImage(100, 80)
  fillRect(source, 0, 0, 100, 80, 236, 232, 224)

  const generated = createImage(100, 80)
  fillRect(generated, 0, 0, 100, 80, 238, 234, 226)
  fillRect(generated, 35, 22, 30, 36, 40, 70, 190)

  isolateArtwork(generated, source)

  const art = sample(generated, 48, 40)
  const plate = sample(generated, 4, 4)
  assert(art.a > 200 && art.b > 150, 'blue artwork should remain over the object')
  assert(plate.a < 20, 'object-colored pixels should be cleared')
}

function testWhiteArtworkOnWhiteObjectKept(): void {
  const source = createImage(100, 80)
  fillRect(source, 0, 0, 100, 80, 250, 250, 250)

  const generated = createImage(100, 80)
  fillRect(generated, 38, 26, 24, 24, 252, 252, 252)

  isolateArtwork(generated, source)

  assert(
    countOpaque(generated) > 300,
    'a small white design on transparency must not be deleted just because the object is white',
  )
}

function testFullCanvasWhiteBackground(): void {
  const image = createImage(100, 80)
  fillRect(image, 0, 0, 100, 80, 255, 255, 255)
  fillRect(image, 30, 18, 40, 44, 18, 18, 18)

  isolateArtwork(image)

  const art = sample(image, 50, 40)
  const bg = sample(image, 2, 2)
  assert(art.a > 200 && art.r < 40, 'dark design on a white canvas should remain')
  assert(bg.a < 20, 'full-canvas white background should be removed')
}

const tests = [
  ['white plate with red design', testWhitePlateWithRedDesign],
  ['transparent design unchanged', testTransparentDesignUnchanged],
  ['source subtraction keeps artwork', testSourceSubtractionKeepsArtwork],
  ['white artwork on white object kept', testWhiteArtworkOnWhiteObjectKept],
  ['full canvas white background', testFullCanvasWhiteBackground],
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

if (failed > 0) {
  process.exit(1)
}

console.log(`\n${tests.length - failed}/${tests.length} isolation tests passed`)
