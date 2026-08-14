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
