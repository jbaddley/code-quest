import type { MazeLevel } from '../types'

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * BFS reachability check: can the robot reach the goal cell from the start
 * cell using 4-directional movement while avoiding walls?
 *
 * Direction is irrelevant for reachability since the robot can always turn
 * before moving. If start and goal are in the same connected region of
 * non-wall cells, the maze is solvable.
 */
export function canReachGoal(level: MazeLevel): boolean {
  const grid = level.grid
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  let sr = -1
  let sc = -1

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === 'start') {
        sr = r
        sc = c
      }
    }
  }
  if (sr === -1) return false

  const visited: boolean[][] = Array.from(
    { length: rows },
    () => new Array<boolean>(cols).fill(false),
  )
  const queue: [number, number][] = [[sr, sc]]
  visited[sr][sc] = true
  const deltas: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]

  while (queue.length > 0) {
    const [r, c] = queue.shift()!
    if (grid[r][c] === 'goal') return true
    for (const [dr, dc] of deltas) {
      const nr = r + dr
      const nc = c + dc
      if (
        nr >= 0 &&
        nr < rows &&
        nc >= 0 &&
        nc < cols &&
        !visited[nr][nc] &&
        grid[nr][nc] !== 'wall'
      ) {
        visited[nr][nc] = true
        queue.push([nr, nc])
      }
    }
  }
  return false
}

/**
 * Validate a raw unknown value as a MazeLevel.
 * Returns { valid: true } on success, or { valid: false, error } describing
 * the first problem found. Used to sanity-check LLM-generated levels before
 * injecting them into the game.
 */
export function validateLevel(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Level must be a JSON object' }
  }
  const l = raw as Record<string, unknown>

  if (typeof l.id !== 'string' || !l.id) {
    return { valid: false, error: 'Missing or empty "id"' }
  }
  if (typeof l.name !== 'string' || !l.name) {
    return { valid: false, error: 'Missing or empty "name"' }
  }
  if (typeof l.goal !== 'string') {
    return { valid: false, error: 'Missing "goal" string' }
  }
  if (!Array.isArray(l.grid) || l.grid.length === 0) {
    return { valid: false, error: '"grid" must be a non-empty array' }
  }

  const grid = l.grid as unknown[]
  if (grid.length < 2 || grid.length > 15) {
    return {
      valid: false,
      error: `Grid must have 2-15 rows (got ${grid.length})`,
    }
  }

  const firstRow = grid[0]
  if (!Array.isArray(firstRow)) {
    return { valid: false, error: 'Each row of "grid" must be an array' }
  }
  const colCount = (firstRow as unknown[]).length
  if (colCount < 2 || colCount > 15) {
    return {
      valid: false,
      error: `Grid must have 2-15 columns (got ${colCount})`,
    }
  }

  const validCells = new Set(['start', 'empty', 'wall', 'goal', 'key'])
  let startCount = 0
  let goalCount = 0

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r]
    if (!Array.isArray(row)) {
      return { valid: false, error: `Row ${r} is not an array` }
    }
    const cells = row as unknown[]
    if (cells.length !== colCount) {
      return {
        valid: false,
        error: `Row ${r} has ${cells.length} columns but row 0 has ${colCount} — grid must be rectangular`,
      }
    }
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c]
      if (typeof cell !== 'string' || !validCells.has(cell)) {
        return {
          valid: false,
          error: `Invalid cell value "${cell}" at row ${r}, col ${c}. Must be one of: start, empty, wall, goal, key`,
        }
      }
      if (cell === 'start') startCount++
      if (cell === 'goal') goalCount++
    }
  }

  if (startCount !== 1) {
    return {
      valid: false,
      error: `Grid must have exactly 1 "start" cell (found ${startCount})`,
    }
  }
  if (goalCount !== 1) {
    return {
      valid: false,
      error: `Grid must have exactly 1 "goal" cell (found ${goalCount})`,
    }
  }

  const validDirs = new Set(['north', 'east', 'south', 'west'])
  if (typeof l.startDir !== 'string' || !validDirs.has(l.startDir)) {
    return {
      valid: false,
      error: `Invalid "startDir": "${l.startDir}". Must be north/east/south/west`,
    }
  }

  if (!Array.isArray(l.concepts)) {
    return { valid: false, error: '"concepts" must be an array of strings' }
  }

  if (typeof l.maxSteps !== 'number' || l.maxSteps < 1) {
    return {
      valid: false,
      error: '"maxSteps" must be a positive number (suggest 400)',
    }
  }

  // hints
  if (!l.hints || typeof l.hints !== 'object') {
    return { valid: false, error: '"hints" must be an object with keys 1, 2, 3' }
  }
  const hints = l.hints as Record<string, unknown>
  for (const k of ['1', '2', '3']) {
    if (typeof hints[k] !== 'string') {
      return {
        valid: false,
        error: `"hints.${k}" must be a string`,
      }
    }
  }

  // lesson
  if (!l.lesson || typeof l.lesson !== 'object') {
    return { valid: false, error: '"lesson" is required' }
  }
  const lesson = l.lesson as Record<string, unknown>
  if (typeof lesson.concept !== 'string') {
    return { valid: false, error: '"lesson.concept" must be a string' }
  }
  if (typeof lesson.explanation !== 'string') {
    return { valid: false, error: '"lesson.explanation" must be a string' }
  }
  if (
    !Array.isArray(lesson.starterQuestions) ||
    (lesson.starterQuestions as unknown[]).length < 3 ||
    (lesson.starterQuestions as unknown[]).some((q) => typeof q !== 'string')
  ) {
    return {
      valid: false,
      error: '"lesson.starterQuestions" must be an array of at least 3 strings',
    }
  }
  if (typeof lesson.ahaMoment !== 'string') {
    return { valid: false, error: '"lesson.ahaMoment" must be a string' }
  }

  // Solvability check (most important — catches wall configs that trap the robot)
  if (!canReachGoal(l as unknown as MazeLevel)) {
    return {
      valid: false,
      error:
        'Maze is unsolvable: there is no path from the start cell to the goal cell ' +
        '(walls are blocking all routes). Check that the start and goal are connected.',
    }
  }

  return { valid: true }
}
