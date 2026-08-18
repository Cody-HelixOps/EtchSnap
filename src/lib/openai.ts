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

function openAiAspectRatio(size: string): number {
  if (size === '1536x1024') return 1536 / 1024
  if (size === '1024x1536') return 1024 / 1536
  return 1
}

export async function generateDesignWithOpenAI(
  request: GenerateRequest,
): Promise<string> {
  const reference = await loadImageFromDataUrl(
    base64ToDataUrl(request.croppedImageBase64, request.mimeType),
  )

  const prompt = buildPrompt(
    request.description,
    request.mode,
    request.complexity,
    undefined,
    request.partCount ?? 1,
  )
  const size = pickOpenAiSize(reference.naturalWidth, reference.naturalHeight)
  const usesGptImage = /gpt-image/i.test(request.imageModel)

  const body: Record<string, unknown> = {
    model: request.imageModel,
    prompt,
    size,
    n: 1,
  }

  if (usesGptImage) {
    body.background = 'opaque'
    body.output_format = 'png'
    body.quality = 'high'
  } else {
    body.response_format = 'b64_json'
  }

  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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

  return postProcessDesign(
    rawBase64,
    request.mode,
    request.croppedImageBase64,
    openAiAspectRatio(size),
  )
}
