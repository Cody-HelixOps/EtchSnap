export type OutputMode = 'uv' | 'laser'

export interface Point {
  x: number
  y: number
}

export interface SelectionPath {
  points: Point[]
  closed: boolean
}

export interface GenerateRequest {
  apiKey: string
  croppedImageBase64: string
  mimeType: string
  description: string
  mode: OutputMode
}
