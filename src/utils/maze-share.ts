/**
 * Export / import utilities for Code Quest maze-share bundles.
 *
 * A bundle is a `.cq.json` file containing:
 *   - version: 1
 *   - exportedAt: ISO timestamp
 *   - level: full MazeLevel definition
 *   - solution?: Blockly workspace XML of the student's solution
 *
 * This lets students share both a challenge AND how they solved it.
 */

import { validateLevel } from '../game/maze-solver'
import type { MazeLevel, MazeShare } from '../types'

// ── Export ────────────────────────────────────────────────────────────────────

/** Trigger a browser file download for the given level + optional solution. */
export function exportMaze(level: MazeLevel, solutionXml?: string): void {
  const bundle: MazeShare = {
    version: 1,
    exportedAt: new Date().toISOString(),
    level,
    solution: solutionXml || undefined,
  }

  const json = JSON.stringify(bundle, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${slugify(level.name)}.cq.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Import ────────────────────────────────────────────────────────────────────

export interface ImportResult {
  ok: true
  level: MazeLevel
  solution?: string
}
export interface ImportError {
  ok: false
  error: string
}

/** Parse a raw string (file contents or pasted text) as a MazeShare bundle. */
export function parseMazeShare(text: string): ImportResult | ImportError {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Not valid JSON — check the file and try again.' }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'File does not look like a Code Quest share.' }
  }

  const obj = parsed as Record<string, unknown>

  if (obj.version !== 1) {
    return { ok: false, error: `Unknown version "${obj.version}". Only version 1 is supported.` }
  }

  if (!obj.level) {
    return { ok: false, error: 'Missing "level" field in share bundle.' }
  }

  const result = validateLevel(obj.level)
  if (!result.valid) {
    return { ok: false, error: `Invalid maze: ${result.error}` }
  }

  return {
    ok: true,
    level: obj.level as MazeLevel,
    solution: typeof obj.solution === 'string' ? obj.solution : undefined,
  }
}

/** Read a File object and return its text content. */
export function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsText(file)
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    || 'maze'
}
