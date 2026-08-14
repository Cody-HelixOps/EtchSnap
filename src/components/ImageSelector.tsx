import { useCallback, useEffect, useRef, useState } from 'react'
import type { Point, SelectionPath, SelectionTool } from '../types'
import { getPathBounds } from '../lib/imageUtils'
import { magicWandSelection } from '../lib/magicWand'

interface ImageSelectorProps {
  image: HTMLImageElement | null
  selection: SelectionPath | null
  onSelectionChange: (selection: SelectionPath | null) => void
  onDisplaySizeChange?: (size: { width: number; height: number }) => void
}

const MIN_POINTS = 3
const MIN_BOUNDS = 24
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

function isValidSelection(path: SelectionPath): boolean {
  if (path.points.length < MIN_POINTS || !path.closed) return false
  const bounds = getPathBounds(path.points)
  return bounds.width >= MIN_BOUNDS && bounds.height >= MIN_BOUNDS
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
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 })
  const [tool, setTool] = useState<SelectionTool>('polygon')
  const [draftPoints, setDraftPoints] = useState<Point[]>([])
  const [hoverPoint, setHoverPoint] = useState<Point | null>(null)
  const [wandTolerance, setWandTolerance] = useState(34)
  const [wandError, setWandError] = useState<string | null>(null)

  const isDrawing = tool === 'polygon' && draftPoints.length > 0
  const activePath: SelectionPath | null = isDrawing
    ? { points: draftPoints, closed: false }
    : selection

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
    const canvas = canvasRef.current
    if (!canvas || !image || displaySize.width === 0) return

    canvas.width = displaySize.width
    canvas.height = displaySize.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, displaySize.width, displaySize.height)
    imageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)

    if (activePath && activePath.points.length > 0) {
      drawPath(
        ctx,
        activePath.points,
        activePath.closed,
        isDrawing ? hoverPoint : null,
        nearStart,
      )
    }
  }, [image, displaySize, activePath, hoverPoint, isDrawing, nearStart])

  const clampPoint = (x: number, y: number): Point => ({
    x: Math.max(0, Math.min(displaySize.width, x)),
    y: Math.max(0, Math.min(displaySize.height, y)),
  })

  const getCanvasPoint = (
    event: React.MouseEvent<HTMLCanvasElement>,
  ): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return clampPoint(event.clientX - rect.left, event.clientY - rect.top)
  }

  const finalizeShape = (points: Point[]) => {
    const closedPath: SelectionPath = { points, closed: true }
    setDraftPoints([])
    setHoverPoint(null)

    if (isValidSelection(closedPath)) {
      onSelectionChange(closedPath)
    } else {
      onSelectionChange(null)
    }
  }

  const handleWandClick = (point: Point) => {
    const imageData = imageDataRef.current
    if (!imageData) {
      setWandError('Could not read the photo pixels. Try uploading again.')
      return
    }

    const points = magicWandSelection(imageData, point.x, point.y, {
      colorTolerance: wandTolerance,
    })

    if (!points) {
      setWandError('Could not detect a surface there. Try another spot or adjust sensitivity.')
      onSelectionChange(null)
      return
    }

    const closedPath: SelectionPath = { points, closed: true }
    if (!isValidSelection(closedPath)) {
      setWandError('That area is too small. Click a larger surface or lower sensitivity.')
      onSelectionChange(null)
      return
    }

    setWandError(null)
    onSelectionChange(closedPath)
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!image) return

    const point = getCanvasPoint(event)

    if (tool === 'wand') {
      handleWandClick(point)
      return
    }

    if (
      draftPoints.length >= MIN_POINTS &&
      distance(point, draftPoints[0]) <= CLOSE_RADIUS
    ) {
      finalizeShape(draftPoints)
      return
    }

    if (selection?.closed && draftPoints.length === 0) {
      onSelectionChange(null)
    }

    setDraftPoints((points) => [...points, point])
  }

  const handleFinish = () => {
    if (draftPoints.length >= MIN_POINTS) {
      finalizeShape(draftPoints)
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
                  min={12}
                  max={72}
                  value={wandTolerance}
                  onChange={(event) => setWandTolerance(Number(event.target.value))}
                />
              </label>
            )}
            <button type="button" className="ghost-button" onClick={handleClear}>
              Clear shape
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
              ? 'Click inside the surface you want. EtchSnap will follow visible color boundaries.'
              : isDrawing
                ? nearStart
                  ? ' Click the first point to close the shape.'
                  : ' Click Finish shape or snap to the first point to close.'
                : ' Click along the edges to place points — lines connect automatically.'}
          </p>
          {wandError && tool === 'wand' && <p className="error">{wandError}</p>}
        </>
      )}
    </div>
  )
}
