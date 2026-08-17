import { GoogleGenAI, Modality } from '@google/genai'
import type { GenerateRequest } from '../types'
import { pickGeminiAspectRatio, describeAspectRatio } from './aspectRatio'
import { base64ToDataUrl, loadImageFromDataUrl, postProcessDesign } from './imageUtils'
import { buildPrompt } from './prompt'

export async function generateDesignWithGemini(
  request: GenerateRequest,
): Promise<string> {
  const reference = await loadImageFromDataUrl(
    base64ToDataUrl(request.croppedImageBase64, request.mimeType),
  )
  const aspectRatio = pickGeminiAspectRatio(
    reference.naturalWidth,
    reference.naturalHeight,
  )

  const ai = new GoogleGenAI({ apiKey: request.apiKey })

  const response = await ai.models.generateContent({
    model: request.imageModel,
    contents: buildPrompt(
      request.description,
      request.mode,
      request.complexity,
      describeAspectRatio(reference.naturalWidth, reference.naturalHeight),
      request.partCount ?? 1,
    ),
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
      imageConfig: { aspectRatio },
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

  return postProcessDesign(
    imagePart.inlineData.data,
    request.mode,
    request.croppedImageBase64,
  )
}
