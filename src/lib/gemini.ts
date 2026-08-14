import { GoogleGenAI, Modality } from '@google/genai'
import type { GenerateRequest } from '../types'
import { postProcessDesign } from './imageUtils'
import { buildPrompt } from './prompt'

const IMAGE_MODEL = 'gemini-2.5-flash-image'

export async function generateDesignWithGemini(
  request: GenerateRequest,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: request.apiKey })

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: request.mimeType,
              data: request.croppedImageBase64,
            },
          },
          { text: buildPrompt(request.description, request.mode) },
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
    const textPart = parts.find((part) => part.text)?.text
    throw new Error(
      textPart?.trim() ||
        'Gemini did not return an image. Try adjusting your description or selection.',
    )
  }

  return postProcessDesign(imagePart.inlineData.data, request.mode)
}
