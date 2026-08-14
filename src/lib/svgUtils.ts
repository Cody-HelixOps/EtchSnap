import ImageTracer from 'imagetracerjs'
import type { OutputMode } from '../types'
import {
  imageDataToDataUrl,
  loadImageDataFromDataUrl,
  trimImageData,
} from './trimUtils'

const TRACE_PADDING = 2

function hasVectorPaths(svg: string): boolean {
  return /<path[\s>]/i.test(svg)
}

function isLightFill(fill: string): boolean {
  const match = fill.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i)
  if (!match) return false

  const [, r, g, b] = match.map(Number)
  return r >= 235 && g >= 235 && b >= 235
}

function sanitizeSvg(svg: string, width: number, height: number): string {
  const withoutBackgroundPaths = svg.replace(
    /<path\b[^>]*\/>|<path\b[^>]*>[\s\S]*?<\/path>/gi,
    (pathTag) => {
      const fillMatch = pathTag.match(/fill="([^"]+)"/i)
      if (fillMatch && isLightFill(fillMatch[1])) {
        return ''
      }
      return pathTag
    },
  )

  return withoutBackgroundPaths.replace(
    /<svg\b[^>]*>/i,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
  )
}

function createEmbeddedSvg(dataUrl: string, width: number, height: number): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <image href="${dataUrl}" width="${width}" height="${height}" />`,
    '</svg>',
  ].join('\n')
}

function prepareTraceImageData(
  source: ImageData,
  mode: OutputMode,
): ImageData {
  const { width, height, data } = source
  const prepared = new ImageData(width, height)
  const out = prepared.data

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]

    if (alpha < 30) {
      out[i] = 255
      out[i + 1] = 255
      out[i + 2] = 255
      out[i + 3] = 255
      continue
    }

    if (mode === 'laser') {
      const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
      const ink = luminance < 140 ? 0 : 255
      out[i] = ink
      out[i + 1] = ink
      out[i + 2] = ink
      out[i + 3] = 255
    } else {
      out[i] = data[i]
      out[i + 1] = data[i + 1]
      out[i + 2] = data[i + 2]
      out[i + 3] = 255
    }
  }

  return prepared
}

function runTrace(imageData: ImageData, mode: OutputMode): string {
  const options =
    mode === 'laser'
      ? {
          ltres: 0.5,
          qtres: 0.5,
          pathomit: 0,
          colorsampling: 0,
          numberofcolors: 2,
          mincolorratio: 0,
          strokewidth: 0,
          linefilter: true,
          scale: 1,
          roundcoords: 1,
          viewbox: true,
          desc: false,
        }
      : {
          ltres: 1,
          qtres: 1,
          pathomit: 2,
          colorsampling: 2,
          numberofcolors: 16,
          mincolorratio: 0.02,
          strokewidth: 0,
          linefilter: false,
          scale: 1,
          roundcoords: 1,
          viewbox: true,
          desc: false,
        }

  return ImageTracer.imagedataToSVG(imageData, options)
}

export async function pngToSvg(dataUrl: string, mode: OutputMode): Promise<string> {
  const source = await loadImageDataFromDataUrl(dataUrl)
  const trimmed = trimImageData(source, TRACE_PADDING)
  const prepared = prepareTraceImageData(trimmed, mode)
  const { width, height } = prepared

  const tracedSvg = sanitizeSvg(runTrace(prepared, mode), width, height)
  if (hasVectorPaths(tracedSvg)) {
    return tracedSvg
  }

  const posterizedSvg = sanitizeSvg(
    ImageTracer.imagedataToSVG(prepared, 'posterized2'),
    width,
    height,
  )
  if (hasVectorPaths(posterizedSvg)) {
    return posterizedSvg
  }

  const trimmedDataUrl = imageDataToDataUrl(trimmed)
  return createEmbeddedSvg(trimmedDataUrl, width, height)
}
