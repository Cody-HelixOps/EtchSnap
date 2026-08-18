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
  partCount = 1,
): string {
  const modeInstructions =
    mode === 'uv'
      ? `Use full vibrant color suitable for UV printing on physical objects.
Keep rich color detail and clean edges.
The colored artwork must fill this canvas the way a UV decal fills the selected surface.`
      : `Use ONLY pure black (#000000) for all visible design pixels.
Fill every shape, gear, letter, and motif with solid black — no hollow fills, no gray, no gradients.
High-contrast artwork suitable for laser engraving.
CRITICAL: This is a laser decal for a selected surface, not a square logo. The black artwork must fill this canvas shape. Do not output a centered square stamp, badge, or icon unless the canvas itself is square. The black pixels' bounding box should reach near all four edges.`

  const aspectLine = aspectRatio
    ? `Canvas / selected region: ${aspectRatio}`
    : `Fill the canvas. Match the selected region's shape — do not default to a square composition.`

  const silhouetteLine = `A silhouette image is attached.
- White pixels are the EXACT selected surface the design must fill
- Magenta pixels are outside the selection — keep them magenta and do not draw there
- Holes in the white shape (screws, cutouts, gaps) must stay magenta
- The artwork must sit inside that white silhouette and follow its outline
- Scale and compose the design so it fills the white shape, not a rectangle around it`

  const partLine =
    partCount > 1
      ? `This artwork will be stamped separately onto ${partCount} similar parts. Compose ONE design that fills a single part. Do not draw multiple copies, and do not span a gap between parts.`
      : ''

  return `You are creating standalone printable artwork: a decal / UV print / engraving graphic.

This is NOT a product mockup. The output will be printed or engraved onto a real object later.

Design request: ${description}

${buildComplexityInstructions(complexity)}

${aspectLine}
${silhouetteLine}
${partLine}

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
- Do NOT add a rectangular frame, border, or box around the canvas
- The design MAY reach the edge of the white silhouette; do not leave a floating stamp inside it
- Scale the artwork to FILL the white silhouette — occupy most of its width AND height
- Do not leave large empty margins inside the white shape
- Keep the design centered in the silhouette, not as a square motif floating in a rectangle
- ${modeInstructions}`
}
