import type { MazeLevel, AnyLevel } from '../types'
import { level1 } from './level-1'
import { level2 } from './level-2'
import { level3 } from './level-3'
import { level4 } from './level-4'
import { level5 } from './level-5'
import { level6 } from './level-6'
import { level7 } from './level-7'
import { level8 } from './level-8'
import { level9 } from './level-9'
import { outputLevel1 } from './output-level-1'
import { outputLevel2 } from './output-level-2'
import { outputLevel3 } from './output-level-3'
import { outputLevel4 } from './output-level-4'
import { outputLevel5 } from './output-level-5'

/**
 * Ordered registry of all maze levels — the progression order. Adding a new level
 * is two steps: create the file alongside the others, then push it onto this
 * array in the position where you want students to encounter it.
 */
export const LEVELS: MazeLevel[] = [level1, level2, level3, level4, level5, level6, level7, level8, level9]

/**
 * All levels across all level types — maze levels first, then output levels.
 * Use this for the level picker / roadmap count.
 */
export const ALL_LEVELS: AnyLevel[] = [
  ...LEVELS,
  outputLevel1, outputLevel2, outputLevel3, outputLevel4, outputLevel5,
]

/** The level a fresh student starts on. */
export const FIRST_LEVEL_ID = ALL_LEVELS[0].id

/** Look up a level by ID across all level types. Returns `undefined` for unknown IDs. */
export function getLevel(id: string): AnyLevel | undefined {
  return ALL_LEVELS.find((l) => l.id === id)
}

/** Look up a maze level by ID — used by the maze engine paths. */
export function getMazeLevel(id: string): MazeLevel | undefined {
  return LEVELS.find((l) => l.id === id)
}

/**
 * Returns the next level in the progression, or `null` if `currentId` is
 * already the last level (the student has completed the whole course).
 */
export function getNextLevel(currentId: string): AnyLevel | null {
  const idx = ALL_LEVELS.findIndex((l) => l.id === currentId)
  if (idx === -1) return null
  return ALL_LEVELS[idx + 1] ?? null
}
