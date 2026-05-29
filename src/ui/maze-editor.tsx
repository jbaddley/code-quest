import { useCallback, useEffect, useRef, useState } from 'react'
import type { Cell, Direction, MazeLevel } from '../types'
import { validateLevel } from '../game/maze-solver'

// ── Types ──────────────────────────────────────────────────────────────────

/** Every cell type the student can paint (same as Cell). */
type Tool = Cell

interface ToolMeta {
  label: string
  icon: string
  /** Tailored cursor label shown in the grid */
  hint: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const TOOLS: { type: Tool; meta: ToolMeta }[] = [
  { type: 'empty', meta: { label: 'Floor',  icon: '⬜', hint: 'Open floor' } },
  { type: 'wall',  meta: { label: 'Wall',   icon: '🧱', hint: 'Solid wall' } },
  { type: 'start', meta: { label: 'Start',  icon: '🤖', hint: 'Robot start (one only)' } },
  { type: 'goal',  meta: { label: 'Star',   icon: '⭐', hint: 'Goal star (one only)' } },
  { type: 'key',   meta: { label: 'Key',    icon: '🔑', hint: 'Collectible key' } },
]

// CSS custom property colours per tool type
const TOOL_COLOR: Record<Tool, string> = {
  empty: '#6b7280',
  wall:  '#1f2937',
  start: '#10b981',
  goal:  '#f59e0b',
  key:   '#8b5cf6',
}

const DIR_ARROWS: Record<Direction, string> = {
  north: '↑',
  east:  '→',
  south: '↓',
  west:  '←',
}


/** Preset grid sizes offered in the size picker. */
const PRESETS: { rows: number; cols: number; label: string }[] = [
  { rows: 3, cols: 5,  label: '3×5' },
  { rows: 4, cols: 6,  label: '4×6' },
  { rows: 5, cols: 7,  label: '5×7' },
  { rows: 6, cols: 8,  label: '6×8' },
  { rows: 7, cols: 10, label: '7×10' },
  { rows: 8, cols: 10, label: '8×10' },
  { rows: 10, cols: 12, label: '10×12' },
]

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeGrid(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () => new Array<Cell>(cols).fill('empty'))
}

/** Resize a grid, preserving existing cells where they fit. */
function resizeGrid(prev: Cell[][], newRows: number, newCols: number): Cell[][] {
  return Array.from({ length: newRows }, (_, r) =>
    Array.from({ length: newCols }, (_, c) => prev[r]?.[c] ?? 'empty'),
  )
}

