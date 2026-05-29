import type { Direction, MazeLevel, RunResult } from '../types'

export interface RobotState {
  row: number
  col: number
  dir: Direction
}

const DIR_DELTA: Record<Direction, { dr: number; dc: number }> = {
  north: { dr: -1, dc: 0 },
  east: { dr: 0, dc: 1 },
  south: { dr: 1, dc: 0 },
  west: { dr: 0, dc: -1 },
}

const TURN_LEFT: Record<Direction, Direction> = {
  north: 'west',
  west: 'south',
  south: 'east',
  east: 'north',
}
const TURN_RIGHT: Record<Direction, Direction> = {
  north: 'east',
  east: 'south',
  south: 'west',
  west: 'north',
}

export function findStart(level: MazeLevel): RobotState {
  for (let r = 0; r < level.grid.length; r++) {
    for (let c = 0; c < level.grid[r].length; c++) {
      if (level.grid[r][c] === 'start') {
        return { row: r, col: c, dir: level.startDir }
      }
    }
  }
  throw new Error(`Level ${level.id} has no start cell`)
}

export type Instruction =
  | { op: 'move' }
  | { op: 'turn-left' }
  | { op: 'turn-right' }

/**
 * Apply a single instruction to the robot. Returns the new state, or a
 * failure signal if the move would be illegal.
 */
export function step(
  level: MazeLevel,
  robot: RobotState,
  instr: Instruction,
): { robot: RobotState } | { failure: RunResult['failureSignal'] } {
  switch (instr.op) {
    case 'turn-left':
      return { robot: { ...robot, dir: TURN_LEFT[robot.dir] } }
    case 'turn-right':
      return { robot: { ...robot, dir: TURN_RIGHT[robot.dir] } }
    case 'move': {
      const { dr, dc } = DIR_DELTA[robot.dir]
      const nr = robot.row + dr
      const nc = robot.col + dc
      const rows = level.grid.length
      const cols = level.grid[0].length
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) {
        return { failure: 'out-of-bounds' }
      }
      if (level.grid[nr][nc] === 'wall') {
        return { failure: 'hit-wall' }
      }
      return { robot: { row: nr, col: nc, dir: robot.dir } }
    }
  }
}

export function isAtGoal(level: MazeLevel, robot: RobotState): boolean {
  return level.grid[robot.row][robot.col] === 'goal'
}

export function isAtKey(level: MazeLevel, robot: RobotState): boolean {
  return level.grid[robot.row][robot.col] === 'key'
}

/** A level "requires a key" if its grid contains a key cell — the goal then acts
 *  as a locked door that only counts as solved once the key is collected. */
export function levelRequiresKey(level: MazeLevel): boolean {
  return level.grid.some((row) => row.includes('key'))
}

/**
 * Returns true if the cell directly ahead of the robot is passable
 * (not a wall and not out-of-bounds). Used by `if-path-clear-start` handler.
 */
export function isPathClear(level: MazeLevel, robot: RobotState): boolean {
  const { dr, dc } = DIR_DELTA[robot.dir]
  const nr = robot.row + dr
  const nc = robot.col + dc
  const rows = level.grid.length
  const cols = level.grid[0].length
  if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return false
  return level.grid[nr][nc] !== 'wall'
}

/**
 * Given a flat token list and the index of an `if-has-key-start` marker,
 * return the index of its matching `if-has-key-end` (handles nesting).
 * Used by the runner to skip a conditional body when the condition is false.
 */
export function findMatchingEnd(tokens: string[], startIdx: number): number {
  let depth = 0
  for (let i = startIdx; i < tokens.length; i++) {
    if (tokens[i] === 'if-has-key-start') depth++
    else if (tokens[i] === 'if-has-key-end') {
      depth--
      if (depth === 0) return i
    }
  }
  return tokens.length - 1
}

/**
 * Given a flat token list and the index of an `if-path-clear-start` marker,
 * return the index of its matching `if-path-clear-end` (handles nesting).
 */
export function findMatchingPathClearEnd(tokens: string[], startIdx: number): number {
  let depth = 0
  for (let i = startIdx; i < tokens.length; i++) {
    if (tokens[i] === 'if-path-clear-start') depth++
    else if (tokens[i] === 'if-path-clear-end') {
      depth--
      if (depth === 0) return i
    }
  }
  return tokens.length - 1
}

/**
 * Given a flat token list and the index of an `if-has-key-else` marker
 * inside an if/else-has-key block, return the index of the matching
 * `if-has-key-end`.
 */
export function findIfHasKeyEnd(tokens: string[], startIdx: number): number {
  let depth = 0
  for (let i = startIdx; i < tokens.length; i++) {
    if (tokens[i] === 'if-has-key-start') depth++
    else if (tokens[i] === 'if-has-key-end') {
      if (depth === 0) return i
      depth--
    }
  }
  return tokens.length - 1
}

/**
 * Given a flat token list and the index of a `repeat-var-start:*` marker,
 * return the index of its matching `repeat-var-end` (handles nesting of
 * multiple repeat-var blocks inside one another).
 * Used by the runner to skip the body when the variable holds zero.
 */
export function findMatchingVarEnd(tokens: string[], startIdx: number): number {
  let depth = 0
  for (let i = startIdx; i < tokens.length; i++) {
    if (tokens[i].startsWith('repeat-var-start:')) depth++
    else if (tokens[i] === 'repeat-var-end') {
      depth--
      if (depth === 0) return i
    }
  }
  return tokens.length - 1
}
