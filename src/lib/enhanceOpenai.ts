import type { EnhanceDescriptionRequest } from '../types'
import { buildEnhancePrompt } from './enhancePrompt'

interface OpenAiErrorResponse {
  error?: {
    message?: string
  }
}

interface OpenAiChatResponse {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

export async function enhanceDescriptionWithOpenAI(
  request: EnhanceDescriptionRequest,
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.textModel,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: buildEnhancePrompt(request.description, request.mode, request.complexity),
        },
      ],
    }),
  })

  const payload = (await response.json()) as OpenAiChatResponse & OpenAiErrorResponse

  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        'OpenAI request failed. Check your API key, billing, and model access.',
    )
  }

  const text = payload.choices?.[0]?.message?.content?.trim()
  if (!text) {
    throw new Error('OpenAI did not return an enhanced description. Please try again.')
  }

  return text
}
