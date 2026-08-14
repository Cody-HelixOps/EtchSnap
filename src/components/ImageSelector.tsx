import { useCallback, useEffect, useRef, useState } from 'react'
import type { Point, Selection, SelectionPath, SelectionTool } from '../types'
import { isValidRegion } from '../lib/imageUtils'
import { getMagicWandEdgeThreshold, magicWandSelection } from '../lib/magicWand'

interface ImageSelectorProps {
  image: HTMLImageElement | null
  selection: Selection | null
  onSelectionChange: (selection: Selection | null) => void
  onDisplaySizeChange?: (size: { width: number; height: number }) => void
}

const MIN_POINTS = 3
const CLOSE_RADIUS = 14

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  closed: boolean,
  hoverPoint?: Point | null,
  nearStart = false,
): void {
  if (points.length === 0) return

  if (points.length >= 2) {
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    if (closed) ctx.closePath()

    if (closed) {
      ctx.fillStyle = 'rgba(99, 102, 241, 0.18)'
      ctx.fill()
    }

    ctx.strokeStyle = '#818cf8'
    ctx.lineWidth = 2
    ctx.setLineDash(closed ? [] : [6, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

  if (!closed && points.length > 0 && hoverPoint) {
    ctx.beginPath()
    ctx.moveTo(points[points.length - 1].x, points[points.length - 1].y)
    ctx.lineTo(hoverPoint.x, hoverPoint.y)
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.55)'
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.setLineDash([])
  }

  if (!closed) {
    points.forEach((point, index) => {
      const isStart = index === 0
      const radius = isStart && nearStart ? 8 : isStart ? 6 : 4
      ctx.beginPath()
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2)
      ctx.fillStyle = isStart ? '#c4b5fd' : '#818cf8'
      ctx.fill()
      ctx.strokeStyle = '#eef2ff'
      ctx.lineWidth = 1.5
      ctx.stroke()
    })
  }
}

export function ImageSelector({
  image,
  selection,
  onSelectionChange,
  onDisplaySizeChange,
}: ImageSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageDataRef = useRef<ImageData | null>(null)
  const shiftHeldRef = useRef(false)
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const [tool, setTool] = useState<SelectionTool>('polygon')
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null)
  const [wandTolerance, setWandTolerance] = useState(24)
  const [wandError, setWandError] = useState<string | null>(null)

  const isDrawing = tool === 'polygon' && draftPoints.length > 0
  const regionCount = selection?.regions.length ?? 0

  const nearStart =
    isDrawing &&
    draftPoints.length >= MIN_POINTS &&
    hoverPoint !== null &&
    distance(hoverPoint, draftPoints[0]) <= CLOSE_RADIUS

  const updateDisplaySize = useCallback(() => {
    if (!image || !containerRef.current) return

    const maxWidth = containerRef.current.clientWidth
    const scale = Math.min(1, maxWidth / image.naturalWidth)
    const next = {
      width: Math.round(image.naturalWidth * scale),
      height: Math.round(image.naturalHeight * scale),
    }
    setDisplaySize(next)
    onDisplaySizeChange?.(next)
  }, [image, onDisplaySizeChange])

  useEffect(() => {
    updateDisplaySize()
    window.addEventListener('resize', updateDisplaySize)
    return () => window.removeEventListener('resize', updateDisplaySize)
  }, [updateDisplaySize])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') shiftHeldRef.current = true
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') shiftHeldRef.current = false
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image || displaySize.width === 0) return

    canvas.width = displaySize.width
    canvas.height = displaySize.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, displaySize.width, displaySize.height)
    imageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)

    selection?.regions.forEach((region) => {
      if (region.points.length > 0) {
        drawPath(ctx, region.points, region.closed)
      }
    })

    if (isDrawing && draftPoints.length > 0) {
      drawPath(ctx, draftPoints, false, hoverPoint, nearStart)
    }
  }, [image, displaySize, selection, draftPoints, hoverPoint, isDrawing, nearStart])

  const clampPoint = (x: number, y: number): Point => ({
    x: Math.max(0, Math.min(displaySize.width, x)),
    y: Math.max(0, Math.min(displaySize.height, y)),
  })

  const getCanvasPoint = (
    event: React.MouseEvent<HTMLCanvasElement>,
  ): Point => {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return clampPoint(
      (event.clientX - rect.left) * scaleX,
      (event.clientY - rect.top) * scaleY,
    )
  }

  const applyRegion = (closedPath: SelectionPath, append: boolean) => {
    if (!isValidRegion(closedPath)) {
      if (!append) onSelectionChange(null)
      return false
    }

    if (append && selection?.regions.length) {
      onSelectionChange({ regions: [...selection.regions, closedPath] })
    } else {
      onSelectionChange({ regions: [closedPath] })
    }

    return true
  }

  const finalizeShape = (points: Point[], append: boolean) => {
    const closedPath: SelectionPath = { points, closed: true }
    setDraftPoints([])
    setHoverPoint(null)
    applyRegion(closedPath, append)
  }

  const handleWandClick = (point: Point, append: boolean) => {
    const imageData = imageDataRef.current
    if (!imageData) {
      setWandError('Could not read the photo pixels. Try uploading again.')
      return
    }

    const points = magicWandSelection(imageData, point.x, point.y, {
      colorTolerance: wandTolerance,
      edgeThreshold: getMagicWandEdgeThreshold(wandTolerance),
    })

    if (!points) {
      setWandError(
        'Could not detect a bounded surface there. Click the object itself (not the pegboard/background), or adjust sensitivity.',
      )
      if (!append) onSelectionChange(null)
      return
    }

    const closedPath: SelectionPath = { points, closed: true }
    if (!applyRegion(closedPath, append)) {
      setWandError('That area is too small. Click a larger surface or lower sensitivity.')
      return
    }

    setWandError(null)
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image) return

    const point = getCanvasPoint(event)
    const append = event.shiftKey || shiftHeldRef.current

    if (tool === 'wand') {
      handleWandClick(point, append)
      return
    }

    if (
      draftPoints.length >= MIN_POINTS &&
      distance(point, draftPoints[0]) <= CLOSE_RADIUS
    ) {
      finalizeShape(draftPoints, append)
      return
    }

    if (regionCount > 0 && draftPoints.length === 0 && !append) {
      onSelectionChange(null)
    }

    setDraftPoints((points) => [...points, point])
  }

  const handleFinish = () => {
    if (draftPoints.length >= MIN_POINTS) {
      finalizeShape(draftPoints, shiftHeldRef.current)
    }
  }

  const handleUndo = () => {
    setDraftPoints((points) => points.slice(0, -1))
  }

  const handleClear = () => {
    setDraftPoints([])
    setHoverPoint(null)
    setWandError(null)
    onSelectionChange(null)
  }

  const handleToolChange = (nextTool: SelectionTool) => {
    setTool(nextTool)
    setDraftPoints([])
    setHoverPoint(null)
    setWandError(null)
  }

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image || !isDrawing) return
    setHoverPoint(getCanvasPoint(event))
  }

  const handleMouseLeave = () => {
    setHoverPoint(null)
  }

  return (
    <div className="image-selector" ref={containerRef}>
      {!image ? (
        <div className="image-placeholder">
          <p>Upload a top-down photo to begin</p>
          <span>Outline the surface manually or use the magic wand on visible edges</span>
        </div>
      ) : (
        <>
          <div className="selector-toolbar">
            <div className="tool-toggle">
              <button
                type="button"
                className={`ghost-button tool-button${tool === 'polygon' ? ' active' : ''}`}
                onClick={() => handleToolChange('polygon')}
              >
                Outline
              </button>
              <button
                type="button"
                className={`ghost-button tool-button${tool === 'wand' ? ' active' : ''}`}
                onClick={() => handleToolChange('wand')}
              >
                Magic wand
              </button>
            </div>
            {tool === 'polygon' ? (
              <>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={!isDrawing}
                  onClick={handleUndo}
                >
                  Undo point
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={draftPoints.length < MIN_POINTS}
                  onClick={handleFinish}
                >
                  Finish shape
                </button>
              </>
            ) : (
              <label className="wand-sensitivity">
                <span>Sensitivity</span>
                <input
                  type="range"
                  min={8}
                  max={48}
                  value={wandTolerance}
                  onChange={(event) => setWandTolerance(Number(event.target.value))}
                />
              </label>
            )}
            <button type="button" className="ghost-button" onClick={handleClear}>
              Clear {regionCount > 1 ? 'all' : 'selection'}
            </button>
          </div>
          <canvas
            ref={canvasRef}
            className={`selection-canvas${tool === 'wand' ? ' wand-cursor' : ''}`}
            style={{ width: displaySize.width, height: displaySize.height }}
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
          <p className="canvas-hint">
            {tool === 'wand'
              ? 'Click a surface to select it. Hold Shift and click to add another region.'
              : isDrawing
                ? nearStart
                  ? ' Click the first point to close the shape. Hold Shift while closing to add another region.'
                  : ' Click Finish shape or snap to the first point to close. Hold Shift to keep existing regions.'
                : ' Click along the edges to place points. Hold Shift when starting a new shape to add another region.'}
          </p>
          {wandError && tool === 'wand' && <p className="error">{wandError}</p>}
        </>
      )}
    </div>
  )
}
