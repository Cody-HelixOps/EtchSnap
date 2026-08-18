import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleGenAI, Modality } from '@google/genai'
import { PNG } from 'pngjs'
import {
  countStencilRegions,
  fitDesignToMask,
  looksLikeStencilEdit,
  prepareEditTemplate,
  stencilRespectScore,
} from '../../src/lib/fitToMask.ts'
import { buildPrompt } from '../../src/lib/prompt.ts'
import type { PixelImage } from '../../src/lib/isolateArtwork.ts'

const ROOT = dirname(fileURLToPath(import.meta.url))
const OUT = join(ROOT, 'out')
const WIDTH = 1024
const HEIGHT = 360

function createImage(width: number, height: number): PixelImage {
  return {
    data: new Uint8ClampedArray(width * height * 4),
    width,
    height,
  }
}

function setPixel(
  image: PixelImage,
  x: number,
  y: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return
  const i = (y * image.width + x) * 4
  image.data[i] = r
  image.data[i + 1] = g
  image.data[i + 2] = b
  image.data[i + 3] = a
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
      setPixel(image, px, py, r, g, b, a)
    }
  }
}

function fillCircle(
  image: PixelImage,
  cx: number,
  cy: number,
  radius: number,
  r: number,
  g: number,
  b: number,
  a = 255,
): void {
  const r2 = radius * radius
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) {
        setPixel(image, x, y, r, g, b, a)
      }
    }
  }
}

function woodTone(x: number, y: number): [number, number, number] {
  const grain = ((x * 13 + y * 7) % 37) - 18
  return [
    Math.max(0, Math.min(255, 148 + grain)),
    Math.max(0, Math.min(255, 108 + grain - 8)),
    Math.max(0, Math.min(255, 62 + grain - 14)),
  ]
}

function paintWood(image: PixelImage, x: number, y: number, width: number, height: number): void {
  for (let py = y; py < y + height; py += 1) {
    for (let px = x; px < x + width; px += 1) {
      const [r, g, b] = woodTone(px, py)
      setPixel(image, px, py, r, g, b)
    }
  }
}

function paintWoodCircle(image: PixelImage, cx: number, cy: number, radius: number): void {
  const r2 = radius * radius
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) {
        const [r, g, b] = woodTone(x, y)
        setPixel(image, x, y, r, g, b)
      }
    }
  }
}

function paintWoodTriangle(
  image: PixelImage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  const minX = Math.max(0, Math.min(x0, x1, x2))
  const maxX = Math.min(image.width - 1, Math.max(x0, x1, x2))
  const minY = Math.max(0, Math.min(y0, y1, y2))
  const maxY = Math.min(image.height - 1, Math.max(y0, y1, y2))
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const d1 = (x - x1) * (y0 - y1) - (x0 - x1) * (y - y1)
      const d2 = (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2)
      const d3 = (x - x0) * (y2 - y0) - (x2 - x0) * (y - y0)
      const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
      const hasPos = d1 > 0 || d2 > 0 || d3 > 0
      if (!(hasNeg && hasPos)) {
        const [r, g, b] = woodTone(x, y)
        setPixel(image, x, y, r, g, b)
      }
    }
  }
}

