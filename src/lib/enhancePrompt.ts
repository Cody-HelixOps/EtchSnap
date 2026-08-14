import type { OutputMode } from '../types'

export function buildEnhancePrompt(description: string, mode: OutputMode): string {
  const modeContext =
    mode === 'uv'
      ? 'full-color UV printing on a physical object surface'
      : 'black-and-white laser engraving on a physical object surface'

  return `You help users write detailed design prompts for AI image generation used in ${modeContext}.

The user gave a brief design idea:
"${description}"

Expand it into a clear, vivid design description (2-4 sentences) that preserves their intent while adding useful visual detail such as style, composition, motifs, line weight, and mood.

Rules:
- Keep the same subject and intent as the user's brief idea
- Do NOT add borders, frames, or edge decorations to the design
- Do NOT mention transparent backgrounds or file formats
- Do NOT use markdown, bullet points, numbering, or labels
- Return ONLY the enhanced description text`
}
