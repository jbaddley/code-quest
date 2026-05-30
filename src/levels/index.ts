import { curriculumRegistry } from '../curriculum/registry'
import type { MazeLevel, AnyLevel } from '../types'

/**
 * Ordered registry of all maze levels — derived from the curriculum registry.
 * To add a new level, add it to a module JSON in src/curriculum/modules/.
 */
export const ALL_LEVELS: AnyLevel[] = curriculumRegistry.getAllLevels()

/** Maze levels only — for the maze engine paths. */
export const LEVELS: MazeLevel[] = ALL_LEVELS.filter((l): l is MazeLevel => 'grid' in l)

/** The level a fresh student starts on. */
export const FIRST_LEVEL_ID: string = ALL_LEVELS[0]?.id ?? ''

/** Look up a level by ID across all level types. */
export function getLevel(id: string): AnyLevel | undefined {
  return curriculumRegistry.getLevel(id)
}

/** Look up a maze level by ID — used by the maze engine paths. */
export function getMazeLevel(id: string): MazeLevel | undefined {
  return LEVELS.find((l) => l.id === id)
}

/**
 * Returns the next level in the progression, or `null` if `currentId` is
 * already the last level.
 */
export function getNextLevel(currentId: string): AnyLevel | null {
  return curriculumRegistry.getNextLevel(currentId)
}
