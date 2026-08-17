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
  aspectRatio?: string,
): string {
  const modeInstructions =
    mode === 'uv'
      ? `Use full vibrant color suitable for UV printing on physical objects.
Keep rich color detail and clean edges.`
      : `Use ONLY pure black (#000000) for all visible design pixels.
Fill every shape, gear, letter, and motif with solid black — no hollow fills, no gray, no gradients.
High-contrast artwork suitable for laser engraving.`

  const aspectLine = aspectRatio
    ? `Canvas aspect ratio: ${aspectRatio}. Compose the artwork to fit this shape.`
    : `Keep the design centered and sized to fit the canvas naturally.`

  return `You are creating standalone printable artwork: a decal / UV print / engraving graphic.

This is NOT a product mockup. The output will be printed or engraved onto a real object later.

Design request: ${description}

${buildComplexityInstructions(complexity)}

${aspectLine}

Output requirements:
- Return ONLY the decorative design artwork itself — pure graphic artwork, nothing else
- Put the artwork on a perfectly uniform solid background of exactly ${CHROMA_KEY.hex} (RGB ${CHROMA_KEY.r}, ${CHROMA_KEY.g}, ${CHROMA_KEY.b})
- Fill EVERY empty area with that same solid ${CHROMA_KEY.hex}, including holes and gaps inside the design
- Do NOT use a transparent background, checkerboard, white, gray, black, or any other backdrop
- Do NOT use ${CHROMA_KEY.hex} anywhere inside the artwork itself — it is only the background key color
- The background must be flat: no noise, no gradient, no texture, no shadows
- CRITICAL: Do NOT depict any physical object, product, packaging, phone, case, tumbler, card, wood, metal, fabric, or photograph
- CRITICAL: Do NOT show the artwork applied onto an item, mockup, or real-world surface
- Do NOT include surface texture, material, shadow, reflection, table, background scenery, or a filled backing plate
- Do NOT add any border, frame, outline, edge decoration, or rectangular boundary around the design
- Do NOT add a stroke or box around the artwork
- Do NOT draw lines that touch or follow the outer edge of the canvas
- Scale the artwork to fill most of the canvas — avoid large empty areas above, below, or beside the design
- Keep the design centered with padding inside the canvas
- ${modeInstructions}`
}
