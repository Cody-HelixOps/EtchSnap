import { GoogleGenAI } from '@google/genai'
import type { EnhanceDescriptionRequest } from '../types'
import { buildEnhancePrompt } from './enhancePrompt'

export async function enhanceDescriptionWithGemini(
  request: EnhanceDescriptionRequest,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: request.apiKey })

  const response = await ai.models.generateContent({
    model: request.textModel,
    contents: [
      {
        role: 'user',
        parts: [{ text: buildEnhancePrompt(request.description, request.mode, request.complexity) }],
      },
    ],
    config: {
      temperature: 0.35,
      systemInstruction:
        'You rewrite design ideas into short UV-print and laser-engraving briefs. Keep them as flat printable graphics. Never write illustration, scene, or mockup prompts.',
    },
  })

  const text = response.candidates?.[0]?.content?.parts
    ?.map((part) => part.text)
    .filter(Boolean)
    .join('\n')
    .trim()

  if (!text) {
    throw new Error('Gemini did not return an enhanced description. Please try again.')
  }

  return text
}
