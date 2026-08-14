import type { GenerateRequest } from '../types'
import { base64ToDataUrl, loadImageFromDataUrl, postProcessDesign } from './imageUtils'
import { buildPrompt } from './prompt'

interface OpenAiErrorResponse {
  error?: {
    message?: string
  }
}

interface OpenAiImageResponse {
  data?: Array<{
    b64_json?: string
  }>
}

function pickOpenAiSize(width: number, height: number): string {
  const ratio = width / height
  if (ratio > 1.2) return '1536x1024'
  if (ratio < 0.8) return '1024x1536'
  return '1024x1024'
}

export async function generateDesignWithOpenAI(
  request: GenerateRequest,
): Promise<string> {
  const reference = await loadImageFromDataUrl(
    base64ToDataUrl(request.croppedImageBase64, request.mimeType),
  )

  const bytes = Uint8Array.from(atob(request.croppedImageBase64), (char) =>
    char.charCodeAt(0),
  )
  const imageBlob = new Blob([bytes], { type: request.mimeType })

  const form = new FormData()
  form.append('model', request.imageModel)
  form.append('image', imageBlob, 'surface-region.png')
  form.append('prompt', buildPrompt(request.description, request.mode))
  form.append('background', 'transparent')
  form.append('output_format', 'png')
  form.append('quality', 'high')
  form.append('size', pickOpenAiSize(reference.naturalWidth, reference.naturalHeight))

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
    },
    body: form,
  })

  const payload = (await response.json()) as OpenAiImageResponse & OpenAiErrorResponse

  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        'OpenAI request failed. Check your API key, billing, and model access.',
    )
  }

  const rawBase64 = payload.data?.[0]?.b64_json
  if (!rawBase64) {
    throw new Error('OpenAI did not return an image. Try adjusting your description or selection.')
  }

  return postProcessDesign(rawBase64, request.mode)
}