function createJeepLetterMask(): PixelImage {
  const image = createImage(WIDTH, HEIGHT)
  const top = 48
  const letterH = 260
  const stroke = 54
  const gap = 28
  let x = 36

  // J
  paintWood(image, x + 86, top, stroke, letterH - 40)
  paintWood(image, x, top + letterH - 58, 140, 58)
  paintWood(image, x, top + letterH - 140, stroke, 82)
  x += 160 + gap

  // E
  paintWood(image, x, top, stroke, letterH)
  paintWood(image, x, top, 150, stroke)
  paintWood(image, x, top + (letterH - stroke) / 2, 130, stroke)
  paintWood(image, x, top + letterH - stroke, 150, stroke)
  x += 168 + gap

  // E
  paintWood(image, x, top, stroke, letterH)
  paintWood(image, x, top, 150, stroke)
  paintWood(image, x, top + (letterH - stroke) / 2, 130, stroke)
  paintWood(image, x, top + letterH - stroke, 150, stroke)
  x += 168 + gap

  // P
  paintWood(image, x, top, stroke, letterH)
  paintWood(image, x, top, 150, 150)
  fillCircle(image, x + 86, top + 75, 32, 0, 0, 0, 0)
  x += 168 + gap

  // Irregular shards around the word, like a wand selection
  paintWoodTriangle(image, 8, 20, 48, 8, 40, 70)
  paintWoodTriangle(image, 980, 40, 1020, 90, 940, 120)
  paintWoodTriangle(image, 500, 8, 560, 4, 530, 42)
  paintWoodTriangle(image, 300, 320, 360, 300, 330, 356)
  paintWoodCircle(image, 70, 40, 18)

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

async function pickImageModel(apiKey: string, preferred?: string): Promise<string> {
  const fallback = [
    preferred,
    'gemini-2.5-flash-image',
    'gemini-3.1-flash-image',
    'gemini-3-pro-image',
  ].filter((id): id is string => Boolean(id))

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
    .filter((id) => /image|imagen|banana/i.test(id))
  const chosen = fallback.find((id) => ids.includes(id)) ?? ids[0]
  if (!chosen) throw new Error('No Gemini image model available for this key')
  console.log('Using image model:', chosen)
  return chosen
}

async function generateRaw(
  ai: GoogleGenAI,
  model: string,
  template: PixelImage,
  prompt: string,
): Promise<PixelImage> {
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: toPng(template).toString('base64'),
            },
          },
          { text: prompt },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
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

function saveAttempt(
  name: string,
  template: PixelImage,
  raw: PixelImage,
  mask: PixelImage,
): { ok: boolean; score: ReturnType<typeof stencilRespectScore> } {
  const score = stencilRespectScore(raw, template)
  const ok = looksLikeStencilEdit(raw, template)
  const clipped = fitDesignToMask(raw, mask)
  writeFileSync(join(OUT, `${name}-template.png`), toPng(template))
  writeFileSync(join(OUT, `${name}-raw.png`), toPng(raw))
  writeFileSync(join(OUT, `${name}-clipped.png`), toPng(clipped))
  writeFileSync(
    join(OUT, `${name}-score.json`),
    JSON.stringify({ ok, ...score, rawWidth: raw.width, rawHeight: raw.height }, null, 2),
  )
  console.log(`\n${name}`, { ok, ...score, size: `${raw.width}x${raw.height}` })
  return { ok, score }
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true })
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) throw new Error('GEMINI_API_KEY is required')

  const mask = createJeepLetterMask()
  writeFileSync(join(OUT, 'mask.png'), toPng(mask))
  const template = prepareEditTemplate(mask, 1024)
  const regionCount = countStencilRegions(template)
  console.log('Stencil regions:', regionCount)

  const model = await pickImageModel(apiKey, process.env.GEMINI_IMAGE_MODEL)
  const ai = new GoogleGenAI({ apiKey })

  const attempts: Array<{ name: string; prompt: string }> = [
    {
      name: '10-flash-final',
      prompt: buildPrompt(
        'intricate steampunk mechanical gears, cogs, riveted metal plates, and honeycomb mesh',
        'laser',
        80,
        undefined,
        1,
        true,
        false,
        regionCount,
      ),
    },
  ]

  let passed = false
  for (const attempt of attempts) {
    console.log(`\n=== ${attempt.name} ===`)
    const raw = await generateRaw(ai, model, template, attempt.prompt)
    const result = saveAttempt(attempt.name, template, raw, mask)
    if (result.ok && result.score.respect >= 0.7 && result.score.change >= 0.3) {
      passed = true
    }
  }

  if (!passed) {
    throw new Error('Stencil live test did not get a shape-matched edit')
  }

  console.log(`\nPassed. Outputs in ${OUT}`)
}

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })
await main()
