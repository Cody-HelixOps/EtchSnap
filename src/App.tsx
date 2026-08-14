import { useCallback, useState } from 'react'
import { ImageSelector } from './components/ImageSelector'
import { generateDesign } from './lib/gemini'
import {
  cropPathToBase64,
  downloadDataUrl,
  downloadText,
  getPathBounds,
  loadImageFromFile,
} from './lib/imageUtils'
import { pngToSvg } from './lib/svgUtils'
import type { OutputMode, SelectionPath } from './types'
import './App.css'

const API_KEY_STORAGE = 'etchsnap-gemini-api-key'

function App() {
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const [apiKey, setApiKey] = useState(
    () => localStorage.getItem(API_KEY_STORAGE) ?? '',
  )
  const [showApiKey, setShowApiKey] = useState(false)
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [selection, setSelection] = useState<SelectionPath | null>(null)
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState<OutputMode>('uv')
  const [resultDataUrl, setResultDataUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isExportingSvg, setIsExportingSvg] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDisplaySizeChange = useCallback(
    (size: { width: number; height: number }) => setDisplaySize(size),
    [],
  )

  const canGenerate =
    apiKey.trim().length > 0 &&
    sourceImage &&
    selection?.closed &&
    displaySize.width > 0 &&
    description.trim().length > 0 &&
    !isGenerating

  const handleApiKeyChange = (value: string) => {
    setApiKey(value)
    localStorage.setItem(API_KEY_STORAGE, value)
  }

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const image = await loadImageFromFile(file)
      setSourceImage(image)
      setFileName(file.name)
      setSelection(null)
      setResultDataUrl(null)
      setError(null)
    } catch {
      setError('Could not load that image. Try a JPG or PNG file.')
    }
  }

  const handleGenerate = async () => {
    if (!canGenerate || !sourceImage || !selection) return

    setIsGenerating(true)
    setError(null)
    setResultDataUrl(null)

    try {
      const { base64, mimeType } = cropPathToBase64(
        sourceImage,
        selection,
        displaySize.width,
        displaySize.height,
      )

      const dataUrl = await generateDesign({
        apiKey: apiKey.trim(),
        croppedImageBase64: base64,
        mimeType,
        description: description.trim(),
        mode,
      })

      setResultDataUrl(dataUrl)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Generation failed. Please try again.'
      setError(message)
    } finally {
      setIsGenerating(false)
    }
  }

  const baseFileName = fileName?.replace(/\.[^.]+$/, '') ?? 'etchsnap-design'

  const handleDownloadPng = () => {
    if (!resultDataUrl) return
    downloadDataUrl(resultDataUrl, `${baseFileName}-${mode}.png`)
  }

  const handleDownloadSvg = async () => {
    if (!resultDataUrl) return

    setIsExportingSvg(true)
    setError(null)

    try {
      const svg = await pngToSvg(resultDataUrl, mode)
      downloadText(svg, `${baseFileName}-${mode}.svg`, 'image/svg+xml')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'SVG export failed. Please try again.'
      setError(message)
    } finally {
      setIsExportingSvg(false)
    }
  }

  const selectionBounds = selection ? getPathBounds(selection.points) : null

  return (
    <div className="app">
      <header className="header">
        <div>
          <p className="eyebrow">UV print & laser engraving</p>
          <h1>EtchSnap</h1>
          <p className="subtitle">
            Upload a top-down photo, click around the edges to outline your surface,
            describe your design, and download a transparent PNG or vector SVG ready
            for production.
          </p>
        </div>
      </header>

      <main className="layout">
        <section className="panel">
          <div className="panel-header">
            <h2>1. Source photo & area</h2>
            <label className="upload-button">
              {sourceImage ? 'Replace photo' : 'Upload photo'}
              <input type="file" accept="image/*" hidden onChange={handleUpload} />
            </label>
          </div>

          <div className="image-stage">
            <ImageSelector
              image={sourceImage}
              selection={selection}
              onSelectionChange={setSelection}
              onDisplaySizeChange={handleDisplaySizeChange}
            />
          </div>

          {selectionBounds && (
            <p className="selection-meta">
              Traced shape: {selection?.points.length ?? 0} points · approx.{' '}
              {Math.round(selectionBounds.width)} × {Math.round(selectionBounds.height)} px
            </p>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>2. Design settings</h2>
          </div>

          <label className="field">
            <span>Gemini API key</span>
            <div className="api-key-row">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(event) => handleApiKeyChange(event.target.value)}
                placeholder="AIza..."
                autoComplete="off"
              />
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowApiKey((value) => !value)}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <small>
              Stored locally in your browser only. Get a key from{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
              >
                Google AI Studio
              </a>
              .
            </small>
          </label>

          <label className="field">
            <span>Design description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={5}
              placeholder="Example: Art deco floral border with the initials C.M. in the center, elegant and symmetrical."
            />
          </label>

          <fieldset className="mode-toggle">
            <legend>Output mode</legend>
            <label className={`mode-option ${mode === 'uv' ? 'active' : ''}`}>
              <input
                type="radio"
                name="mode"
                value="uv"
                checked={mode === 'uv'}
                onChange={() => setMode('uv')}
              />
              <div>
                <strong>Full color</strong>
                <span>For UV printing</span>
              </div>
            </label>
            <label className={`mode-option ${mode === 'laser' ? 'active' : ''}`}>
              <input
                type="radio"
                name="mode"
                value="laser"
                checked={mode === 'laser'}
                onChange={() => setMode('laser')}
              />
              <div>
                <strong>Black & white</strong>
                <span>For laser engraving</span>
              </div>
            </label>
          </fieldset>

          <button
            type="button"
            className="primary-button"
            disabled={!canGenerate}
            onClick={handleGenerate}
          >
            {isGenerating ? 'Generating design…' : 'Generate transparent design'}
          </button>

          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel result-panel">
          <div className="panel-header">
            <h2>3. Download</h2>
            {resultDataUrl && (
              <div className="download-actions">
                <button type="button" className="ghost-button" onClick={handleDownloadPng}>
                  Download PNG
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={isExportingSvg}
                  onClick={handleDownloadSvg}
                >
                  {isExportingSvg ? 'Creating SVG…' : 'Download SVG'}
                </button>
              </div>
            )}
          </div>

          <div className="result-frame">
            {resultDataUrl ? (
              <img src={resultDataUrl} alt="Generated design preview" />
            ) : (
              <div className="result-placeholder">
                <p>Your transparent design preview will appear here.</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
