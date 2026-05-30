/**
 * Types that mirror what the real PowerUp would persist via the SDK
 * (`@sai/powerup-sdk` Client.updateState / createStateVersion).
 *
 * In production these would live in `@sai/powerups-trpc/schemas/code-quest.ts`
 * as Zod schemas; here we keep them as plain TS so the prototype is dependency-free.
 */

export type Direction = 'north' | 'east' | 'south' | 'west'

export type Cell = 'empty' | 'wall' | 'goal' | 'start' | 'key'

/**
 * Structured lesson payload returned by the `getLevelLesson` RPC.
 * Dot uses this to open with a question and frame the level as a
 * learning moment rather than just a puzzle.
 */
export interface LessonContent {
  /** The concept name, e.g. "Sequencing" or "Conditionals". */
  concept: string
  /**
   * 1–2 sentence plain-English explanation aimed at a 3rd–7th grader.
   * Dot can paraphrase but this is the core idea to convey.
   */
  explanation: string
  /**
   * Three Socratic opening questions. Dot picks one (or varies them
   * across attempts) to engage the student *before* they start coding.
   */
  starterQuestions: [string, string, string]
  /**
   * The "aha moment" — the one-liner the student should be able to say
   * after they've solved the level. Dot can echo this as a celebration.
   */
  ahaMoment: string
}

export interface LevelPrediction {
  question: string
  options: string[]
  correctIndex: number
}

export interface MazeLevel {
  id: string
  /** Short display label (e.g. for the header chip). */
  name: string
  goal: string
  /** Row-major grid. */
  grid: Cell[][]
  startDir: Direction
  /**
   * Concepts this level targets. Well-known values: 'sequencing', 'loops',
   * 'conditionals', 'variables', 'repeatUntil', 'nestedLoops'. Other strings
   * are treated as informational and don't affect mastery scoring.
   */
  concepts: string[]
  /** Soft cap on instructions executed — protects against infinite loops. */
  maxSteps: number
  /**
   * Tiered hints. 1 is Socratic (a question), 2 is directive,
   * 3 is a guided walkthrough. Each level provides its own.
   */
  hints: Record<1 | 2 | 3, string>
  /** What concept this level teaches and how Dot should introduce it. */
  lesson: LessonContent
  /**
   * The minimum number of blocks in an optimal solution.
   * Used to show an efficiency badge after winning.
   */
  optimalBlocks?: number
  /**
   * Prediction question shown before the first run attempt.
   */
  prediction?: LevelPrediction
}

export interface Mastery {
  sequencing: number
  loops: number
  conditionals: number
  variables: number
  repeatUntil: number
}

export interface RunResult {
  passed: boolean
  steps: number
  failureSignal?:
    | 'hit-wall'
    | 'out-of-bounds'
    | 'step-limit'
    | 'no-blocks'
    | 'door-locked'
}

export interface CodeQuestState {
  stage: 1 | 2 | 3 | 4 | 5
  levelId: string
  /** Active level's workspace XML (kept for backward compat; see `workspaces`). */
  workspaceXml: string
  /** Per-level workspace XMLs keyed by level ID. */
  workspaces?: Record<string, string>
  attempts: Array<{
    at: string
    passed: boolean
    failureSignal?: RunResult['failureSignal']
    hintsUsed: number
  }>
  mastery: Mastery
  hintsUsed: number
  /** IDs of every level the student has solved at least once. */
  completedLevelIds?: string[]
  /** Custom levels the student has built or imported — persisted so they survive refresh. */
  customLevels?: MazeLevel[]
  /** Concept names for which the intro card has already been shown. */
  seenConcepts?: string[]
  /** The active curriculum module ID, if the student has been placed into one. */
  activeModuleId?: string
}

/**
 * Portable maze-share bundle. Exported as a `.cq.json` file.
 * Contains the full level definition plus the student's solution (optional).
 */
export interface MazeShare {
  version: 1
  exportedAt: string
  level: MazeLevel
  /** Blockly workspace XML of the student's solution, if any. */
  solution?: string
}

// ── Output levels ─────────────────────────────────────────────────────────────

/**
 * A level where instead of navigating a maze, the student writes code whose
 * output (captured `print()` calls) must match an expected list of lines.
 * Replaces the maze canvas with a dark-terminal output panel.
 */
export interface OutputLevel {
  /** Discriminant — used to distinguish from MazeLevel at runtime. */
  type: 'output'
  id: string
  /** Short display label. */
  name: string
  /** Problem description shown above the output panel. */
  goal: string
  /** Concepts this level targets, e.g. ['print', 'literals']. */
  concepts: string[]
  /** Expected console lines, in order. Empty string lines are allowed. */
  expectedOutput: string[]
  /** Tiered hints (same structure as MazeLevel). */
  hints: Record<1 | 2 | 3, string>
  /** Lesson content for the concept intro card and Dot integration. */
  lesson: LessonContent
  /**
   * Fewest `print()` calls for an optimal solution.
   * Used for the efficiency badge.
   */
  optimalLines?: number
}

/** Union of all level types in the game. Use `'grid' in level` to discriminate. */
export type AnyLevel = MazeLevel | OutputLevel

// ── Theming ───────────────────────────────────────────────────────────────────