function buildMazeLevel(
  grid: Cell[][],
  startDir: Direction,
  name: string,
): MazeLevel {
  const hasKey = grid.some((row) => row.includes('key'))
  return {
    id: `custom-${Date.now()}`,
    name: name.trim() || 'My Custom Level',
    goal: hasKey
      ? 'Collect the key 🔑 first, then reach the star ⭐!'
      : 'Guide your robot to the star ⭐!',
    grid,
    startDir,
    concepts: ['sequencing', ...(hasKey ? ['conditionals'] : [])],
    maxSteps: 400,
    hints: {
      1: 'Look at the maze — what direction does your robot need to go first?',
      2: 'Trace the path step by step. Count how many moves in each direction.',
      3: 'Break the path into segments: get to each turn one at a time.',
    },
    lesson: {
      concept: 'Custom Challenge',
      explanation:
        'This is a maze you designed yourself! Use everything you know to navigate it.',
      starterQuestions: [
        "What's the very first move your robot needs to make?",
        'How many different directions does your robot turn in this maze?',
        'Can you spot the shortest path from start to the star?',
      ],
      ahaMoment:
        'You designed AND solved your own maze — that makes you both a programmer and a game designer!',
    },
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export interface MazeEditorProps {
  onClose: () => void
  onLoad: (level: MazeLevel) => void
}

export function MazeEditor({ onClose, onLoad }: MazeEditorProps) {
  const [rows, setRows] = useState(5)
  const [cols, setCols] = useState(7)
  const [grid, setGrid] = useState<Cell[][]>(() => makeGrid(5, 7))
  const [tool, setTool] = useState<Tool>('wall')
  const [startDir, setStartDir] = useState<Direction>('east')
  const [levelName, setLevelName] = useState('')
  const isPaintingRef = useRef(false)

  // ── Grid resize ──────────────────────────────────────────────────────────
  const handlePreset = useCallback(
    (r: number, c: number) => {
      setRows(r)
      setCols(c)
      setGrid((prev) => resizeGrid(prev, r, c))
    },
    [],
  )

  // ── Paint ────────────────────────────────────────────────────────────────
  const paintCell = useCallback((r: number, c: number, t: Tool) => {
    setGrid((prev) => {
      const next = prev.map((row) => [...row])
      // Enforce one-of-a-kind constraint for start/goal.
      if (t === 'start' || t === 'goal') {
        for (let ri = 0; ri < next.length; ri++)
          for (let ci = 0; ci < next[ri].length; ci++)
            if (next[ri][ci] === t) next[ri][ci] = 'empty'
      }
      next[r][c] = t
      return next
    })
  }, [])

  const handleCellDown = useCallback(
    (r: number, c: number) => {
      isPaintingRef.current = true
      paintCell(r, c, tool)
    },
    [paintCell, tool],
  )

  const handleCellEnter = useCallback(
    (r: number, c: number) => {
      if (isPaintingRef.current) paintCell(r, c, tool)
    },
    [paintCell, tool],
  )

  // Release painting on mouse-up anywhere in the window.
  useEffect(() => {
    const stop = () => { isPaintingRef.current = false }
    window.addEventListener('mouseup', stop)
    window.addEventListener('touchend', stop)
    return () => {
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('touchend', stop)
    }
  }, [])

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── Validation ───────────────────────────────────────────────────────────
  const draft = buildMazeLevel(grid, startDir, levelName)
  const validation = validateLevel(draft)

  const handleLoad = useCallback(() => {
    if (!validation.valid) return
    onLoad(buildMazeLevel(grid, startDir, levelName))
    onClose()
  }, [grid, levelName, onClose, onLoad, startDir, validation.valid])

  // ── Cell size — shrink if grid is large ──────────────────────────────────
  const cellPx = cols <= 8 ? 48 : cols <= 10 ? 42 : 36

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="med-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="med-modal">

        {/* Header */}
        <div className="med-header">
          <span className="med-title">🗺 Build Your Maze</span>
          <input
            className="med-name"
            placeholder="Give your level a name…"
            value={levelName}
            onChange={(e) => setLevelName(e.target.value)}
            maxLength={40}
          />
          <button className="med-close" onClick={onClose} title="Close (Esc)">✕</button>
        </div>

        {/* Grid size picker */}
        <div className="med-size-row">
          <span className="med-row-label">Grid size</span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className={`med-size-btn${p.rows === rows && p.cols === cols ? ' active' : ''}`}
              onClick={() => handlePreset(p.rows, p.cols)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="med-body">
          {/* ── Palette ───────────────────────────────────────────────── */}
          <div className="med-palette">
            <span className="med-row-label">Paint</span>

            {TOOLS.map(({ type: t, meta }) => (
              <button
                key={t}
                className={`med-tool${tool === t ? ' active' : ''}`}
                style={{ '--tc': TOOL_COLOR[t] } as React.CSSProperties}
                onClick={() => setTool(t)}
                title={meta.hint}
              >
                <span className="med-tool-icon">{meta.icon}</span>
                <span className="med-tool-lbl">{meta.label}</span>
              </button>
            ))}

            {/* Direction picker — for placing the start arrow correctly */}
            <span className="med-row-label" style={{ marginTop: 14 }}>Start faces</span>
            <div className="med-dir-grid">
              {/* top row: north spans both cols */}
              <button
                className={`med-dir${startDir === 'north' ? ' active' : ''}`}
                style={{ gridColumn: '1 / -1' }}
                onClick={() => setStartDir('north')}
                title="North"
              >↑</button>
              <button
                className={`med-dir${startDir === 'west' ? ' active' : ''}`}
                onClick={() => setStartDir('west')}
                title="West"
              >←</button>
              <button
                className={`med-dir${startDir === 'east' ? ' active' : ''}`}
                onClick={() => setStartDir('east')}
                title="East"
              >→</button>
              <button
                className={`med-dir${startDir === 'south' ? ' active' : ''}`}
                style={{ gridColumn: '1 / -1' }}
                onClick={() => setStartDir('south')}
                title="South"
              >↓</button>
            </div>
          </div>

          {/* ── Grid canvas ───────────────────────────────────────────── */}
          <div className="med-grid-wrap">
            <div
              className="med-grid"
              style={{
                gridTemplateColumns: `repeat(${cols}, ${cellPx}px)`,
                gridTemplateRows:    `repeat(${rows}, ${cellPx}px)`,
              }}
              // Stop context menu + text selection while painting
              onContextMenu={(e) => e.preventDefault()}
            >
              {grid.map((row, r) =>
                row.map((cell, c) => (
                  <MazeCell
                    key={`${r}-${c}`}
                    cell={cell}
                    startDir={startDir}
                    onDown={() => handleCellDown(r, c)}
                    onEnter={() => handleCellEnter(r, c)}
                  />
                )),
              )}
            </div>
          </div>
        </div>

        {/* Footer — validation + load */}
        <div className="med-footer">
          <span className={`med-status${validation.valid ? ' ok' : ' err'}`}>
            {validation.valid ? '✅ Ready to play!' : `⚠️ ${validation.error}`}
          </span>
          <button
            className="btn btn-primary"
            onClick={handleLoad}
            disabled={!validation.valid}
          >
            ▶ Load into Game
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MazeCell (inner component) ───────────────────────────────────────────────

interface MazeCellProps {
  cell: Cell
  startDir: Direction
  onDown: () => void
  onEnter: () => void
}

function MazeCell({ cell, startDir, onDown, onEnter }: MazeCellProps) {
  return (
    <div
      className={`med-cell med-cell-${cell}`}
      onMouseDown={(e) => { e.preventDefault(); onDown() }}
      onMouseEnter={onEnter}
      onTouchStart={(e) => { e.preventDefault(); onDown() }}
    >
      {cell === 'start' && (
        <span className="med-start-arrow">{DIR_ARROWS[startDir]}</span>
      )}
      {cell === 'goal' && <span>⭐</span>}
      {cell === 'key'  && <span>🔑</span>}
    </div>
  )
}
