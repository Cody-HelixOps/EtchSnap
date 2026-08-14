import { generateDesignWithGemini } from './gemini'
import { generateDesignWithOpenAI } from './openai'
import type { GenerateRequest } from '../types'

export async function generateDesign(request: GenerateRequest): Promise<string> {
  if (request.provider === 'openai') {
    return generateDesignWithOpenAI(request)
  }

  return generateDesignWithGemini(request)
}