/** Brand colours surfaced as CSS custom properties on <html>. */
export interface ThemeColors {
  primary: string        // buttons, active elements, progress bar fill
  primaryText: string    // text on primary-coloured backgrounds
  header: string         // header bar background
  headerText: string     // header bar text
  stageBg: string        // maze panel background
  winBg: string          // win banner background
  winText: string        // win banner text
  failBg: string         // fail banner background
  failText: string       // fail banner text
}

/** Game-world visual overrides — replaces emoji and canvas draw colours. */
export interface ThemeGame {
  /**
   * Full SVG string (including the outer <svg> tag) for the robot character.
   * The SVG must be authored pointing east on a 48×48 viewBox — the canvas
   * rotates the context before drawing so all four directions work automatically.
   * When set, takes priority over robotEmoji.
   */
  robotSvg?: string
  /** Emoji rendered at robot position instead of the default arrow triangle. */
  robotEmoji?: string
  /** Emoji rendered on the goal cell instead of ★. */
  goalEmoji?: string
  /** Emoji rendered for the key collectible instead of 🔑. */
  keyEmoji?: string
  wallColor?: string      // maze wall fill
  floorColor?: string     // empty cell fill
  startColor?: string     // start cell fill
  goalColor?: string      // goal cell fill
  /** Color of the thin lines drawn between cells. Default: #e5e7eb */
  gridLineColor?: string
  /**
   * Scale multiplier applied on top of the default cell * 0.88 size.
   * Use when an SVG sprite has extra whitespace that makes it look small.
   * Values > 1 let the sprite overflow the cell slightly (e.g. 1.3 = 30% bigger).
   * Default: 1.
   */
  robotSvgScale?: number
}

/** Human-visible text that teachers can swap out for a theme or subject area. */
export interface ThemeLabels {
  appTitle?: string
  schoolName?: string
  /** Absolute URL to a small school logo (displayed in the header). */
  schoolLogoUrl?: string
  panelWorkspace?: string   // "Workspace"
  panelGame?: string        // "Game"
  panelProgress?: string    // "Your Progress"
  btnRun?: string           // "▶ Run"
  btnReset?: string         // "Reset robot"
  /**
   * What the playable character is called in this theme — e.g. "robot",
   * "rocket", "player", "note", "brush". Used in hints, banners, and
   * anywhere the character is referenced by name.
   */
  character?: string
  /** Override per-concept names in the mastery panel. */
  conceptLabels?: Partial<Record<'sequencing' | 'loops' | 'conditionals' | 'variables' | 'repeatUntil', string>>
  /** Prefix string for the win banner (replaces "🎉 Solved cleanly!"). */
  winMessage?: string
  /** Per-failure-signal banner overrides. */
  failMessages?: Partial<Record<'hit-wall' | 'out-of-bounds' | 'step-limit' | 'door-locked' | 'default', string>>
  /**
   * Per-level narrative stories keyed by level ID. When present, these replace
   * the level's default `goal` text in the game panel and level-change banner,
   * framing the puzzle in the context of the active theme.
   *
   * Example key: `'robots-first-steps'`, `'locked-door'`, etc.
   */
  levelStories?: Record<string, string>
}

export type ThemePreset =
  | 'default' | 'space'  | 'sports' | 'music'   | 'art'
  | 'animals' | 'princess'
  | 'chef'    | 'ocean'  | 'hero'
  | 'racing'  | 'farm'

/**
 * Full theme configuration. A teacher configures this in the SchoolAI
 * activity panel; it arrives in the PowerUp via ChatContext.themeConfig.
 *
 * `preset` picks a bundled theme. Any field in `colors`, `game`, or `labels`
 * overrides just that slot of the preset, so schools can e.g. use the space
 * preset but substitute their own primary colour and school name.
 *
 * `stage` controls the learning stage for the class (acts as a floor — the
 * student's own saved stage is the max of both):
 *   1 — Blocks only (default)
 *   2 — Blocks + live Python code-reveal panel
 *   3 — Editable Python (CodeMirror) with Blockly as collapsible scaffold
 *   4 — Code-first (Blockly hidden by default, harder levels)
 *   5 — Free Python via Pyodide (no Blockly)
 */
export interface ThemeConfig {
  preset?: ThemePreset
  colors?: Partial<ThemeColors>
  game?: ThemeGame
  labels?: ThemeLabels
  /** Teacher-set stage floor. Individual student stage is max(this, CodeQuestState.stage). */
  stage?: 1 | 2 | 3 | 4 | 5
  /**
   * Which code language the Stage-2 "See the Code" panel shows by default.
   * Students can always switch between languages using the tab buttons.
   * Defaults to 'python'.
   */
  codeLanguage?: 'python' | 'javascript'
}

/** Events the PowerUp would emit upward to the harness (and on to Dot). */
export type CodeQuestEventType =
  | 'block-added'
  | 'block-removed'
  | 'attempt-run'
  | 'attempt-passed'
  | 'attempt-failed'
  | 'solved-inefficiently'
  | 'hint-requested'
  | 'stuck-detected'
  | 'level-completed'
  | 'level-advanced'
  | 'lesson-intro'
  | 'level-builder-requested'

export interface CodeQuestEvent {
  type: CodeQuestEventType
  at: string
  data?: Record<string, unknown>
}
