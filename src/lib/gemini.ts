import { GoogleGenAI, Modality } from '@google/genai'
import type { GenerateRequest } from '../types'
import { looksLikeStencilEdit, prepareEditTemplate, countStencilRegions } from './fitToMask'
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

async function generateImage(
  ai: GoogleGenAI,
  model: string,
  templateBase64: string,
  prompt: string,
): Promise<string> {
  const response = await ai.models.generateContent({
    model,
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
          { text: prompt },
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

  return imagePart.inlineData.data
}

export async function generateDesignWithGemini(
  request: GenerateRequest,
): Promise<string> {
  const cropDataUrl = base64ToDataUrl(request.croppedImageBase64, request.mimeType)
  const cropImageData = await imageToImageData(cropDataUrl)
  const template = prepareEditTemplate(cropImageData)
  const regionCount = countStencilRegions(template)
  const templateBase64 = imageDataToDataUrl(
    new ImageData(
      new Uint8ClampedArray(template.data),
      template.width,
      template.height,
    ),
  ).split(',')[1]

  const ai = new GoogleGenAI({ apiKey: request.apiKey })
  const prompt = buildPrompt(
    request.description,
    request.mode,
    request.complexity,
    undefined,
    request.partCount ?? 1,
    true,
    false,
    regionCount,
  )

  let rawBase64 = await generateImage(ai, request.imageModel, templateBase64, prompt)

  try {
    const generated = await imageToImageData(base64ToDataUrl(rawBase64, 'image/png'))
    if (!looksLikeStencilEdit(generated, template)) {
      const retryPrompt = buildPrompt(
        request.description,
        request.mode,
        request.complexity,
        undefined,
        request.partCount ?? 1,
        true,
        true,
        regionCount,
      )
      rawBase64 = await generateImage(ai, request.imageModel, templateBase64, retryPrompt)
    }
  } catch {
    // Keep the first image if the retry path cannot decode/score it.
  }

  return postProcessDesign(
    rawBase64,
    request.mode,
    request.croppedImageBase64,
  )
}
