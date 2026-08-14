export interface ModelOption {
  id: string
  label: string
}

interface GoogleModel {
  name: string
  displayName?: string
  description?: string
  supportedGenerationMethods?: string[]
}

function normalizeModelId(name: string): string {
  return name.replace(/^models\//, '')
}

function isImageModel(model: GoogleModel): boolean {
  const id = normalizeModelId(model.name)
  const description = model.description?.toLowerCase() ?? ''

  return (
    /image|imagen|banana/i.test(id) ||
    description.includes('image generation') ||
    description.includes('generate images') ||
    description.includes('image output')
  )
}

function isTextModel(model: GoogleModel): boolean {
  const id = normalizeModelId(model.name)

  if (isImageModel(model)) return false
  if (!/gemini|gemma/i.test(id)) return false
  if (/embedding|embed|aqa|veo|lyria|robotics|tts|live|tts/i.test(id)) return false

  return true
}

function toOption(model: GoogleModel): ModelOption {
  const id = normalizeModelId(model.name)
  return {
    id,
    label: model.displayName?.trim() || id,
  }
}

function pickDefault(
  models: ModelOption[],
  preferred: string[],
): string {
  for (const id of preferred) {
    if (models.some((model) => model.id === id)) return id
  }
  return models[0]?.id ?? preferred[0]
}

export function getDefaultGeminiTextModel(models: ModelOption[]): string {
  return pickDefault(models, [
    'gemini-2.5-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-2.5-flash-lite',
  ])
}

export function getDefaultGeminiImageModel(models: ModelOption[]): string {
  return pickDefault(models, [
    'gemini-2.5-flash-image',
    'gemini-3.1-flash-image',
    'gemini-3-pro-image',
  ])
}

export async function fetchGeminiModels(apiKey: string): Promise<{
  textModels: ModelOption[]
  imageModels: ModelOption[]
}> {
  const models: GoogleModel[] = []
  let pageToken: string | undefined

  do {
    const url = new URL('https://generativelanguage.googleapis.com/v1beta/models')
    url.searchParams.set('key', apiKey)
    url.searchParams.set('pageSize', '100')
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const response = await fetch(url)
    const payload = await response.json()

    if (!response.ok) {
      throw new Error(payload.error?.message || 'Failed to list Gemini models.')
    }

    models.push(...(payload.models ?? []))
    pageToken = payload.nextPageToken
  } while (pageToken)

  const generateContentModels = models.filter((model) =>
    model.supportedGenerationMethods?.includes('generateContent'),
  )

  const textModels = generateContentModels
    .filter(isTextModel)
    .map(toOption)
    .sort((a, b) => a.label.localeCompare(b.label))

  const imageModels = generateContentModels
    .filter(isImageModel)
    .map(toOption)
    .sort((a, b) => a.label.localeCompare(b.label))

  if (textModels.length === 0 && imageModels.length === 0) {
    throw new Error('No usable Gemini models were returned for this API key.')
  }

  return { textModels, imageModels }
}
