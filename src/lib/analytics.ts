import type { ImageProvider, OutputMode } from '../types'

interface GoatCounterVars {
  path?: string
  title?: string
  event?: boolean
}

declare global {
  interface Window {
    goatcounter?: {
      count: (vars: GoatCounterVars) => void
    }
  }
}

function trackEvent(path: string, title: string): void {
  window.goatcounter?.count?.({
    path,
    title,
    event: true,
  })
}

export function trackProvider(provider: ImageProvider): void {
  trackEvent(`provider/${provider}`, `Provider ${provider}`)
}

export function trackOutputMode(mode: OutputMode): void {
  trackEvent(`mode/${mode}`, `Mode ${mode}`)
}

export function trackGenerate(provider: ImageProvider, mode: OutputMode): void {
  trackEvent(`generate/${provider}/${mode}`, `Generate ${provider} ${mode}`)
}

export function trackEnhance(provider: ImageProvider, mode: OutputMode): void {
  trackEvent(`enhance/${provider}/${mode}`, `Enhance ${provider} ${mode}`)
}

export function trackDownload(format: 'png' | 'svg', mode: OutputMode): void {
  trackEvent(`download/${format}/${mode}`, `Download ${format} ${mode}`)
}
