import { GoogleGenAI, Modality } from '@google/genai'
import type { GenerateRequest } from '../types'
import { pickGeminiAspectRatio, geminiAspectRatioValue } from './aspectRatio'
import { createBlankTemplate } from './fitToMask'
import { base64ToDataUrl, loadImageFromDataUrl, postProcessDesign } from './imageUtils'
import { imageDataToDataUrl } from './trimUtils'
import { buildPrompt } from './prompt'

async function imageToImageData(dataUrl: string) {
  const image = await loadImageFromDataUrl(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not create canvas context')
  ctx.drawImage(image, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

export async function generateDesignWithGemini(
  request: GenerateRequest,
): Promise<string> {
  const cropDataUrl = base64ToDataUrl(request.croppedImageBase64, request.mimeType)
  const cropImageData = await imageToImageData(cropDataUrl)
  const aspectRatioLabel = pickGeminiAspectRatio(cropImageData.width, cropImageData.height)
  const aspectRatio = geminiAspectRatioValue(aspectRatioLabel)
  const template = createBlankTemplate(cropImageData, aspectRatio)
  const templateBase64 = imageDataToDataUrl(
    new ImageData(
      new Uint8ClampedArray(template.image.data),
      template.image.width,
      template.image.height,
    ),
  ).split(',')[1]

  const ai = new GoogleGenAI({ apiKey: request.apiKey })

  const response = await ai.models.generateContent({
    model: request.imageModel,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: templateBase64,
            },
          },
          {
            text: buildPrompt(
              request.description,
              request.mode,
              request.complexity,
              undefined,
              request.partCount ?? 1,
            ),
          },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
      imageConfig: { aspectRatio: aspectRatioLabel },
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
    aspectRatio,
  )
}
