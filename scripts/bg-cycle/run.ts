import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleGenAI, Modality } from '@google/genai'
import { PNG } from 'pngjs'
import { pickGeminiAspectRatio, describeAspectRatio } from '../../src/lib/aspectRatio.ts'
import { removeFrameBorder, stripOuterEdgePixels } from '../../src/lib/borderRemoval.ts'
import { isChromaKeyColor, isMagentaFamily } from '../../src/lib/chromaKey.ts'
import {
  countOpaque,
  isolateArtwork,
  type PixelImage,
} from '../../src/lib/isolateArtwork.ts'
import { buildPrompt } from '../../src/lib/prompt.ts'
import type { OutputMode } from '../../src/types.ts'

const ROOT = dirname(fileURLToPath(import.meta.url))
const OUT = join(ROOT, 'out')
const SQUARE_SIZE = 512

function createSquare(): PixelImage {
  const image: PixelImage = {
    data: new Uint8ClampedArray(SQUARE_SIZE * SQUARE_SIZE * 4),
    width: SQUARE_SIZE,
    height: SQUARE_SIZE,
  }
  for (let y = 0; y < SQUARE_SIZE; y += 1) {
    for (let x = 0; x < SQUARE_SIZE; x += 1) {
      const edge = x < 18 || y < 18 || x >= SQUARE_SIZE - 18 || y >= SQUARE_SIZE - 18
      const i = (y * SQUARE_SIZE + x) * 4
      image.data[i] = edge ? 96 : 196
      image.data[i + 1] = edge ? 78 : 154
      image.data[i + 2] = edge ? 52 : 98
      image.data[i + 3] = 255
    }
  }
  return image
}

function toPng(image: PixelImage): Buffer {
  const png = new PNG({ width: image.width, height: image.height })
  png.data.set(image.data)
  return PNG.sync.write(png)
}

function fromPng(buffer: Buffer): PixelImage {
  const png = PNG.sync.read(buffer)
  return {
    data: new Uint8ClampedArray(png.data),
    width: png.width,
    height: png.height,
  }
}

function clone(image: PixelImage): PixelImage {
  return {
    data: new Uint8ClampedArray(image.data),
    width: image.width,
    height: image.height,
  }
}

function applyLaser(image: PixelImage): void {
  const { data } = image
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) {
      data[i + 3] = 0
      continue
    }
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (isMagentaFamily(r, g, b) || isChromaKeyColor(r, g, b)) {
      data[i + 3] = 0
      continue
    }
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    const ink = luminance < 140 ? 0 : 255
    data[i] = ink
    data[i + 1] = ink
    data[i + 2] = ink
    data[i + 3] = ink === 255 ? 0 : 255
  }
}

function postProcess(raw: PixelImage, source: PixelImage, mode: OutputMode): PixelImage {
  const image = clone(raw)
  isolateArtwork(image, source)
  for (let pass = 0; pass < 3; pass += 1) {
    if (!removeFrameBorder(image)) break
  }
  stripOuterEdgePixels(image, 2)
  if (mode === 'laser') applyLaser(image)
  return image
}

function analyze(label: string, image: PixelImage): Record<string, number> {
  const { data, width, height } = image
  const total = width * height
  let transparent = 0
  let magenta = 0
  let lightGray = 0
  let nearWhite = 0
  let darkOpaque = 0
  let colorfulOpaque = 0
  let checkerHits = 0
  let checkerSamples = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      const lum = 0.299 * r + 0.587 * g + 0.114 * b
      const sat = Math.max(r, g, b) - Math.min(r, g, b)

      if (a < 16) {
        transparent += 1
        continue
      }
      if (isChromaKeyColor(r, g, b) || isMagentaFamily(r, g, b)) magenta += 1
      if (lum > 245) nearWhite += 1
      if (sat < 28 && lum > 160 && lum < 245) lightGray += 1
      if (lum < 50) darkOpaque += 1
      if (sat > 40 && lum >= 50) colorfulOpaque += 1

      if (x + 8 < width && y + 8 < height && sat < 30 && lum > 140) {
        const right = ((y * width + x + 8) * 4)
        const down = (((y + 8) * width + x) * 4)
        const diag = (((y + 8) * width + x + 8) * 4)
        if (data[right + 3] > 16 && data[down + 3] > 16 && data[diag + 3] > 16) {
          checkerSamples += 1
          const dRight = Math.hypot(r - data[right], g - data[right + 1], b - data[right + 2])
          const dDiag = Math.hypot(r - data[diag], g - data[diag + 1], b - data[diag + 2])
          if (dRight > 18 && dDiag < 14) checkerHits += 1
        }
      }
    }
  }

  const stats = {
    transparentPct: +(100 * transparent / total).toFixed(1),
    magentaPct: +(100 * magenta / total).toFixed(1),
    lightGrayPct: +(100 * lightGray / total).toFixed(1),
    nearWhitePct: +(100 * nearWhite / total).toFixed(1),
    darkOpaquePct: +(100 * darkOpaque / total).toFixed(1),
    colorfulOpaquePct: +(100 * colorfulOpaque / total).toFixed(1),
    opaqueCount: countOpaque(image),
    checkerScore: checkerSamples ? +(checkerHits / checkerSamples).toFixed(3) : 0,
  }
  console.log(`\n${label}`, stats)
  return stats
}

