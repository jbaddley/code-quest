import { useEffect, useRef, useState } from 'react'
import type { MazeLevel, ThemeGame } from '../types'
import type { RobotState } from './maze-engine'

interface Props {
  level: MazeLevel
  robot: RobotState
  status: 'idle' | 'running' | 'win' | 'fail'
  /** True once the robot has picked up the key this run — fades the key cell. */
  collectedKey?: boolean
  /** Active theme — drives canvas colours and emoji characters. */
  theme?: Required<ThemeGame>
}

/**
 * Load an SVG as an HTMLImageElement (async). Returns null until ready.
 * Accepts either:
 *   - An inline SVG string (starts with "<svg") → encoded as a data URL
 *   - A URL path (e.g. "/sprites/princess.svg") → loaded directly from the server
 */
function useSvgImage(svg: string | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!svg) { setImg(null); return }
    const el = new Image()
    el.onload = () => setImg(el)
    el.onerror = () => setImg(null)
    const trimmed = svg.trimStart()
    el.src = trimmed.startsWith('<')
      ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(trimmed)
      // Prefix absolute paths with Vite's BASE_URL so sprites load correctly
      // on GitHub Pages (where the app is served under /code-quest/).
      : trimmed.startsWith('/')
        ? import.meta.env.BASE_URL.replace(/\/$/, '') + trimmed
        : trimmed
    return () => { el.onload = null; el.onerror = null }
  }, [svg])
  return img
}

const PADDING = 12
const MIN_CELL = 24

