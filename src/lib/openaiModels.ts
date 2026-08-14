import type { ModelOption } from './geminiModels'

interface OpenAiModel {
  id: string
}

function pickDefault(models: ModelOption[], preferred: string[]): string {
  for (const id of preferred) {
    if (models.some((model) => model.id === id)) return id
  }
  return models[0]?.id ?? preferred[0]
}

export function getDefaultOpenAiTextModel(models: ModelOption[]): string {
  return pickDefault(models, ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-4.1'])
}

export function getDefaultOpenAiImageModel(models: ModelOption[]): string {
  return pickDefault(models, ['gpt-image-1', 'gpt-image-1-mini', 'chatgpt-image-latest'])
}

export async function fetchOpenAiModels(apiKey: string): Promise<{
  textModels: ModelOption[]
  imageModels: ModelOption[]
}> {
  const response = await fetch('https://api.openai.com/v1/models', {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  })

  const payload = await response.json()

  if (!response.ok) {
    throw new Error(payload.error?.message || 'Failed to list OpenAI models.')
  }

  const ids = ((payload.data ?? []) as OpenAiModel[])
    .map((model) => model.id)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))

  const textModels = ids
    .filter(
      (id) =>
        /^gpt-/i.test(id) &&
        !/audio|realtime|transcribe|tts|search|codex|instruct/i.test(id),
    )
    .map((id) => ({ id, label: id }))

  const imageModels = ids
    .filter((id) => /gpt-image|chatgpt-image|dall-e/i.test(id))
    .map((id) => ({ id, label: id }))

  if (textModels.length === 0) {
    textModels.push({ id: 'gpt-4o-mini', label: 'gpt-4o-mini' })
  }

  if (imageModels.length === 0) {
    imageModels.push({ id: 'gpt-image-1', label: 'gpt-image-1' })
  }

  return { textModels, imageModels }
}
