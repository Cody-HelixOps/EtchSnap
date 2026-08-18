import { CHROMA_KEY } from './chromaKey.ts'
import {
  createBlankTemplate,
  createSilhouetteReference,
  fitDesignToMask,
  layoutBlankTemplate,
  TEMPLATE_CONTENT_SCALE,
} from './fitToMask.ts'
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

function testBlankTemplateLeavesMagentaAroundTheShape(): void {
  const mask = createImage(200, 50)
  fillRect(mask, 0, 0, 200, 50, 255, 255, 255, 255)

  const { image, layout } = createBlankTemplate(mask, 21 / 9)

  assert(image.width / image.height - 21 / 9 < 0.05, 'template canvas should match the model aspect ratio')
  assert(layout.offsetY > 8, 'blank stencil must sit inside magenta margins, not fill the canvas')
  assert(
    mask.width / image.width <= TEMPLATE_CONTENT_SCALE + 0.02,
    'the selected shape should be smaller than the template canvas',
  )
  assert(
    sample(image, 4, 4).r === CHROMA_KEY.r && sample(image, 4, 4).b === CHROMA_KEY.b,
    'template corners must stay magenta',
  )
  const inside = sample(image, layout.offsetX + 20, layout.offsetY + 20)
  assert(inside.r > 240 && inside.g > 240 && inside.b > 240, 'the stencil interior must be a blank fill')
}

function testMappingReadsStencilRegionNotLetterbox(): void {
  const mask = createImage(200, 50)
  fillRect(mask, 0, 0, 200, 50, 255, 255, 255, 255)
  const layout = layoutBlankTemplate(mask.width, mask.height, 21 / 9)
  const generated = createImage(layout.canvasWidth, layout.canvasHeight, 255, 0, 0, 255)
  fillRect(
    generated,
    layout.offsetX,
    layout.offsetY,
    layout.contentWidth,
    layout.contentHeight,
    0,
    80,
    0,
    255,
  )

  const fitted = fitDesignToMask(generated, mask, 21 / 9)
  const pixel = sample(fitted, 100, 25)
  assert(pixel.g > 60 && pixel.r < 40, 'output should come from the stencil region, not the magenta letterbox')
  assert(sample(fitted, 0, 0).a > 200, 'mapped design should still fill the selected mask')
}

function testMaskHolesStayEmpty(): void {
  const mask = createImage(120, 40)
  fillRect(mask, 10, 8, 100, 24, 10, 10, 10, 255)
  fillRect(mask, 55, 16, 10, 8, 0, 0, 0, 0)

  const { image, layout } = createBlankTemplate(mask, 16 / 9)
  const hole = sample(image, layout.offsetX + 60, layout.offsetY + 20)
  assert(
    hole.r === CHROMA_KEY.r && hole.b === CHROMA_KEY.b,
    'cutouts in the selection must stay magenta on the blank template',
  )

  const generated = createImage(layout.canvasWidth, layout.canvasHeight, 0, 0, 0, 255)
  const fitted = fitDesignToMask(generated, mask, 16 / 9)
  assert(fitted.width === 120 && fitted.height === 40, 'fitted design must match the selected crop size')
  assert(sample(fitted, 2, 2).a === 0, 'pixels outside the selection must be transparent')
  assert(sample(fitted, 60, 20).a === 0, 'holes inside the selection must stay transparent')
  assert(sample(fitted, 20, 20).a > 200, 'pixels inside the selection must keep the design')
}

function testSilhouetteUsesMaskShape(): void {
  const mask = createImage(80, 30)
  fillRect(mask, 8, 6, 64, 18, 40, 40, 40, 255)

  const silhouette = createSilhouetteReference(mask)
  const inside = sample(silhouette, 20, 12)
  const outside = sample(silhouette, 1, 1)

  assert(inside.r > 240 && inside.g > 240 && inside.b > 240, 'selected area should be blank in the silhouette')
  assert(
    outside.r === CHROMA_KEY.r && outside.g === CHROMA_KEY.g && outside.b === CHROMA_KEY.b,
    'outside the selection should be chroma key',
  )
}

const tests = [
  ['blank template leaves magenta around the shape', testBlankTemplateLeavesMagentaAroundTheShape],
  ['mapping reads stencil region not letterbox', testMappingReadsStencilRegionNotLetterbox],
  ['mask holes stay empty', testMaskHolesStayEmpty],
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