async function pickImageModel(apiKey: string): Promise<string> {
  const preferred = [
    'gemini-2.5-flash-image',
    'gemini-3.1-flash-image',
    'gemini-3-pro-image',
  ]
  const url = new URL('https://generativelanguage.googleapis.com/v1beta/models')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('pageSize', '100')
  const response = await fetch(url)
  const payload = (await response.json()) as {
    error?: { message?: string }
    models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>
  }
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Failed to list Gemini models')
  }
  const ids = (payload.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
    .map((model) => (model.name ?? '').replace(/^models\//, ''))
    .filter((id) => /image|imagen/i.test(id))
  const chosen = preferred.find((id) => ids.includes(id)) ?? ids[0]
  if (!chosen) throw new Error('No Gemini image model available for this key')
  console.log('Using image model:', chosen)
  return chosen
}

async function generateRaw(
  ai: GoogleGenAI,
  model: string,
  prompt: string,
  aspectRatio: string,
): Promise<PixelImage> {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
      imageConfig: { aspectRatio },
    },
  })
  const parts = response.candidates?.[0]?.content?.parts ?? []
  const imagePart = parts.find((part) => part.inlineData?.data)
  if (!imagePart?.inlineData?.data) {
    const text = parts.find((part) => part.text)?.text
    throw new Error(text?.trim() || 'Gemini did not return an image')
  }
  return fromPng(Buffer.from(imagePart.inlineData.data, 'base64'))
}

async function runMode(
  ai: GoogleGenAI,
  model: string,
  source: PixelImage,
  mode: OutputMode,
): Promise<void> {
  const description =
    mode === 'uv'
      ? 'A simple bold steampunk gear emblem in gold and bronze, solid filled shapes, no scene, no object.'
      : 'A simple bold steampunk gear emblem, solid filled black shapes, no scene, no object.'
  const prompt = buildPrompt(
    description,
    mode,
    40,
    describeAspectRatio(source.width, source.height),
  )
  const aspectRatio = pickGeminiAspectRatio(source.width, source.height)
  console.log(`\n=== Generating ${mode} ===`)
  const raw = await generateRaw(ai, model, prompt, aspectRatio)
  writeFileSync(join(OUT, `${mode}-raw.png`), toPng(raw))
  analyze(`${mode} RAW`, raw)

  const processed = postProcess(raw, source, mode)
  writeFileSync(join(OUT, `${mode}-processed.png`), toPng(processed))
  analyze(`${mode} PROCESSED`, processed)
}

function processExisting(source: PixelImage, mode: OutputMode): void {
  const rawPath = join(OUT, `${mode}-raw.png`)
  if (!existsSync(rawPath)) {
    throw new Error(`Missing ${rawPath}. Run a full generate cycle first.`)
  }
  const raw = fromPng(readFileSync(rawPath))
  console.log(`\n=== Reprocessing ${mode} ===`)
  analyze(`${mode} RAW`, raw)
  const processed = postProcess(raw, source, mode)
  writeFileSync(join(OUT, `${mode}-processed.png`), toPng(processed))
  analyze(`${mode} PROCESSED`, processed)
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true })
  const source = createSquare()
  writeFileSync(join(OUT, 'square.png'), toPng(source))

  if (process.argv.includes('--process-only')) {
    processExisting(source, 'uv')
    processExisting(source, 'laser')
    console.log(`\nReprocessed outputs in ${OUT}`)
    return
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY is required')

  const model = await pickImageModel(apiKey)
  const ai = new GoogleGenAI({ apiKey })
  await runMode(ai, model, source, 'uv')
  await runMode(ai, model, source, 'laser')
  console.log(`\nWrote outputs to ${OUT}`)
}

await main()
