import type { OutputMode } from '../types'
import { CHROMA_KEY } from './chromaKey.ts'

export function getComplexityLabel(complexity: number): string {
  if (complexity <= 20) return 'Simple'
  if (complexity <= 40) return 'Light'
  if (complexity <= 60) return 'Balanced'
  if (complexity <= 80) return 'Detailed'
  return 'Complex'
}

export function buildComplexityInstructions(complexity: number): string {
  if (complexity <= 20) {
    return `Design complexity: SIMPLE.
Keep the artwork minimal with few elements, bold clean shapes, and little fine detail.
Avoid ornate patterns, dense textures, or busy backgrounds.`
  }

  if (complexity <= 40) {
    return `Design complexity: LIGHT.
Use a clean, readable design with modest detail and simple supporting elements.
Avoid heavy ornamentation or intricate pattern fills.`
  }

  if (complexity <= 60) {
    return `Design complexity: BALANCED.
Include a moderate level of detail and visual interest without making the design overly busy.
Mix clear focal elements with restrained supporting detail.`
  }

  if (complexity <= 80) {
    return `Design complexity: DETAILED.
Include rich visual detail, layered elements, refined linework, and decorative accents while keeping the design readable.`
  }

  return `Design complexity: COMPLEX.
Create intricate, ornate artwork with fine detail, layered motifs, sophisticated pattern work, and visually dense composition.`
}

export function buildPrompt(
  description: string,
  mode: OutputMode,
  complexity: number,
  _aspectRatio?: string,
  partCount = 1,
): string {
  const modeInstructions =
    mode === 'uv'
      ? `Use full vibrant color suitable for UV printing.
Keep rich color detail and clean edges.`
      : `Use ONLY pure black (#000000) for all visible design pixels.
Fill every shape, letter, and motif with solid black — no gray, no gradients.`

  const partLine =
    partCount > 1
      ? `This artwork will be stamped separately onto ${partCount} similar parts. Compose ONE design that fills a single stencil. Do not draw multiple copies.`
      : ''

  return `You are filling a BLANK STENCIL TEMPLATE with printable artwork.

The attached image is the template:
- The irregular LIGHT/BLANK shape is the ONLY area you may draw in. That shape is the complete canvas.
- ${CHROMA_KEY.hex} magenta is OUTSIDE the stencil. Leave every magenta pixel magenta. Do not paint sky, ground, scenery, or background there.
- Magenta holes inside the blank shape are cutouts (screws, gaps). Leave those magenta.

CRITICAL composition rules:
- Design the artwork TO FIT that blank silhouette, the way a custom inlay or decal is drawn for one specific shape.
- The full subject must live inside the blank shape. Do not generate a rectangular scene, photo, or landscape and then crop it.
- Shrink, stretch, and arrange the subject so it reads as a complete design within that outline.
- Do not let important parts of the subject fall into the magenta.

Design request: ${description}

${buildComplexityInstructions(complexity)}
${partLine}

Output requirements:
- Return the template with artwork painted only in the blank stencil
- Magenta regions must stay exactly ${CHROMA_KEY.hex} (RGB ${CHROMA_KEY.r}, ${CHROMA_KEY.g}, ${CHROMA_KEY.b})
- Do NOT use ${CHROMA_KEY.hex} inside the artwork itself
- Do NOT depict a physical object, product mockup, photograph, table, or surface
- Do NOT add a rectangular border, frame, or box
- ${modeInstructions}`
}
