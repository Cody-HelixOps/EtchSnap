import { enhanceDescriptionWithGemini } from './enhanceGemini'
import { enhanceDescriptionWithOpenAI } from './enhanceOpenai'
import type { EnhanceDescriptionRequest } from '../types'

export async function enhanceDescription(
  request: EnhanceDescriptionRequest,
): Promise<string> {
  if (request.provider === 'openai') {
    return enhanceDescriptionWithOpenAI(request)
  }

  return enhanceDescriptionWithGemini(request)
}
