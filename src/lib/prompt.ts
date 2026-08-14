import type { OutputMode } from '../types'

export function buildPrompt(description: string, mode: OutputMode): string {
  const modeInstructions =
    mode === 'uv'
      ? `Use full vibrant color suitable for UV printing on physical objects.
Keep rich color detail and clean edges.`
      : `Use ONLY pure black (#000000) for all visible design pixels.
No gray, no gradients, no color — high-contrast artwork suitable for laser engraving.`

  return `You are creating printable artwork for a top-down photo of a physical object surface.

The attached image shows the exact surface region where the design will be applied.

Design request: ${description}

Output requirements:
- Return ONLY the decorative design artwork itself
- Place the design on a fully transparent background (alpha channel)
- Do NOT include the object, surface texture, shadows, or photo background
- Do NOT add any border, frame, outline, edge decoration, or rectangular boundary around the design
- Do NOT add a stroke or box around the artwork — the design should fade cleanly to transparent at the edges
- Do NOT draw lines that touch or follow the outer edge of the canvas
- Leave clear transparent margin between the artwork and all four image edges
- Scale the artwork to fill most of the canvas — avoid large empty areas above, below, or beside the design
- The design must not form a closed rectangle around the perimeter of the image
- Match the perspective and proportions of the selected surface area
- Keep the design centered and sized to fit the region naturally with padding inside the canvas
- ${modeInstructions}`
}
