import { GoogleGenAI, Modality } from '@google/genai'
import type { GenerateRequest } from '../types'
import { pickGeminiAspectRatio, describeAspectRatio } from './aspectRatio'
import { createSilhouetteReference } from './fitToMask'
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
  const silhouette = createSilhouetteReference(cropImageData)
  const silhouetteBase64 = imageDataToDataUrl(
    new ImageData(new Uint8ClampedArray(silhouette.data), silhouette.width, silhouette.height),
  ).split(',')[1]

  const aspectRatio = pickGeminiAspectRatio(cropImageData.width, cropImageData.height)

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
              data: silhouetteBase64,
            },
          },
          {
            text: buildPrompt(
              request.description,
              request.mode,
              request.complexity,
              describeAspectRatio(cropImageData.width, cropImageData.height),
              request.partCount ?? 1,
            ),
          },
        ],
      },
    ],
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
