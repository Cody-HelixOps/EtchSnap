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

function paintCheckerboard(
  image: PixelImage,
  x: number,
  y: number,
  width: number,
  height: number,
  size: number,
  light: [number, number, number],
  dark: [number, number, number],
): void {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      const cellX = Math.floor((px - x) / size)
      const cellY = Math.floor((py - y) / size)
      const color = (cellX + cellY) % 2 === 0 ? light : dark
      const index = (py * image.width + px) * 4
      image.data[index] = color[0]
      image.data[index + 1] = color[1]
      image.data[index + 2] = color[2]
      image.data[index + 3] = 255
    }
  }
}

function testColorfulCheckerDesignKept(): void {
  const image = createImage(96, 64)
  paintCheckerboard(image, 16, 8, 64, 48, 8, [210, 30, 40], [20, 20, 20])

  isolateArtwork(image)

  const red = sample(image, 20, 12)
  const black = sample(image, 28, 12)
  assert(red.a > 200 && red.r > 180, 'red chess squares should remain')
  assert(black.a > 200 && black.r < 40, 'black chess squares should remain')
}

function testMagentaBackgroundRemoved(): void {
  const image = createImage(100, 80)
  fillRect(image, 0, 0, 100, 80, 255, 0, 255)
  fillRect(image, 30, 18, 40, 44, 186, 112, 42)

  isolateArtwork(image)

  const art = sample(image, 50, 40)
  const bg = sample(image, 2, 2)
  assert(art.a > 200 && art.r > 150, 'bronze artwork should remain after chroma key')
  assert(bg.a < 20, 'magenta background should be removed')
}

function testMagentaInteriorHoleRemoved(): void {
  const image = createImage(80, 80)
  fillRect(image, 10, 10, 60, 60, 186, 112, 42)
  fillRect(image, 28, 28, 24, 24, 255, 0, 255)

  isolateArtwork(image)

  const frame = sample(image, 15, 15)
  const hole = sample(image, 40, 40)
  assert(frame.a > 200 && frame.r > 150, 'artwork around a keyed hole should remain')
  assert(hole.a < 20, 'magenta interior hole should be removed')
}

function testDetailedArtworkNotGridPunched(): void {
  const image = createImage(120, 160)
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const index = (y * image.width + x) * 4
      image.data[index] = 140 + ((x * 7 + y * 3) % 40)
      image.data[index + 1] = 90 + ((x * 5 + y * 11) % 30)
      image.data[index + 2] = 40 + ((x * 3 + y * 7) % 20)
      image.data[index + 3] = 255
    }
  }

  const before = countOpaque(image)
  isolateArtwork(image)
  assert(
    countOpaque(image) >= before * 0.92,
    'detailed bronze artwork must not be punched with a transparency grid',
  )
}

function testLaserBlackFillsStaySolid(): void {
  const image = createImage(120, 90)
  fillRect(image, 0, 0, 120, 90, 255, 0, 255)
  fillRect(image, 20, 12, 80, 66, 8, 8, 8)
  fillRect(image, 44, 28, 28, 28, 255, 0, 255)

  isolateArtwork(image)

  const fill = sample(image, 28, 18)
  const hole = sample(image, 56, 40)
  const bg = sample(image, 4, 4)
  assert(fill.a > 200 && fill.r < 20, 'solid black laser fills must stay opaque')
  assert(hole.a < 20, 'magenta holes inside black artwork should be removed')
  assert(bg.a < 20, 'magenta background around laser art should be removed')
}

function testGeminiRosePinkBackgroundRemoved(): void {
  const image = createImage(120, 90)
  fillRect(image, 0, 0, 120, 90, 209, 35, 116)
  fillRect(image, 28, 16, 64, 58, 8, 8, 8)
  fillRect(image, 48, 32, 22, 22, 209, 35, 116)

  isolateArtwork(image)

  const fill = sample(image, 36, 24)
  const hole = sample(image, 56, 40)
  const bg = sample(image, 4, 4)
  assert(fill.a > 200 && fill.r < 20, 'black artwork on Gemini rose-pink must stay solid')
  assert(hole.a < 20, 'rose-pink interior holes must be keyed out')
  assert(bg.a < 20, 'Gemini rose-pink background must be keyed out')
}

function testDarkUvBodyStaysSolid(): void {
  const image = createImage(100, 80)
  fillRect(image, 0, 0, 100, 80, 255, 0, 255)
  fillRect(image, 22, 10, 56, 60, 28, 22, 18)
  fillRect(image, 36, 22, 28, 18, 196, 140, 48)

  isolateArtwork(image)

  const body = sample(image, 28, 16)
  const gold = sample(image, 48, 30)
  assert(body.a > 200 && body.r < 50, 'dark UV fills must not be eaten as background')
  assert(gold.a > 200 && gold.r > 150, 'gold details should remain')
}

const tests = [
  ['white plate with red design', testWhitePlateWithRedDesign],
  ['transparent design unchanged', testTransparentDesignUnchanged],
  ['source subtraction keeps artwork', testSourceSubtractionKeepsArtwork],
  ['white artwork on white object kept', testWhiteArtworkOnWhiteObjectKept],
  ['full canvas white background', testFullCanvasWhiteBackground],
  ['magenta background removed', testMagentaBackgroundRemoved],
  ['magenta interior hole removed', testMagentaInteriorHoleRemoved],
  ['colorful checker design kept', testColorfulCheckerDesignKept],
  ['detailed artwork not grid punched', testDetailedArtworkNotGridPunched],
  ['laser black fills stay solid', testLaserBlackFillsStaySolid],
  ['gemini rose-pink background removed', testGeminiRosePinkBackgroundRemoved],
  ['dark uv body stays solid', testDarkUvBodyStaysSolid],
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
