export type OutputMode = 'uv' | 'laser'
export type ImageProvider = 'gemini' | 'openai'

export interface Point {
  x: number
  y: number
}

export interface SelectionPath {
  points: Point[]
  closed: boolean
}

export interface Selection {
  regions: SelectionPath[]
}

export type SelectionTool = 'polygon' | 'wand'

export interface GenerateRequest {
  provider: ImageProvider
  apiKey: string
  imageModel: string
  croppedImageBase64: string
  mimeType: string
  description: string
  mode: OutputMode
}

export interface EnhanceDescriptionRequest {
  provider: ImageProvider
  apiKey: string
  textModel: string
  description: string
  mode: OutputMode
}

export const PROVIDER_OPTIONS: Array<{
  id: ImageProvider
  label: string
  keyPlaceholder: string
  keyHelpUrl: string
  keyHelpLabel: string
}> = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    keyPlaceholder: 'AIza...',
    keyHelpUrl: 'https://aistudio.google.com/apikey',
    keyHelpLabel: 'Google AI Studio',
  },
  {
    id: 'openai',
    label: 'OpenAI / ChatGPT',
    keyPlaceholder: 'sk-...',
    keyHelpUrl: 'https://platform.openai.com/api-keys',
    keyHelpLabel: 'OpenAI Platform',
  },
]