export function MazeCanvas({ level, robot, status, collectedKey, theme }: Props) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // Pre-load the SVG sprite image; null until the image has decoded.
  const robotImg = useSvgImage(theme?.robotSvg)
  // Available square size derived from the wrapper. Recomputed on
  // ResizeObserver ticks so the canvas always fits its container — without
  // this, larger levels (e.g. 7×7) overflowed the fixed-width Game panel.
  const [available, setAvailable] = useState(360)

  // Observe the wrapper for size changes. We pick the smaller of width/height
  // so the maze is always fully visible inside its panel.
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setAvailable(Math.max(0, Math.min(width, height)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rows = level.grid.length
    const cols = level.grid[0].length
    const longSide = Math.max(rows, cols)

    // Largest cell that fits inside the available square (accounting for padding).
    // No upper bound — the canvas fills whatever space the container gives it.
    const fitCell = (available - PADDING * 2) / longSide
    const cell = Math.max(MIN_CELL, Math.floor(fitCell))

    canvas.width = cols * cell + PADDING * 2
    canvas.height = rows * cell + PADDING * 2

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Resolve theme values (fall back to defaults if no theme provided).
    const wallColor     = theme?.wallColor     ?? '#2c3a5b'
    const floorColor    = theme?.floorColor    ?? '#ffffff'
    const startColor    = theme?.startColor    ?? '#dbeafe'
    const goalColor     = theme?.goalColor     ?? '#fef3c7'
    const gridLineColor = theme?.gridLineColor ?? '#e5e7eb'
    const goalEmoji     = theme?.goalEmoji     ?? '★'
    const keyEmoji      = theme?.keyEmoji      ?? '🔑'
    const robotEmoji    = theme?.robotEmoji    ?? ''

    // Grid
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = PADDING + c * cell
        const y = PADDING + r * cell
        const tile = level.grid[r][c]
        ctx.fillStyle =
          tile === 'wall'  ? wallColor  :
          tile === 'goal'  ? goalColor  :
          tile === 'key'   ? '#fef9c3'  :
          tile === 'start' ? startColor :
          floorColor
        ctx.fillRect(x, y, cell, cell)
        ctx.strokeStyle = gridLineColor
        ctx.lineWidth = 1
        ctx.strokeRect(x, y, cell, cell)

        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        if (tile === 'goal') {
          // Plain Unicode chars (like ★) need a fill colour; emoji are
          // self-coloured but still need an opaque fillStyle so alpha != 0.
          const isPlainChar = goalEmoji.length === 1 && goalEmoji.charCodeAt(0) < 0x2000
          ctx.fillStyle = isPlainChar ? '#f59e0b' : '#000000'
          ctx.font = `${Math.round(cell * 0.46)}px serif`
          ctx.fillText(goalEmoji, x + cell / 2, y + cell / 2)
        } else if (tile === 'key') {
          // Fade the key once collected so the pickup is visible.
          ctx.globalAlpha = collectedKey ? 0.25 : 1
          ctx.font = `${Math.round(cell * 0.5)}px serif`
          ctx.fillText(keyEmoji, x + cell / 2, y + cell / 2)
          ctx.globalAlpha = 1
        }
      }
    }

    // Robot
    const rx = PADDING + robot.col * cell + cell / 2
    const ry = PADDING + robot.row * cell + cell / 2
    ctx.save()
    ctx.translate(rx, ry)

    const rotation =
      robot.dir === 'east'  ? 0 :
      robot.dir === 'south' ? Math.PI / 2 :
      robot.dir === 'west'  ? Math.PI :
      -Math.PI / 2
    ctx.rotate(rotation)

    // Glow tint on win/fail (behind the character, before any drawing).
    if (status === 'win' || status === 'fail') {
      ctx.globalAlpha = 0.30
      ctx.fillStyle = status === 'win' ? '#10b981' : '#ef4444'
      ctx.beginPath()
      ctx.arc(0, 0, cell * 0.42, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    if (robotImg) {
      // SVG sprite scaled to fit the cell, preserving aspect ratio so portrait
      // or landscape images don't get squished. The canvas context is already
      // rotated, so the sprite faces the right direction automatically.
      // robotSvgScale lets a theme compensate for SVGs with extra whitespace.
      const scale = theme?.robotSvgScale ?? 1
      const size = cell * 0.88 * scale
      const nw = robotImg.naturalWidth || size
      const nh = robotImg.naturalHeight || size
      const ar = nw / nh
      const drawW = ar >= 1 ? size : size * ar
      const drawH = ar >= 1 ? size / ar : size
      ctx.drawImage(robotImg, -drawW / 2, -drawH / 2, drawW, drawH)

    } else if (robotEmoji) {
      // Composite rendering: emoji for identity + white chevron for direction.
      // Emoji glyphs have baked-in orientations (🚜 faces left, 🚀 diagonal)
      // so the chevron makes the movement direction unambiguous on all platforms.
      ctx.fillStyle = '#000000' // opaque fill required; emoji ignore colour but respect alpha
      ctx.font = `${Math.round(cell * 0.48)}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(robotEmoji, -cell * 0.04, 0)

      // Direction chevron — always points right (east) in this rotated context.
      const tip  = cell * 0.34
      const back = cell * 0.20
      const half = cell * 0.10
      ctx.fillStyle   = 'rgba(255,255,255,0.92)'
      ctx.strokeStyle = 'rgba(0,0,0,0.28)'
      ctx.lineWidth   = 0.8
      ctx.beginPath()
      ctx.moveTo(tip, 0)
      ctx.lineTo(back, -half)
      ctx.lineTo(back,  half)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

    } else {
      // Default arrow triangle (no theme set).
      ctx.fillStyle = status === 'win' ? '#10b981' : status === 'fail' ? '#ef4444' : '#3a6df0'
      ctx.beginPath()
      ctx.moveTo(cell * 0.35, 0)
      ctx.lineTo(-cell * 0.25, -cell * 0.28)
      ctx.lineTo(-cell * 0.1, 0)
      ctx.lineTo(-cell * 0.25, cell * 0.28)
      ctx.closePath()
      ctx.fill()
    }
    ctx.restore()
  }, [level, robot, status, available, collectedKey, theme, robotImg])

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  )
}
