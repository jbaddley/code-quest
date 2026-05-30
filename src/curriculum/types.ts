import type { MazeLevel, OutputLevel } from '../types'

export type ModuleLevel = MazeLevel | OutputLevel

export interface StandardsAlignment {
  framework: string
  code: string
  description: string
}

export interface ModuleAssessment {
  id: string
  type: 'multiple-choice' | 'free-response' | 'reflection'
  question: string
  options?: string[]
  correctIndex?: number
  rubric?: string
}

export interface NarrativeArc {
  title: string
  synopsis: string
  chapters: Array<{
    levelId: string
    chapterTitle: string
    chapterSynopsis: string
  }>
}

/**
 * A self-contained curriculum module. Levels are embedded (not referenced) so
 * the module is portable as a single JSON blob — database migration simply
 * maps each level to a row with a module_id foreign key.
 */
export interface CurriculumModule {
  /** Increment when the shape of this interface changes. */
  schemaVersion: 1
  id: string
  title: string
  description: string
  author: string
  authorEmail?: string
  createdAt: string
  updatedAt: string
  /** Same concept vocabulary as MazeLevel.concepts. */
  concepts: string[]
  /** "Students will be able to…" bullets. */
  objectives: string[]
  standards?: StandardsAlignment[]
  assessments?: ModuleAssessment[]
  /** [minGrade, maxGrade], e.g. [2, 6]. */
  gradeBand: [number, number]
  estimatedMinutes?: number
  /** IDs of modules that should be completed before this one. */
  prerequisites: string[]
  published: boolean
  tags?: Record<string, string>
  /** All levels in pedagogical order — the module is the canonical definition. */
  levels: ModuleLevel[]
  narrative?: NarrativeArc
}
