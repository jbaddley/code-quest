import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Blockly from 'blockly/core'
import { BlocklyWorkspace, type BlocklyWorkspaceHandle } from './blocks/blockly-workspace'
import { compileWorkspace, makeToolbox } from './blocks/maze-blocks'
import { defineOutputBlocks, makeOutputToolbox, compileOutputWorkspace } from './blocks/output-blocks'
import { runOutput, checkOutput, transpilePythonToJs } from './game/output-engine'
import { MazeCanvas } from './game/maze-canvas'
import { OutputDisplay } from './ui/output-display'
import {
  findMatchingEnd,
  findMatchingPathClearEnd,
  findIfHasKeyEnd,
  findMatchingVarEnd,
  findStart,
  isAtGoal,
  isAtKey,
  isPathClear,
  levelRequiresKey,
  step,
  type Instruction,
  type RobotState,
} from './game/maze-engine'
import { validateLevel } from './game/maze-solver'
import { MazeEditor } from './ui/maze-editor'
import {
  FIRST_LEVEL_ID,
  LEVELS,
  ALL_LEVELS,
  getLevel,
  getNextLevel,
} from './levels'
import {
  fail,
  formatMastery,
  ok,
  usePowerUpClient,
  type ChatContext,
  type RpcHandlers,
} from './mcp/use-powerup-client'
import type { AnyLevel, CodeQuestState, MazeLevel, OutputLevel, Mastery, RunResult, ThemeConfig, LevelPrediction } from './types'
import { exportMaze, parseMazeShare, readFileText } from './utils/maze-share'
import { ThemeProvider, resolveTheme } from './theme/theme-context'
import { compileToPython } from './blocks/maze-python-generator'
import { compileToJavaScript } from './blocks/maze-js-generator'
import { PythonPanel } from './ui/python-panel'
import { CodeEditor } from './ui/code-editor'
import { parsePython, parsePythonToAst, type ParseError } from './game/python-parser'
import { parseJavaScript, parseJavaScriptToAst } from './game/js-parser'
import { parseTypeScriptToAst } from './game/ts-parser'
import { astToPython, astToJavaScript, astToTypeScript, astToBlocklyState } from './game/maze-ast'

// Register output-level Blockly blocks once at module load.
defineOutputBlocks()

/**
 * TEST MODE — shows "Next level →" even before the level is solved, so you
 * can quickly jump through all levels during development. Remove this flag
 * (or set to false) before shipping.
 */
const TEST_MODE = true

const INITIAL_MASTERY: Mastery = {
  sequencing: 0,
  loops: 0,
  conditionals: 0,
  variables: 0,
  repeatUntil: 0,
}

const TOKEN_TO_INSTRUCTION: Record<string, Instruction> = {
  move: { op: 'move' },
  'turn-left': { op: 'turn-left' },
  'turn-right': { op: 'turn-right' },
}

/**
 * Parse a token that may have a blockId suffix (format "op:blockId").
 * Returns { op, blockId } where blockId may be undefined.
 */
function parseToken(tok: string): { op: string; blockId?: string } {
  // Tokens like "set-var:steps:6" or "repeat-var-start:steps" have multiple colons
  // and are NOT movement tokens — don't mistakenly split them.
  const movementOps = ['move', 'turn-left', 'turn-right']
  const colonIdx = tok.indexOf(':')
  if (colonIdx !== -1) {
    const op = tok.slice(0, colonIdx)
    if (movementOps.includes(op)) {
      return { op, blockId: tok.slice(colonIdx + 1) }
    }
  }
  return { op: tok }
}

/** Concept name → emoji mapping for the roadmap. */
const CONCEPT_EMOJI: Record<string, string> = {
  sequencing: '🔢',
  loops: '🔄',
  conditionals: '❓',
  variables: '📦',
  repeatUntil: '♾️',
  nestedLoops: '🪆',
  functions: '🔁',
}

interface RunOutcome {
  passed: boolean
  steps: number
  blockCount: number
  usedRepeat: boolean
  usedConditional: boolean
  /** Used set-steps + repeat-steps (variables). */
  usedVariables: boolean
  /** Used move-until-wall (repeat-until). */
  usedMoveUntilWall: boolean
  /** Used at least two `maze_repeat` blocks (nested loops). */
  usedNestedLoop: boolean
  /** Used define-procedure + call-procedure. */
  usedFunctions: boolean
  /** Used the key constructs the level teaches. */
  efficient: boolean
  /**
   * Concepts the student demonstrated that go BEYOND what this level requires.
   * e.g. using a function on a sequencing level, or a loop inside a function
   * on a loops level. Celebrated rather than flagged.
   */
  bonusConcepts: string[]
  failure?: RunResult['failureSignal']
}

export function App() {
  // ── Theme ──────────────────────────────────────────────────────────────
  // Initialised from a `?theme=<preset>` URL param so designers / demos can
  // switch themes without a harness connection. Overwritten by `themeConfig`
  // from the teacher's activity settings once the bridge handshakes.
  const [themeConfig, setThemeConfig] = useState<ThemeConfig | null>(() => {
    const param = new URLSearchParams(location.search).get('theme')
    if (param) return { preset: param as ThemeConfig['preset'] }
    return null
  })
  const resolvedTheme = useMemo(() => resolveTheme(themeConfig), [themeConfig])

  // ── Stage (1–5 learning progression) ─────────────────────────────────
  // Initialised from `?stage=N` URL param; overwritten by teacher's ThemeConfig.
  const [stage, setStage] = useState<1 | 2 | 3 | 4 | 5>(() => {
    const p = new URLSearchParams(location.search).get('stage')
    return p ? (Math.min(5, Math.max(1, Number(p))) as 1 | 2 | 3 | 4 | 5) : 1
  })
  const stageRef = useRef(stage)
  useEffect(() => { stageRef.current = stage }, [stage])

  // ── Code panel (Stage 2+) — Python, JavaScript, and TypeScript ──────────
  const [pythonCode, setPythonCode] = useState('')
  const [jsCode, setJsCode] = useState('')
  const [tsCode, setTsCode] = useState('')
  const [showPythonPanel, setShowPythonPanel] = useState(false)

  // ── Stage 3 code editor ───────────────────────────────────────────────
  /** Which tab is showing in the workspace panel. */
  const [workspaceTab, setWorkspaceTab] = useState<'blocks' | 'code'>('blocks')
  /** Language currently active in the code editor. */
  const [codeLang, setCodeLang] = useState<'python' | 'javascript' | 'typescript'>(() => {
    const p = new URLSearchParams(location.search).get('lang')
    if (p === 'javascript') return 'javascript'
    if (p === 'typescript') return 'typescript'
    return 'python'
  })
  /** The editable code in the Python editor. */
  const [pythonEditorCode, setPythonEditorCode] = useState('')
  /** The editable code in the JavaScript editor. */
  const [jsEditorCode, setJsEditorCode] = useState('')
  /** The editable code in the TypeScript editor. */
  const [tsEditorCode, setTsEditorCode] = useState('')
  /** Parse errors from the last run-from-code attempt. */
  const [parseErrors, setParseErrors] = useState<ParseError[]>([])
  /**
   * When true the code editor renders an inline read-only explanation comment
   * after each recognised line.  Students can toggle this off once they no
   * longer need the guidance.
   */
  const [showSyntaxHints, setShowSyntaxHints] = useState(true)
  /**
   * Holds the most recent AST parsed from the code editor — set whenever the
   * user types code. Applied to the Blockly workspace when they switch back to
   * the Blocks tab (so blocks always reflect the current code).
   */
  const pendingAstRef = useRef<import('./game/maze-ast').ASTNode[]>([])

  // ── Panel resize ──────────────────────────────────────────────────────────
  /** Width of the game panel in pixels — draggable via the resize handle. */
  const [gameWidth, setGameWidth] = useState(380)
  const [isPanelDragging, setIsPanelDragging] = useState(false)
  /** Refs so the mousemove closure captures stable values (no stale state). */
  const dragStartRef = useRef({ x: 0, width: 380, maxWidth: 900 })
  const gameWidthRef = useRef(gameWidth)
  gameWidthRef.current = gameWidth

  const startPanelResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    // Max game width: leave at least 280px for the workspace panel.
    // Subtract: mastery (320) + divider (12) + layout gap (12) + padding (24) + min-workspace (280).
    const maxWidth = Math.max(300, window.innerWidth - 320 - 12 - 12 - 24 - 280)
    dragStartRef.current = { x: e.clientX, width: gameWidthRef.current, maxWidth }
    setIsPanelDragging(true)
    document.body.classList.add('panel-resizing')

    const onMove = (ev: MouseEvent) => {
      // Divider dragged LEFT (ev.clientX < startX) → delta < 0 → game grows.
      const delta = ev.clientX - dragStartRef.current.x
      setGameWidth(Math.max(300, Math.min(dragStartRef.current.maxWidth, dragStartRef.current.width - delta)))
    }
    const onUp = () => {
      setIsPanelDragging(false)
      document.body.classList.remove('panel-resizing')
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // Store the active level object directly — no derivation, no timing issues.
  // Previously this was `currentLevelId` + a useMemo lookup, which caused
  // freshly-created custom levels to not be found during the same render batch.
  const [level, setLevel] = useState<AnyLevel>(() => getLevel(FIRST_LEVEL_ID) ?? LEVELS[0])

  // Custom levels — initialized from localStorage so they survive page refresh.
  const [customLevels, setCustomLevels] = useState<MazeLevel[]>(() => {
    try {
      const raw = localStorage.getItem('code-quest:custom-levels')
      return raw ? (JSON.parse(raw) as MazeLevel[]) : []
    } catch { return [] }
  })
  // The ref mirrors state so RPC handlers (registered once) always read a fresh
  // copy without needing to re-register.
  const customLevelsRef = useRef<MazeLevel[]>(customLevels)
  // Keep state, ref, and localStorage in sync.
  useEffect(() => {
    customLevelsRef.current = customLevels
    try { localStorage.setItem('code-quest:custom-levels', JSON.stringify(customLevels)) }
    catch { /* quota — non-fatal */ }
  }, [customLevels])

  /** Add or replace a custom level. Updates ref immediately (sync) then flushes state. */
  const upsertCustomLevel = useCallback((lvl: MazeLevel) => {
    const existing = customLevelsRef.current
    const idx = existing.findIndex((l) => l.id === lvl.id)
    customLevelsRef.current = idx >= 0
      ? existing.map((l, i) => (i === idx ? lvl : l))
      : [...existing, lvl]
    setCustomLevels(customLevelsRef.current)
  }, [])

  // IDs of every level the student has solved at least once — persisted.
  const [completedLevelIds, setCompletedLevelIds] = useState<string[]>([])

  // Visual maze editor modal
  const [showEditor, setShowEditor] = useState(false)

  // Builder panel state
  const [buildOpen, setBuildOpen] = useState(false)
  const [buildMode, setBuildMode] = useState<'describe' | 'json'>('describe')
  const [buildDescription, setBuildDescription] = useState('')
  const [buildJsonText, setBuildJsonText] = useState('')
  const [buildStatus, setBuildStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string } | null>(null)

  const [robot, setRobot] = useState<RobotState>(() => 'grid' in level ? findStart(level as MazeLevel) : { row: 0, col: 0, dir: 'east' as const })
  const [status, setStatus] = useState<'idle' | 'running' | 'win' | 'fail'>('idle')
  // True once the current level has been solved — gates the "Next level" button
  // and tells Dot the student is cleared to advance. Reset on level change.
  const [canAdvance, setCanAdvance] = useState(false)
  // True when the last winning solution could be tidier (e.g. no loop used).
  const [lastWinEfficient, setLastWinEfficient] = useState(true)
  const [lastWinBonusConcepts, setLastWinBonusConcepts] = useState<string[]>([])
  // Whether the key has been picked up during the current run (for canvas + win gate).
  const [collectedKey, setCollectedKey] = useState(false)
  // How many times the student has failed on this level (resets on level change / win).
  // Drives progressive hint messages and the toolbox block flash at 3+ failures.
  const [failureCount, setFailureCount] = useState(0)

  // ── Seen concepts (for concept intro modal) ────────────────────────────
  const [seenConcepts, setSeenConcepts] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('code-quest:seen-concepts')
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch { return [] }
  })
  const seenConceptsRef = useRef<string[]>(seenConcepts)
  useEffect(() => {
    seenConceptsRef.current = seenConcepts
    try { localStorage.setItem('code-quest:seen-concepts', JSON.stringify(seenConcepts)) }
    catch { /* quota */ }
  }, [seenConcepts])

  // ── Concept intro modal ─────────────────────────────────────────────────
  const [showConceptModal, setShowConceptModal] = useState(false)
  const [pendingConceptName, setPendingConceptName] = useState('')

  // ── Predict before you run ─────────────────────────────────────────────
  const [predictionAnswered, setPredictionAnswered] = useState(false)
  const [showPredictModal, setShowPredictModal] = useState(false)

  // ── Starter question ────────────────────────────────────────────────────
  const [starterQDismissed, setStarterQDismissed] = useState(false)
  const [currentStarterQ, setCurrentStarterQ] = useState<string>('')

  // ── Last run block count (for efficiency badge) ─────────────────────────
  const [lastBlockCount, setLastBlockCount] = useState<number>(0)

  // ── Output level state ────────────────────────────────────────────────────
  /** Lines captured from print() calls during an output level run. */
  const [outputLines, setOutputLines] = useState<string[]>([])
  /** Runtime error from an output level run, if any. */
  const [outputError, setOutputError] = useState<string | undefined>()

  // Block palette for this level — advanced blocks are unlocked progressively.
  const toolbox = useMemo(
    () => {
      if ('grid' in level) {
        return makeToolbox({
          conditionals: level.concepts.includes('conditionals'),
          variables: level.concepts.includes('variables'),
          repeatUntil: level.concepts.includes('repeatUntil'),
          functions: level.concepts.includes('functions'),
        })
      }
      // OutputLevel
      return makeOutputToolbox()
    },
    [level],
  )
  const [banner, setBanner] = useState<string>(
    'Drag blocks from the left into the workspace, then press Run.',
  )
  const [mastery, setMastery] = useState<Mastery>(INITIAL_MASTERY)

  // Per-level workspace XMLs — keyed by level ID, persisted to localStorage.
  // When the student switches levels their work is saved here automatically.
  const [workspacesMap, setWorkspacesMap] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem('code-quest:workspaces')
      return raw ? (JSON.parse(raw) as Record<string, string>) : {}
    } catch { return {} }
  })
  const workspacesMapRef = useRef<Record<string, string>>(workspacesMap)
  // Keep ref + localStorage in sync.
  useEffect(() => {
    workspacesMapRef.current = workspacesMap
    try { localStorage.setItem('code-quest:workspaces', JSON.stringify(workspacesMap)) }
    catch { /* quota — non-fatal */ }
  }, [workspacesMap])

  // The active workspace XML for the current level.
  // Initialised from the saved map so returning students see their prior work.
  const [workspaceXml, setWorkspaceXml] = useState<string>(
    () => workspacesMap[FIRST_LEVEL_ID] ?? ''
  )
  // Ref so advanceToLevel (a stable callback) can read the latest value.
  const workspaceXmlRef = useRef(workspaceXml)
  useEffect(() => { workspaceXmlRef.current = workspaceXml }, [workspaceXml])

  // Ref so advanceToLevel can read the current level ID without a stale closure.
  const levelIdRef = useRef(level.id)
  useEffect(() => { levelIdRef.current = level.id }, [level.id])

  const [chatContext, setChatContext] = useState<ChatContext | null>(null)
  const [eventsLog, setEventsLog] = useState<
    Array<{ type: string; at: string; data?: Record<string, unknown> }>
  >([])
  const workspaceRef = useRef<BlocklyWorkspaceHandle | null>(null)
  /** Mirrors the live Blockly.WorkspaceSvg for read-only ops (block counting, compile). */
  const workspaceSvgRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const handlersRef = useRef<RpcHandlers | null>(null)

  // ── PowerUp Client ─────────────────────────────────────────────────────
  const pu = usePowerUpClient({
    getHandlers: () => {
      if (!handlersRef.current) throw new Error('RPC handlers not yet initialized')
      return handlersRef.current
    },
    onHydrate: (data) => {
      if (!data) return
      if (data.mastery) setMastery(data.mastery)
      if (data.completedLevelIds) setCompletedLevelIds(data.completedLevelIds)
      // Restore per-level workspaces from SDK state (overrides localStorage).
      if (data.workspaces) {
        workspacesMapRef.current = data.workspaces
        setWorkspacesMap(data.workspaces)
      }
      // Restore custom levels from SDK state (overrides localStorage).
      if (data.customLevels?.length) {
        customLevelsRef.current = data.customLevels
        setCustomLevels(data.customLevels)
      }
      // Restore active level and its workspace.
      if (data.levelId) {
        const restored: AnyLevel | undefined = getLevel(data.levelId)
          ?? customLevelsRef.current.find((l) => l.id === data.levelId)
        if (restored) {
          setLevel(restored)
          if ('grid' in restored) setRobot(findStart(restored))
          const xml = data.workspaces?.[data.levelId] ?? data.workspaceXml ?? ''
          setWorkspaceXml(xml)
          workspaceXmlRef.current = xml
        }
      }
    },
    onContextReady: (ctx) => {
      setChatContext(ctx)
      if (ctx.themeConfig) setThemeConfig(ctx.themeConfig)
      if (ctx.themeConfig?.stage) setStage(ctx.themeConfig.stage)
      if (ctx.themeConfig?.codeLanguage) setCodeLang(ctx.themeConfig.codeLanguage)
    },
  })

  // Persist whenever mastery or workspace changes.
  const saveStateRef = useRef(pu.saveState)
  saveStateRef.current = pu.saveState
  const snapshotState = useCallback(
    (overrides?: Partial<CodeQuestState>): CodeQuestState => ({
      stage,
      levelId: level.id,
      workspaceXml,
      workspaces: workspacesMap,
      attempts: [],
      mastery,
      hintsUsed: 0,
      completedLevelIds,
      customLevels,
      ...overrides,
    }),
    [completedLevelIds, customLevels, level.id, mastery, stage, workspaceXml, workspacesMap],
  )

  // ── Event recorder ─────────────────────────────────────────────────────
  const recordEvent = useCallback(
    (type: string, data?: Record<string, unknown>) => {
      setEventsLog((prev) =>
        [{ type, at: new Date().toISOString(), data }, ...prev].slice(0, 80),
      )
      pu.publishEvent(
        type as Parameters<typeof pu.publishEvent>[0],
        data,
      )
    },
    [pu],
  )

  // ── Workspace ──────────────────────────────────────────────────────────
  const onWorkspaceChange = useCallback(
    (ws: Blockly.WorkspaceSvg, xml: string) => {
      workspaceSvgRef.current = ws
      setWorkspaceXml(xml)
      workspaceXmlRef.current = xml
      // Keep the per-level map in sync so switching away doesn't lose new blocks.
      workspacesMapRef.current = { ...workspacesMapRef.current, [levelIdRef.current]: xml }
      setWorkspacesMap({ ...workspacesMapRef.current })
      void saveStateRef.current(snapshotState({ workspaceXml: xml }))
      recordEvent('block-added', { blockCount: ws.getAllBlocks(false).length })
      // Stage 2+: compile blocks → Python + JavaScript + TypeScript for the code-reveal panel.
      if (stageRef.current >= 2) {
        setPythonCode(compileToPython(ws))
        const js = compileToJavaScript(ws)
        setJsCode(js)
        // Derive TypeScript via AST round-trip (adds type annotations to the JS output)
        const { nodes: tsNodes } = parseJavaScriptToAst(js)
        setTsCode(astToTypeScript(tsNodes))
      }
    },
    [recordEvent, snapshotState],
  )

  // Ref so runProgram can delegate to runOutputProgram without a forward-reference
  // dependency cycle. Populated after runOutputProgram is defined below.
  const runOutputProgramRef = useRef<() => Promise<void>>(async () => { /* filled below */ })

  // ── Game runner ────────────────────────────────────────────────────────
  const runProgram = useCallback(async (): Promise<RunOutcome> => {
    // Guard: runProgram is only for maze levels
    if (!('grid' in level)) {
      await runOutputProgramRef.current()
      return { passed: false, steps: 0, blockCount: 0, usedRepeat: false, usedConditional: false, usedVariables: false, usedMoveUntilWall: false, usedNestedLoop: false, usedFunctions: false, bonusConcepts: [], efficient: false }
    }
    // After the guard, level is guaranteed to be MazeLevel
    const mazeLevel = level as MazeLevel
    // Any kind of count-loop present (maze_repeat = fixed count, maze_repeat_steps = variable count)
    const usedRepeat       = /maze_repeat[^_]/.test(workspaceXml) || /maze_repeat"/.test(workspaceXml)
    const usedRepeatSteps  = /maze_repeat_steps/.test(workspaceXml)
    const usedAnyLoop      = usedRepeat || usedRepeatSteps
    const usedConditional  = /maze_if_has_key/.test(workspaceXml) || /maze_if_path_clear/.test(workspaceXml) || /maze_if_else_has_key/.test(workspaceXml)
    const usedVariables    = /maze_set_steps/.test(workspaceXml) && usedRepeatSteps
    const usedMoveUntilWall = /maze_move_until_wall/.test(workspaceXml)
    // Nested loops = two or more repeat blocks of any kind.
    const usedNestedLoop   = (workspaceXml.match(/type="maze_repeat/g) ?? []).length >= 2
    // Functions = define + call both present.
    const usedFunctions    = /maze_define_procedure/.test(workspaceXml) && /maze_call_procedure/.test(workspaceXml)

    const ws = workspaceSvgRef.current
    if (!ws) {
      return {
        passed: false, steps: 0, blockCount: 0,
        usedRepeat, usedConditional, usedVariables, usedMoveUntilWall, usedNestedLoop,
        usedFunctions, bonusConcepts: [],
        efficient: true, failure: 'no-blocks',
      }
    }
    const tokens = compileWorkspace(ws)
    const blockCount = ws.getAllBlocks(false).length
    recordEvent('attempt-run', { tokenCount: tokens.length, blockCount })

    if (tokens.length === 0) {
      setStatus('fail')
      setBanner('No blocks to run yet — drag a few in.')
      return {
        passed: false, steps: 0, blockCount,
        usedRepeat, usedConditional, usedVariables, usedMoveUntilWall, usedNestedLoop,
        usedFunctions, bonusConcepts: [],
        efficient: true, failure: 'no-blocks',
      }
    }

    setStatus('running')
    setBanner('Running…')
    setCollectedKey(false)
    const requiresKey = levelRequiresKey(mazeLevel)
    let cur = findStart(mazeLevel)
    setRobot(cur)

    let i = 0
    let failure: RunResult['failureSignal'] | undefined
    let stepCount = 0
    let hasKey = false

    // Runtime variable store + loop stack for variable-based repeats.
    const vars: Record<string, number> = {}
    const loopStack: Array<{ startIdx: number; remaining: number }> = []

    // Procedure registry: name → [startIdx+1 .. endIdx-1] token slice
    const procBodies: Record<string, string[]> = {}

    // First pass: collect all procedure definitions
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j]
      if (t.startsWith('define_proc:') && t.endsWith('_start')) {
        const name = t.slice('define_proc:'.length, -'_start'.length)
        const endToken = `define_proc:${name}_end`
        const endIdx = tokens.indexOf(endToken, j + 1)
        if (endIdx !== -1) {
          procBodies[name] = tokens.slice(j + 1, endIdx)
        }
      }
    }

    while (i < tokens.length && stepCount < level.maxSteps) {
      const tok = tokens[i]

      // ── Skip procedure definition bodies (already collected above) ─────
      if (tok.startsWith('define_proc:') && tok.endsWith('_start')) {
        const name = tok.slice('define_proc:'.length, -'_start'.length)
        const endToken = `define_proc:${name}_end`
        const endIdx = tokens.indexOf(endToken, i + 1)
        i = endIdx !== -1 ? endIdx + 1 : i + 1
        continue
      }
      if (tok.startsWith('define_proc:') && tok.endsWith('_end')) { i++; continue }

      // ── Procedure call ─────────────────────────────────────────────────
      if (tok.startsWith('call_proc:')) {
        const name = tok.slice('call_proc:'.length)
        const body = procBodies[name]
        if (body) {
          // Inline the body into the token stream by splicing it in after current pos
          tokens.splice(i, 1, ...body)
          // Don't advance i — re-process from the same position (now first body token)
          continue
        }
        i++
        continue
      }

      // ── Conditional (if has key) ───────────────────────────────────────
      if (tok === 'if-has-key-start') {
        i = hasKey ? i + 1 : findMatchingEnd(tokens, i) + 1
        continue
      }
      if (tok === 'if-has-key-end') { i++; continue }

      // ── If-has-key-else (from if/else has key block) ───────────────────
      // When we hit else while executing the "then" branch, jump to the end.
      if (tok === 'if-has-key-else') {
        i = findIfHasKeyEnd(tokens, i + 1) + 1
        continue
      }

      // ── if path clear ──────────────────────────────────────────────────
      if (tok === 'if-path-clear-start') {
        i = isPathClear(mazeLevel, cur) ? i + 1 : findMatchingPathClearEnd(tokens, i) + 1
        continue
      }
      if (tok === 'if-path-clear-end') { i++; continue }

      // ── Variable assignment ────────────────────────────────────────────
      // Token format: "set-var:steps:6"
      if (tok.startsWith('set-var:')) {
        const parts = tok.split(':')
        vars[parts[1]] = Number(parts[2])
        i++
        continue
      }
      // Token format: "set-var-from-var:paramName:srcVarName"
      if (tok.startsWith('set-var-from-var:')) {
        const parts = tok.split(':')
        vars[parts[1]] = vars[parts[2]] ?? 0
        i++
        continue
      }

      // ── Variable-based loop (repeat-var) ──────────────────────────────
      // Token format: "repeat-var-start:steps"
      if (tok.startsWith('repeat-var-start:')) {
        const varName = tok.split(':')[1]
        const count = vars[varName] ?? 0
        if (count <= 0) {
          // Variable is 0 or unset — skip the entire body.
          i = findMatchingVarEnd(tokens, i) + 1
        } else {
          loopStack.push({ startIdx: i, remaining: count - 1 })
          i++ // enter the body
        }
        continue
      }
      if (tok === 'repeat-var-end') {
        const frame = loopStack[loopStack.length - 1]
        if (frame && frame.remaining > 0) {
          frame.remaining--
          i = frame.startIdx + 1 // jump back into the body
        } else {
          loopStack.pop()
          i++
        }
        continue
      }

      // ── Move until wall ────────────────────────────────────────────────
      if (tok === 'move-until-wall') {
        while (stepCount < mazeLevel.maxSteps) {
          const probe = step(mazeLevel, cur, { op: 'move' })
          if ('failure' in probe) break // next step would fail — stop here
          cur = probe.robot
          setRobot(cur)
          stepCount++
          if (!hasKey && isAtKey(mazeLevel, cur)) { hasKey = true; setCollectedKey(true) }
          await sleep(220)
          if (isAtGoal(mazeLevel, cur)) break // also stop at the goal
        }
        i++
        continue
      }

      // ── Standard movement instructions ────────────────────────────────
      const { op, blockId } = parseToken(tok)
      const instr = TOKEN_TO_INSTRUCTION[op]
      if (!instr) { i++; continue }

      // Highlight the block being executed
      if (blockId) workspaceRef.current?.highlightBlock(blockId)

      const res = step(mazeLevel, cur, instr)
      stepCount++
      if ('failure' in res) {
        workspaceRef.current?.highlightBlock('')
        failure = res.failure
        break
      }
      cur = res.robot
      setRobot(cur)

      if (!hasKey && isAtKey(mazeLevel, cur)) { hasKey = true; setCollectedKey(true) }
      await sleep(220)
      workspaceRef.current?.highlightBlock('')

      if (isAtGoal(mazeLevel, cur)) {
        if (requiresKey && !hasKey) failure = 'door-locked'
        break
      }
      i++
    }
    if (stepCount >= mazeLevel.maxSteps && !isAtGoal(mazeLevel, cur)) failure = 'step-limit'
    // Always clear highlight at end of run
    workspaceRef.current?.highlightBlock('')

    // Check goal reached for move-until-wall case (loop may have stopped ON goal).
    const passed = !failure && isAtGoal(mazeLevel, cur) && (!requiresKey || hasKey)

    const targetsLoops        = mazeLevel.concepts.includes('loops')
    const targetsConditionals = mazeLevel.concepts.includes('conditionals')
    const targetsVariables    = mazeLevel.concepts.includes('variables')
    const targetsRepeatUntil  = mazeLevel.concepts.includes('repeatUntil')
    const targetsNestedLoops  = mazeLevel.concepts.includes('nestedLoops')
    const targetsFunctions    = mazeLevel.concepts.includes('functions')

    // "Efficient" = used the key constructs the level teaches.
    // A loop of any kind (fixed-count, variable-count, or inside a function) satisfies
    // the loops requirement; functions inside the solution satisfy functions requirement.
    const efficient =
      (!targetsLoops        || usedAnyLoop)        &&
      (!targetsConditionals || usedConditional)     &&
      (!targetsVariables    || usedVariables)       &&
      (!targetsRepeatUntil  || usedMoveUntilWall)   &&
      (!targetsNestedLoops  || usedNestedLoop)      &&
      (!targetsFunctions    || usedFunctions)

    // "Bonus concepts" = techniques the student used that go BEYOND this level's target.
    // These are celebrated rather than treated as inefficiency.
    const bonusConcepts: string[] = []
    if (!targetsFunctions    && usedFunctions)    bonusConcepts.push('Functions')
    if (!targetsLoops        && usedAnyLoop)       bonusConcepts.push('Loops')
    if (!targetsVariables    && usedVariables)     bonusConcepts.push('Variables')
    if (!targetsRepeatUntil  && usedMoveUntilWall) bonusConcepts.push('While Loops')
    if (!targetsNestedLoops  && usedNestedLoop)    bonusConcepts.push('Nested Loops')
    if (!targetsConditionals && usedConditional)   bonusConcepts.push('Conditionals')

    setStatus(passed ? 'win' : 'fail')
    setLastBlockCount(blockCount)

    if (passed) {
      const next: Mastery = { ...mastery }
      next.sequencing = Math.min(1, next.sequencing + 0.25)
      // Credit mastery for any loop type used
      if (targetsLoops)        next.loops       = Math.min(1, next.loops       + (usedAnyLoop       ? 0.4 : 0.1))
      if (targetsConditionals) next.conditionals= Math.min(1, next.conditionals+ (usedConditional   ? 0.4 : 0.1))
      if (targetsVariables)    next.variables   = Math.min(1, next.variables   + (usedVariables     ? 0.4 : 0.1))
      if (targetsRepeatUntil)  next.repeatUntil = Math.min(1, next.repeatUntil + (usedMoveUntilWall ? 0.4 : 0.1))
      if (targetsNestedLoops)  next.loops       = Math.min(1, next.loops       + (usedNestedLoop    ? 0.4 : 0.1))
      // Bonus concept mastery bumps — reward students for going beyond
      if (bonusConcepts.includes('Functions'))  next.loops       = Math.min(1, next.loops       + 0.1)
      if (bonusConcepts.includes('Loops'))      next.loops       = Math.min(1, next.loops       + 0.15)
      if (bonusConcepts.includes('Variables'))  next.variables   = Math.min(1, next.variables   + 0.15)

      setMastery(next)
      // Record this level as completed and persist everything together.
      const newCompleted = completedLevelIds.includes(mazeLevel.id)
        ? completedLevelIds
        : [...completedLevelIds, mazeLevel.id]
      setCompletedLevelIds(newCompleted)
      void saveStateRef.current(snapshotState({ mastery: next, completedLevelIds: newCompleted }))
      recordEvent('attempt-passed', {
        steps: stepCount, blockCount, usedRepeat, usedConditional, usedVariables,
        usedMoveUntilWall, usedNestedLoop, usedFunctions, bonusConcepts, efficient,
      })
      recordEvent('level-completed', { levelId: mazeLevel.id })

      setCanAdvance(true)
      setLastWinEfficient(efficient)
      setLastWinBonusConcepts(bonusConcepts)
      setFailureCount(0)  // reset on any win

      const nextLevel = getNextLevel(mazeLevel.id)
      const advanceCue = nextLevel
        ? ' Press "Next level →" when you\'re ready, or ask Dot.'
        : ' 🏆 That was the final level!'

      const winMsg = resolvedTheme.labels.winMessage ?? '🎉 Solved it!'

      if (bonusConcepts.length > 0) {
        // Student used MORE advanced techniques than the level requires — celebrate it.
        setBanner(`${winMsg} You used ${bonusConcepts.join(' + ')} — that's advanced!${advanceCue}`)
      } else if (efficient) {
        setBanner(`${winMsg}${advanceCue}`)
      } else {
        recordEvent('solved-inefficiently', { levelId: mazeLevel.id, blockCount, steps: stepCount })
        setBanner(`${winMsg} Is there another way to solve this?${advanceCue}`)
      }
    } else {
      // Don't count "no blocks" as a real failure attempt — the student hasn't tried yet.
      const realFailure = failure !== 'no-blocks'
      const newCount = realFailure ? failureCount + 1 : failureCount
      if (realFailure) setFailureCount(newCount)

      const character = resolvedTheme.labels.character ?? 'robot'
      const base = describeFailure(failure, resolvedTheme.labels.failMessages, character)
      const extra = realFailure
        ? buildFailureHint(mazeLevel, newCount, character)
        : ''
      setBanner(extra ? `${base} ${extra}` : base)
      recordEvent('attempt-failed', { failureSignal: failure, attemptNumber: newCount })
    }

    return {
      passed, steps: stepCount, blockCount,
      usedRepeat, usedConditional, usedVariables, usedMoveUntilWall, usedNestedLoop,
      usedFunctions, bonusConcepts,
      efficient, failure,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedLevelIds, failureCount, level, mastery, recordEvent, resolvedTheme, snapshotState, workspaceXml])

  /**
   * Stage 3 — Run the code currently in the editor.
   * Parses it into the same token format as compileWorkspace, then re-uses
   * the existing runProgram engine by temporarily injecting the tokens.
   * Returns the same RunOutcome so the rest of the run flow is unchanged.
   */
  const runFromCode = useCallback(async (): Promise<void> => {
    // Guard: runFromCode is only for maze levels (output levels use runOutputProgram)
    if (!('grid' in level)) { await runOutputProgramRef.current(); return }
    const mazeLevel = level as MazeLevel
    const code =
      codeLang === 'python' ? pythonEditorCode :
      codeLang === 'typescript' ? tsEditorCode :
      jsEditorCode
    // TypeScript is parsed by stripping type annotations then using the JS parser
    const { parseTypeScript } = await import('./game/ts-parser')
    const result =
      codeLang === 'python' ? parsePython(code) :
      codeLang === 'typescript' ? parseTypeScript(code) :
      parseJavaScript(code)
    if (result.errors.length > 0) {
      setParseErrors(result.errors)
      setBanner(`Fix the errors below before running.`)
      setStatus('fail')
      return
    }
    setParseErrors([])
    // Inject parsed tokens into workspaceSvgRef by temporarily overriding
    // the compileWorkspace path. We do this by directly calling the run
    // engine with a fake workspace signal.
    // Since we can't easily replace the workspace tokens without refactoring
    // the engine, we store the tokens in a ref and patch runProgram's
    // token source. Simpler: we replicate the run loop with our tokens.
    // For now, we rely on the engine already having these functions available.
    // The cleanest Stage 3 approach: store overrideTokens in a ref and check
    // it in runProgram. But that requires touching runProgram's internals.
    //
    // Instead, we encode the tokens into a synthetic workspace XML by writing
    // them to a ref that runProgram reads. But runProgram reads workspaceXml
    // and calls compileWorkspace(ws). So we need a different approach.
    //
    // ACTUAL APPROACH: We run the tokens directly here, using the same
    // step-by-step animation loop from runProgram, duplicated for the code path.
    // This avoids coupling but adds some duplication — acceptable for Stage 3.
    const tokens = result.tokens

    if (tokens.length === 0) {
      setStatus('fail')
      setBanner('No instructions found — write some code first!')
      return
    }

    setStatus('running')
    setBanner('Running…')
    setCollectedKey(false)

    const requiresKey = levelRequiresKey(mazeLevel)
    let cur = findStart(mazeLevel)
    setRobot(cur)

    let i = 0
    let failure: RunResult['failureSignal'] | undefined
    let stepCount = 0
    let hasKey = false
    const vars: Record<string, number> = {}
    const loopStack: Array<{ startIdx: number; remaining: number }> = []
    const procBodies: Record<string, string[]> = {}

    // First pass: collect procedure definitions
    for (let j = 0; j < tokens.length; j++) {
      const t = tokens[j]
      if (t.startsWith('define_proc:') && t.endsWith('_start')) {
        const name = t.slice('define_proc:'.length, -'_start'.length)
        const endToken = `define_proc:${name}_end`
        const endIdx = tokens.indexOf(endToken, j + 1)
        if (endIdx !== -1) procBodies[name] = tokens.slice(j + 1, endIdx)
      }
    }

    while (i < tokens.length && stepCount < mazeLevel.maxSteps) {
      const tok = tokens[i]

      if (tok.startsWith('define_proc:') && tok.endsWith('_start')) {
        const name = tok.slice('define_proc:'.length, -'_start'.length)
        const endIdx = tokens.indexOf(`define_proc:${name}_end`, i + 1)
        i = endIdx !== -1 ? endIdx + 1 : i + 1
        continue
      }
      if (tok.startsWith('define_proc:') && tok.endsWith('_end')) { i++; continue }

      if (tok.startsWith('call_proc:')) {
        const name = tok.slice('call_proc:'.length)
        const body = procBodies[name]
        if (body) { tokens.splice(i, 1, ...body); continue }
        i++; continue
      }

      if (tok === 'if-has-key-start') {
        i = hasKey ? i + 1 : findMatchingEnd(tokens, i) + 1; continue
      }
      if (tok === 'if-has-key-end') { i++; continue }
      if (tok === 'if-has-key-else') {
        i = findIfHasKeyEnd(tokens, i + 1) + 1; continue
      }
      if (tok === 'if-path-clear-start') {
        i = isPathClear(mazeLevel, cur) ? i + 1 : findMatchingPathClearEnd(tokens, i) + 1; continue
      }
      if (tok === 'if-path-clear-end') { i++; continue }

      if (tok.startsWith('set-var:')) {
        const parts = tok.split(':')
        vars[parts[1]] = Number(parts[2])
        i++; continue
      }
      if (tok.startsWith('set-var-from-var:')) {
        const parts = tok.split(':')
        vars[parts[1]] = vars[parts[2]] ?? 0
        i++; continue
      }
      if (tok.startsWith('repeat-var-start:')) {
        const varName = tok.split(':')[1]
        const count = vars[varName] ?? 0
        if (count <= 0) { i = findMatchingVarEnd(tokens, i) + 1 }
        else { loopStack.push({ startIdx: i, remaining: count - 1 }); i++ }
        continue
      }
      if (tok === 'repeat-var-end') {
        const frame = loopStack[loopStack.length - 1]
        if (frame && frame.remaining > 0) { frame.remaining--; i = frame.startIdx + 1 }
        else { loopStack.pop(); i++ }
        continue
      }

      if (tok === 'move-until-wall') {
        while (stepCount < mazeLevel.maxSteps) {
          const probe = step(mazeLevel, cur, { op: 'move' })
          if ('failure' in probe) break
          cur = probe.robot; setRobot(cur); stepCount++
          if (!hasKey && isAtKey(mazeLevel, cur)) { hasKey = true; setCollectedKey(true) }
          await sleep(220)
          if (isAtGoal(mazeLevel, cur)) break
        }
        i++; continue
      }

      // Standard movement (no block-id highlighting in code mode)
      const { op } = parseToken(tok)
      const instr = TOKEN_TO_INSTRUCTION[op]
      if (!instr) { i++; continue }

      const res = step(mazeLevel, cur, instr)
      stepCount++
      if ('failure' in res) { failure = res.failure; break }
      cur = res.robot; setRobot(cur)
      if (!hasKey && isAtKey(mazeLevel, cur)) { hasKey = true; setCollectedKey(true) }
      await sleep(220)
      if (isAtGoal(mazeLevel, cur)) {
        if (requiresKey && !hasKey) failure = 'door-locked'
        break
      }
      i++
    }
    if (stepCount >= mazeLevel.maxSteps && !isAtGoal(mazeLevel, cur)) failure = 'step-limit'

    const passed = !failure && isAtGoal(mazeLevel, cur) && (!requiresKey || hasKey)
    const blockCount = tokens.filter(t => ['move','turn-left','turn-right'].includes(parseToken(t).op)).length

    setStatus(passed ? 'win' : 'fail')
    setLastBlockCount(blockCount)

    if (passed) {
      const next: Mastery = { ...mastery }
      next.sequencing = Math.min(1, next.sequencing + 0.25)
      setMastery(next)
      const newCompleted = completedLevelIds.includes(mazeLevel.id)
        ? completedLevelIds
        : [...completedLevelIds, mazeLevel.id]
      setCompletedLevelIds(newCompleted)
      void saveStateRef.current(snapshotState({ mastery: next, completedLevelIds: newCompleted }))
      setCanAdvance(true)
      setLastWinEfficient(true)
      setLastWinBonusConcepts([])
      setFailureCount(0)
      const nextLevel = getNextLevel(mazeLevel.id)
      const advanceCue = nextLevel ? ' Press "Next level →" when you\'re ready.' : ' 🏆 Final level!'
      setBanner(`${resolvedTheme.labels.winMessage ?? '🎉 Solved it with real code!'}${advanceCue}`)
      recordEvent('attempt-passed', { steps: stepCount, blockCount, fromCode: true })
      recordEvent('level-completed', { levelId: mazeLevel.id })
    } else {
      const newCount = failure !== 'no-blocks' ? failureCount + 1 : failureCount
      if (failure !== 'no-blocks') setFailureCount(newCount)
      const character = resolvedTheme.labels.character ?? 'robot'
      setBanner(describeFailure(failure, resolvedTheme.labels.failMessages, character))
      recordEvent('attempt-failed', { failureSignal: failure, fromCode: true })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeLang, pythonEditorCode, jsEditorCode, level, mastery, completedLevelIds, failureCount, recordEvent, resolvedTheme, snapshotState])

  /**
   * Run an OutputLevel — compiles the Blockly workspace (or uses the code editor)
   * into JS print() calls, evaluates them in a sandbox, then checks the output.
   */
  const runOutputProgram = useCallback(async (): Promise<void> => {
    const lvl = level as OutputLevel
    setStatus('running')
    setBanner('Running…')
    setOutputLines([])
    setOutputError(undefined)
    recordEvent('attempt-run', { levelId: lvl.id })

    let jsCode: string
    if (workspaceTab === 'code') {
      // Code editor path: transpile the active language to JS
      const rawCode =
        codeLang === 'python' ? pythonEditorCode :
        codeLang === 'typescript' ? tsEditorCode :
        jsEditorCode
      jsCode = codeLang === 'python' ? transpilePythonToJs(rawCode) : rawCode
    } else {
      // Blocks path: compile workspace
      const ws = workspaceSvgRef.current
      if (!ws) {
        setStatus('fail')
        setBanner('No blocks to run yet — drag a few in.')
        return
      }
      jsCode = compileOutputWorkspace(ws)
    }

    if (!jsCode.trim()) {
      setStatus('fail')
      setBanner('No blocks to run yet — drag a few in.')
      return
    }

    const { output, error } = runOutput(jsCode)
    setOutputLines(output)
    setOutputError(error)

    const passed = !error && checkOutput(output, lvl.expectedOutput)
    setStatus(passed ? 'win' : 'fail')
    setLastBlockCount(workspaceSvgRef.current?.getAllBlocks(false).length ?? 0)

    if (passed) {
      const newCompleted = completedLevelIds.includes(lvl.id)
        ? completedLevelIds
        : [...completedLevelIds, lvl.id]
      setCompletedLevelIds(newCompleted)
      void saveStateRef.current(snapshotState({ completedLevelIds: newCompleted }))
      setCanAdvance(true)
      setLastWinEfficient(true)
      setLastWinBonusConcepts([])
      setFailureCount(0)
      recordEvent('attempt-passed', { levelId: lvl.id, lines: output.length })
      recordEvent('level-completed', { levelId: lvl.id })
      const nextLevel = getNextLevel(lvl.id)
      const advanceCue = nextLevel
        ? ' Press "Next level →" when you\'re ready.'
        : ' 🏆 That was the final level!'
      const winMsg = resolvedTheme.labels.winMessage ?? '🎉 Solved it!'
      setBanner(`${winMsg}${advanceCue}`)
    } else {
      const newCount = failureCount + 1
      setFailureCount(newCount)
      if (error) {
        setBanner(`💥 Your code threw an error — see the output panel for details.`)
      } else {
        const totalExpected = lvl.expectedOutput.length
        const matched = output.filter((l, i) => lvl.expectedOutput[i] !== undefined && l.trim() === lvl.expectedOutput[i].trim()).length
        setBanner(`Not quite — ${matched}/${totalExpected} lines match. Check the expected output below.`)
      }
      recordEvent('attempt-failed', { levelId: lvl.id, matched: output.length, expected: lvl.expectedOutput.length })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, workspaceTab, codeLang, pythonEditorCode, jsEditorCode, tsEditorCode, completedLevelIds, failureCount, recordEvent, resolvedTheme, snapshotState])

  // Keep the ref current so runProgram can delegate without a circular dep.
  useEffect(() => { runOutputProgramRef.current = runOutputProgram }, [runOutputProgram])

  /**
   * Switch to a level by ID. Checks static levels first, then custom levels.
   * An optional `override` level object can be passed directly (used when
   * the level was just created and may not yet be in React state).
   */
  const advanceToLevel = useCallback(
    (nextId: string, override?: AnyLevel) => {
      const next =
        override ??
        getLevel(nextId) ??
        customLevelsRef.current.find((l) => l.id === nextId)
      if (!next) return

      // Save the current level's workspace before switching.
      const currentId = levelIdRef.current
      const currentXml = workspaceXmlRef.current
      const updatedMap = { ...workspacesMapRef.current, [currentId]: currentXml }
      workspacesMapRef.current = updatedMap
      setWorkspacesMap(updatedMap)

      // Restore the saved workspace for the target level (or blank if first visit).
      const nextXml = updatedMap[nextId] ?? ''
      workspaceXmlRef.current = nextXml
      setWorkspaceXml(nextXml)

      setLevel(next)
      // Only maze levels have a robot position
      if ('grid' in next) setRobot(findStart(next))
      setStatus('idle')
      setCanAdvance(false)
      setLastWinEfficient(true)
      setCollectedKey(false)
      setFailureCount(0)
      setPredictionAnswered(false)
      setStarterQDismissed(false)
      // Clear output state when leaving/entering output levels
      setOutputLines([])
      setOutputError(undefined)
      // Pick a random starter question for this level
      const qs = next.lesson.starterQuestions
      setCurrentStarterQ(qs[Math.floor(Math.random() * qs.length)])
      const story = ('grid' in next ? labelsRef.current.levelStories?.[nextId] : undefined) ?? next.goal
      setBanner(`${next.name}: ${story}`)
      void saveStateRef.current(
        snapshotState({ levelId: nextId, workspaceXml: nextXml, workspaces: updatedMap }),
      )
      recordEvent('level-advanced', { levelId: nextId })
      // Signal Dot to introduce the new concept. All three starter questions
      // are included so Dot can pick the one that fits the conversation.
      recordEvent('lesson-intro', {
        levelId: nextId,
        levelName: next.name,
        concept: next.lesson.concept,
        explanation: next.lesson.explanation,
        starterQuestions: next.lesson.starterQuestions,
        ahaMoment: next.lesson.ahaMoment,
      })
      // Check if the concept is new — show intro modal if so
      const concept = next.lesson.concept
      if (!seenConceptsRef.current.includes(concept)) {
        setPendingConceptName(concept)
        setShowConceptModal(true)
        seenConceptsRef.current = [...seenConceptsRef.current, concept]
        setSeenConcepts(seenConceptsRef.current)
      }
    },
    [recordEvent, snapshotState],
  )

  /** Advance to the next level in the progression, if there is one. */
  const goToNextLevel = useCallback(() => {
    const next = getNextLevel(level.id)
    if (next) advanceToLevel(next.id, next)
  }, [advanceToLevel, level.id])

  const reset = useCallback(() => {
    if ('grid' in level) setRobot(findStart(level))
    setStatus('idle')
    setCollectedKey(false)
    setOutputLines([])
    setOutputError(undefined)
    setBanner('grid' in level ? 'Drag blocks from the left into the workspace, then press Run.' : 'Drag blocks into the workspace and press Run to see the output.')
  }, [level])

  const requestHint = useCallback(
    (hintLevel: 1 | 2 | 3 = 2): string => {
      recordEvent('hint-requested', { levelId: level.id, hintLevel })
      const hint = level.hints[hintLevel]
      setBanner(`💡 ${hint}`)
      return hint
    },
    [level, recordEvent],
  )

  // ── Import/Export ─────────────────────────────────────────────────────
  const importInputRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  /** Export a level + its saved workspace as a .cq.json file. */
  const handleExport = useCallback((lvl: MazeLevel) => {
    const xml = workspacesMapRef.current[lvl.id] ?? ''
    exportMaze(lvl, xml)
  }, [])

  /** Process a file or pasted text as a MazeShare bundle. */
  const handleImportText = useCallback((text: string) => {
    const result = parseMazeShare(text)
    if (!result.ok) {
      setImportStatus({ type: 'error', message: result.error })
      return
    }
    const rawId = result.level.id
    const id = rawId.startsWith('custom-') ? rawId : `custom-${rawId}`
    const lvl: MazeLevel = { ...result.level, id }
    upsertCustomLevel(lvl)
    // Restore the imported solution if present.
    if (result.solution) {
      workspacesMapRef.current = { ...workspacesMapRef.current, [id]: result.solution }
      setWorkspacesMap({ ...workspacesMapRef.current })
    }
    advanceToLevel(id, lvl)
    setBuildOpen(true)
    setImportStatus({ type: 'success', message: `"${lvl.name}" imported!` })
  }, [advanceToLevel, upsertCustomLevel])

  const handleImportFile = useCallback(async (file: File) => {
    try {
      const text = await readFileText(file)
      handleImportText(text)
    } catch {
      setImportStatus({ type: 'error', message: 'Could not read the file.' })
    }
  }, [handleImportText])

  // ── Level builder callbacks ────────────────────────────────────────────
  const handleRequestBuild = useCallback(() => {
    const desc = buildDescription.trim()
    if (!desc) return
    setBuildStatus({ type: 'idle', message: 'Request sent to Dot — waiting for level...' })
    recordEvent('level-builder-requested', { description: desc })
    setBuildDescription('')
  }, [buildDescription, recordEvent])

  const handleLoadJson = useCallback(() => {
    const text = buildJsonText.trim()
    if (!text) return
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      setBuildStatus({
        type: 'error',
        message: `JSON parse error: ${e instanceof Error ? e.message : String(e)}`,
      })
      return
    }
    const result = validateLevel(parsed)
    if (!result.valid) {
      setBuildStatus({ type: 'error', message: `Invalid level: ${result.error}` })
      return
    }
    const raw = parsed as MazeLevel
    const id = raw.id.startsWith('custom-') ? raw.id : `custom-${raw.id}`
    const lvl: MazeLevel = { ...raw, id }
    upsertCustomLevel(lvl)  // sync ref + flush state
    advanceToLevel(id, lvl)
    setBuildStatus({ type: 'success', message: `"${lvl.name}" loaded!` })
    setBuildJsonText('')
    setBuildMode('describe')
  }, [advanceToLevel, buildJsonText, upsertCustomLevel])

  // ── Wire RPC handlers ──────────────────────────────────────────────────
  useEffect(() => {
    handlersRef.current = {
      open: async () => ok('Code Quest opened.'),
      evaluateAttempt: async () => {
        const r = await runProgram()
        const nextLevel = getNextLevel(level.id)
        const nextNote = nextLevel
          ? `A harder level is available: "${nextLevel.name}" (id: ${nextLevel.id}). ` +
            `Only advance if the student asks — call setLevel with that id, or tell them to press "Next level".`
          : `This is the final level.`
        if (!r.passed) {
          if (r.failure === 'door-locked') {
            return ok(
              `Reached the door but it's LOCKED — the student didn't pick up the key first. ` +
                `Gently point out they need the key (🔑) before the door, and ask what they should ` +
                `do first. Don't advance.`,
            )
          }
          if (!('grid' in level)) {
            return ok(
              `Output level did not produce the expected output. ` +
                `Help the student check their print() calls and expected output. Don't advance.`,
            )
          }
          return ok(
            `Did not solve (signal: ${r.failure ?? 'no-goal'}). ` +
              `The student should keep trying — offer a Socratic hint, don't advance.`,
          )
        }
        // Solved!
        if (!('grid' in level)) {
          return ok(`Output level solved! Student printed the correct output. ${nextNote}`)
        }
        // The "tidy" construct depends on what the maze level teaches.
        const construct = level.concepts.includes('conditionals')
          ? 'a conditional (if-has-key) block'
          : level.concepts.includes('variables')
          ? 'set-steps + repeat-[steps] (variable-based loop)'
          : level.concepts.includes('repeatUntil')
          ? 'a "move forward until wall" block'
          : level.concepts.includes('nestedLoops')
          ? 'a nested loop (repeat block inside another repeat block)'
          : 'a loop (repeat) block'
        if (r.efficient) {
          return ok(
            `Solved in ${r.steps} steps with ${r.blockCount} blocks, using ${construct} — that's the tidy way. ` +
              `Celebrate, then ${nextNote}`,
          )
        }
        // Solved, but without the key construct this level teaches.
        return ok(
          `Solved in ${r.steps} steps with ${r.blockCount} blocks, but WITHOUT ${construct}. ` +
            `Their solution works — celebrate that first. Then, out of genuine curiosity, ask ` +
            `"Is there another way you could solve this?" and see if they want to explore ` +
            `${construct} on their own. Don't say their way is wrong or messy. ` +
            `If they want a nudge, suggest: "${level.hints[1]}". ${nextNote}`,
        )
      },
      generateHint: async ({ level: hl = 2 }) => ok(requestHint(hl)),
      getMastery: async () =>
        ok(
          `Mastery — ${formatMastery(mastery)} (level: ${level.id}). ` +
            `${canAdvance ? `Student has solved this level${lastWinEfficient ? ' cleanly' : ' but inefficiently'} and may advance when ready.` : 'Student has not solved this level yet.'}`,
        ),
      setLevel: async ({ levelId }) => {
        if (!levelId) return fail('levelId required')
        if (levelId === level.id) return ok(`Already on level ${levelId}.`)
        const allKnown = [...ALL_LEVELS, ...customLevelsRef.current]
        const target = allKnown.find((l) => l.id === levelId)
        if (!target) {
          return fail(
            `Unknown levelId: "${levelId}". Known IDs: ${allKnown.map((l) => l.id).join(', ')}.`,
          )
        }
        advanceToLevel(levelId, target)
        return ok(`Switched to level "${target.name}" (${levelId}).`)
      },
      getLevelLesson: async () => {
        const { lesson } = level
        return ok(
          JSON.stringify({
            levelId: level.id,
            levelName: level.name,
            concept: lesson.concept,
            explanation: lesson.explanation,
            starterQuestions: lesson.starterQuestions,
            ahaMoment: lesson.ahaMoment,
          }),
        )
      },
      buildLevel: async (args) => {
        // Claude provides the full MazeLevel-shaped object as the tool args.
        const result = validateLevel(args)
        if (!result.valid) {
          return fail(
            `Invalid level: ${result.error}. Please correct the issue and call buildLevel again.`,
          )
        }
        const raw = args as unknown as MazeLevel
        // Prefix custom- to avoid collisions with built-in level IDs.
        const id = raw.id.startsWith('custom-') ? raw.id : `custom-${raw.id}`
        const lvl: MazeLevel = { ...raw, id }
        upsertCustomLevel(lvl)  // sync ref + flush state before ID changes
        advanceToLevel(id, lvl)
        setBuildStatus({ type: 'success', message: `"${lvl.name}" loaded!` })
        return ok(
          `Custom level "${lvl.name}" (id: ${id}) created and activated! ` +
            `Grid: ${lvl.grid.length} rows x ${lvl.grid[0].length} cols. ` +
            `Concepts: ${lvl.concepts.join(', ')}. ` +
            `Tell the student their custom challenge is ready and ask if they'd like a hint to get started!`,
        )
      },
    }
  }, [advanceToLevel, canAdvance, lastWinEfficient, level, mastery, requestHint, runProgram, upsertCustomLevel])

  const bannerClass = useMemo(() => {
    if (status === 'win') return 'banner win'
    if (status === 'fail') return 'banner fail'
    return 'banner idle'
  }, [status])

  const labels = resolvedTheme.labels

  // Stable ref so callbacks registered once (advanceToLevel) always read fresh labels.
  const labelsRef = useRef(labels)
  useEffect(() => { labelsRef.current = labels }, [labels])

  // ── Initial concept modal check (Level 1 on first visit) ───────────────
  useEffect(() => {
    const concept = level.lesson.concept
    if (!seenConceptsRef.current.includes(concept)) {
      setPendingConceptName(concept)
      setShowConceptModal(true)
      seenConceptsRef.current = [...seenConceptsRef.current, concept]
      setSeenConcepts(seenConceptsRef.current)
    }
    // Pick initial starter question
    const qs = level.lesson.starterQuestions
    setCurrentStarterQ(qs[Math.floor(Math.random() * qs.length)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // intentionally run once on mount

  // ── Stage 3: cross-language change handlers ────────────────────────────
  // When the student edits in one language, immediately cross-compile to the
  // other so switching language pills shows equivalent code.  Also tracks the
  // parsed AST in `pendingAstRef` so switching back to Blocks reconstructs the
  // workspace.
  // ── Format / cross-sync helper ────────────────────────────────────────────
  // Mutable ref so formatCode can read current values without stale closures.
  const editorCodeRef = useRef({ python: pythonEditorCode, javascript: jsEditorCode, typescript: tsEditorCode })
  editorCodeRef.current = { python: pythonEditorCode, javascript: jsEditorCode, typescript: tsEditorCode }

  /**
   * Parse the current code for `lang`, regenerate all three editors from the
   * resulting AST (auto-format + sync).  No-ops silently if the code has errors.
   */
  const formatCode = useCallback((lang: 'python' | 'javascript' | 'typescript') => {
    const code = editorCodeRef.current[lang]
    const result =
      lang === 'python'     ? parsePythonToAst(code) :
      lang === 'javascript' ? parseJavaScriptToAst(code) :
                              parseTypeScriptToAst(code)
    const { nodes, errors } = result
    if (errors.length === 0 && nodes.length > 0) {
      setParseErrors([])
      setPythonEditorCode(astToPython(nodes))
      setJsEditorCode(astToJavaScript(nodes))
      setTsEditorCode(astToTypeScript(nodes))
    }
  }, [])

  const handlePythonCodeChange = useCallback((code: string) => {
    setPythonEditorCode(code)
    const { nodes, errors } = parsePythonToAst(code)
    setParseErrors(errors)
    if (errors.length === 0 && nodes.length > 0) {
      pendingAstRef.current = nodes
      setJsEditorCode(astToJavaScript(nodes))
      setTsEditorCode(astToTypeScript(nodes))
    }
    // On error: keep showing errors but don't clobber the other editors
  }, [])

  const handleJsCodeChange = useCallback((code: string) => {
    setJsEditorCode(code)
    const { nodes, errors } = parseJavaScriptToAst(code)
    setParseErrors(errors)
    if (errors.length === 0 && nodes.length > 0) {
      pendingAstRef.current = nodes
      setPythonEditorCode(astToPython(nodes))
      setTsEditorCode(astToTypeScript(nodes))
    }
  }, [])

  const handleTsCodeChange = useCallback((code: string) => {
    setTsEditorCode(code)
    const { nodes, errors } = parseTypeScriptToAst(code)
    setParseErrors(errors)
    if (errors.length === 0 && nodes.length > 0) {
      pendingAstRef.current = nodes
      setPythonEditorCode(astToPython(nodes))
      setJsEditorCode(astToJavaScript(nodes))
    }
  }, [])

  // ── Stage 3: tab switch logic ───────────────────────────────────────────
  // Code → Blocks: apply the pending AST to reconstruct the Blockly workspace.
  // Blocks → Code: populate editors from the freshly-compiled block code.
  useEffect(() => {
    if (workspaceTab === 'code') {
      // Populate editors from the current block compilation
      setPythonEditorCode(pythonCode)
      setJsEditorCode(jsCode)
      setTsEditorCode(tsCode)
      setParseErrors([])
      pendingAstRef.current = []
    } else {
      // Switching back to blocks — reconstruct workspace from typed code if changed
      const nodes = pendingAstRef.current
      if (nodes.length > 0) {
        const state = astToBlocklyState(nodes)
        workspaceRef.current?.loadState(state)
        pendingAstRef.current = []
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceTab])

  // ── Stage 3: reset to blocks tab on level change ────────────────────────
  useEffect(() => {
    setWorkspaceTab('blocks')
    setParseErrors([])
    pendingAstRef.current = []
  }, [level.id])

  return (
    <ThemeProvider config={themeConfig}>
    <>
    <div className="app">
      <header className="header">
        <select
          className="theme-switcher"
          value={themeConfig?.preset ?? 'default'}
          onChange={(e) => {
            const preset = e.target.value as ThemeConfig['preset']
            setThemeConfig(preset ? { preset } : null)
            const url = new URL(location.href)
            if (preset && preset !== 'default') url.searchParams.set('theme', preset)
            else url.searchParams.delete('theme')
            history.replaceState(null, '', url.toString())
          }}
        >
          <option value="default">🤖 Default</option>
          <option value="space">🚀 Space</option>
          <option value="sports">⚽ Sports</option>
          <option value="music">🎵 Music</option>
          <option value="art">🖌️ Art</option>
          <option value="animals">🦊 Animals</option>
          <option value="princess">👸 Princess</option>
          <option value="chef">👨‍🍳 Chef</option>
          <option value="ocean">🐟 Ocean</option>
          <option value="hero">⚡ Hero</option>
          <option value="racing">🏎️ Racing</option>
          <option value="farm">🌾 Farm</option>
        </select>
        {labels.schoolLogoUrl && (
          <img
            src={labels.schoolLogoUrl}
            alt={labels.schoolName ?? ''}
            style={{ height: 28, borderRadius: 4, objectFit: 'contain' }}
          />
        )}
        <h1>
          {labels.appTitle ?? 'Code Quest'}
          {' '}
          <span style={{ fontWeight: 400, opacity: 0.6, fontSize: 13 }}>— PowerUp Prototype</span>
          {labels.schoolName && (
            <span style={{ marginLeft: 10, opacity: 0.75, fontSize: 14 }}>{labels.schoolName}</span>
          )}
        </h1>
        <span className="level">
          {(() => {
            const idx = ALL_LEVELS.findIndex((l) => l.id === level.id)
            const total = ALL_LEVELS.length + customLevels.length
            return idx >= 0
              ? `Stage ${stage} · Level ${idx + 1}/${total}: ${level.name}`
              : `Stage ${stage} · Custom: ${level.name}`
          })()}
          {' · '}
          <ConnectionBadge
            isConnected={pu.isConnected}
            isStandalone={pu.isStandalone}
            error={pu.error}
          />
          {chatContext?.teacherRole && ` · ${chatContext.teacherRole}`}
        </span>
      </header>

      <div className="layout">
        <div className="workspace-game-area">
        {/* Workspace */}
        <div className="panel is-workspace">
          <h2>{labels.panelWorkspace ?? 'Workspace'}</h2>

          {/* Stage 3+: Blocks | Code tab switcher */}
          {stage >= 3 && (
            <div className="ws-mode-tabs">
              <button
                className={`ws-mode-tab${workspaceTab === 'blocks' ? ' active' : ''}`}
                onClick={() => setWorkspaceTab('blocks')}
              >
                🧩 Blocks
              </button>
              <button
                className={`ws-mode-tab${workspaceTab === 'code' ? ' active' : ''}`}
                onClick={() => setWorkspaceTab('code')}
              >
                {'</>'}  Code
              </button>
            </div>
          )}

          {/* ── Blocks tab ── */}
          <div className="workspace" style={{ display: workspaceTab === 'blocks' ? 'flex' : 'none', flexDirection: 'column', flex: 1 }}>
            {/* `key` forces Blockly to remount when the level changes — otherwise
                the toolbox keeps blocks from the previous level's solution. */}
            <BlocklyWorkspace
              key={level.id}
              ref={workspaceRef}
              onChange={onWorkspaceChange}
              initialXml={workspaceXml}
              toolbox={toolbox}
              flashBlockType={failureCount >= 3 && 'grid' in level ? getHintBlockType(level as MazeLevel) : null}
            />
          </div>

          {/* ── Code editor tab (Stage 3+) ── */}
          {stage >= 3 && workspaceTab === 'code' && (
            <div className="code-tab-body">
              {/* Language picker + format + syntax-hints toggle */}
              <div className="code-tab-lang-row">
                <button
                  className={`code-lang-pill${codeLang === 'python' ? ' active' : ''}`}
                  onClick={() => { formatCode(codeLang); setCodeLang('python') }}
                >
                  {/* Python official logo (flat colours — avoids SVG gradient-ID conflicts) */}
                  <svg width="15" height="15" viewBox="0 0 256 255" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                    <path d="M126.916.072c-64.832 0-60.784 28.115-60.784 28.115l.072 29.128h61.868v8.745H41.631S.145 61.355.145 126.77c0 65.417 36.21 63.097 36.21 63.097h21.61v-30.356s-1.165-36.21 35.632-36.21h61.362s34.475.557 34.475-33.319V33.97S194.67.072 126.916.072zm-34.349 19.573c6.065 0 10.993 4.928 10.993 11.026 0 6.06-4.928 10.994-10.993 10.994-6.06 0-10.987-4.935-10.987-10.994 0-6.097 4.927-11.026 10.987-11.026z" fill="#3776AB"/>
                    <path d="M128.757 254.126c64.832 0 60.784-28.115 60.784-28.115l-.072-29.127H127.6v-8.745h86.441s41.486 4.705 41.486-60.712c0-65.416-36.21-63.096-36.21-63.096h-21.61v30.355s1.165 36.21-35.632 36.21h-61.362s-34.475-.557-34.475 33.32v56.013s-5.235 33.897 62.519 33.897zm34.347-19.574c-6.065 0-10.993-4.927-10.993-11.025 0-6.06 4.928-10.994 10.993-10.994 6.06 0 10.987 4.935 10.987 10.994 0 6.098-4.927 11.025-10.987 11.025z" fill="#FFD43B"/>
                  </svg>
                  Python
                </button>
                <button
                  className={`code-lang-pill${codeLang === 'javascript' ? ' active' : ''}`}
                  onClick={() => { formatCode(codeLang); setCodeLang('javascript') }}
                >
                  {/* JavaScript official logo */}
                  <svg width="15" height="15" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                    <rect width="256" height="256" fill="#F7DF1E"/>
                    <path d="M67.312 213.932l19.59-11.856c3.78 6.701 7.218 12.371 15.465 12.371 7.905 0 12.89-3.092 12.89-15.12v-81.798h24.057v82.138c0 24.917-14.606 36.259-35.916 36.259-19.245 0-30.416-9.967-36.087-21.994M152.381 211.354l19.588-11.341c5.157 8.421 11.859 14.607 23.715 14.607 9.969 0 16.325-4.984 16.325-11.858 0-8.248-6.53-11.17-17.528-15.98l-6.013-2.58c-17.357-7.387-28.87-16.667-28.87-36.257 0-18.044 13.747-31.792 35.228-31.792 15.294 0 26.292 5.328 34.196 19.247l-18.731 12.03c-4.125-7.389-8.591-10.31-15.465-10.31-7.046 0-11.514 4.468-11.514 10.31 0 7.217 4.468 10.14 14.778 14.606l6.013 2.581c20.45 8.765 31.963 17.7 31.963 37.804 0 21.654-17.012 33.51-39.867 33.51-22.339 0-36.774-10.654-43.818-24.577" fill="#323330"/>
                  </svg>
                  JavaScript
                </button>
                <button
                  className={`code-lang-pill${codeLang === 'typescript' ? ' active' : ''}`}
                  onClick={() => { formatCode(codeLang); setCodeLang('typescript') }}
                >
                  {/* TypeScript official logo */}
                  <svg width="15" height="15" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                    <rect width="256" height="256" rx="20" fill="#3178C6"/>
                    <path d="M150.518 200.475v27.62c4.492 2.302 9.805 4.028 15.938 5.179 6.133 1.151 12.597 1.726 19.393 1.726 6.622 0 12.914-.633 18.874-1.899 5.96-1.266 11.187-3.352 15.678-6.257 4.492-2.906 8.048-6.704 10.669-11.394 2.62-4.689 3.93-10.486 3.93-17.391 0-5.006-.749-9.394-2.246-13.165a30.748 30.748 0 00-6.479-10.055c-2.821-2.935-6.205-5.567-10.149-7.898-3.945-2.33-8.394-4.531-13.347-6.602-3.628-1.497-6.881-2.949-9.761-4.359-2.879-1.41-5.327-2.848-7.342-4.316-2.016-1.467-3.571-3.021-4.665-4.661-1.094-1.64-1.641-3.495-1.641-5.567 0-1.899.489-3.61 1.468-5.135s2.362-2.834 4.147-3.927c1.785-1.094 3.973-1.942 6.565-2.547 2.591-.604 5.471-.906 8.638-.906 2.304 0 4.737.173 7.299.518 2.563.345 5.14.877 7.732 1.597a53.669 53.669 0 017.558 2.719 41.7 41.7 0 016.781 3.797v-25.807c-4.204-1.611-8.797-2.805-13.778-3.582-4.981-.777-10.697-1.165-17.147-1.165-6.565 0-12.784.705-18.658 2.116-5.874 1.409-11.043 3.61-15.506 6.602-4.463 2.993-7.99 6.805-10.582 11.437-2.591 4.632-3.887 10.17-3.887 16.615 0 8.228 2.375 15.248 7.127 21.06 4.751 5.811 11.963 10.731 21.638 14.759a291.458 291.458 0 0110.625 4.575c3.283 1.496 6.119 3.049 8.509 4.66 2.39 1.611 4.276 3.366 5.658 5.265 1.382 1.899 2.073 4.057 2.073 6.474a9.901 9.901 0 01-1.296 4.963c-.863 1.524-2.174 2.848-3.930 3.97-1.756 1.122-3.945 1.999-6.565 2.632-2.62.633-5.687.95-9.2.95-5.989 0-11.92-1.05-17.794-3.151-5.875-2.1-11.317-5.25-16.329-9.451zm-46.036-68.733H140V109H41v22.742h45.516V233h27.966V131.742z" fill="#FFF"/>
                  </svg>
                  TypeScript
                </button>
                <button
                  className="code-lang-pill"
                  onClick={() => formatCode(codeLang)}
                  title="Format and sync all editors"
                >✨ Format</button>
                <span className="code-tab-hint">Edit the code, then press Run</span>
                <button
                  className={`code-lang-pill code-hints-toggle${showSyntaxHints ? ' active' : ''}`}
                  onClick={() => setShowSyntaxHints(v => !v)}
                  title={showSyntaxHints ? 'Hide syntax explanations' : 'Show syntax explanations'}
                >
                  {showSyntaxHints ? '💬 Hints ON' : '💬 Hints OFF'}
                </button>
              </div>

              {/* All three editors are always mounted so their CM instances stay
                  alive and receive programmatic value updates even when hidden.
                  CSS display toggles which one is visible. */}

              {/* Python editor */}
              <div style={{ display: codeLang === 'python' ? 'flex' : 'none', flex: 1, flexDirection: 'column', minHeight: 0 }}>
                <CodeEditor
                  key={`py-${level.id}`}
                  value={pythonEditorCode}
                  onChange={handlePythonCodeChange}
                  language="python"
                  showSyntaxHints={showSyntaxHints}
                />
              </div>

              {/* JavaScript editor */}
              <div style={{ display: codeLang === 'javascript' ? 'flex' : 'none', flex: 1, flexDirection: 'column', minHeight: 0 }}>
                <CodeEditor
                  key={`js-${level.id}`}
                  value={jsEditorCode}
                  onChange={handleJsCodeChange}
                  language="javascript"
                  showSyntaxHints={showSyntaxHints}
                />
              </div>

              {/* TypeScript editor */}
              <div style={{ display: codeLang === 'typescript' ? 'flex' : 'none', flex: 1, flexDirection: 'column', minHeight: 0 }}>
                <CodeEditor
                  key={`ts-${level.id}`}
                  value={tsEditorCode}
                  onChange={handleTsCodeChange}
                  language="typescript"
                  showSyntaxHints={showSyntaxHints}
                />
              </div>

              {/* Parse errors */}
              {parseErrors.length > 0 && (
                <div className="parse-errors">
                  {parseErrors.map((e, i) => (
                    <div key={i} className="parse-error">
                      <span className="parse-error-line">Line {e.line}</span>
                      <span>{e.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Controls row ── */}
          <div className="controls">
            {workspaceTab === 'blocks' ? (
              <>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if ('grid' in level && !predictionAnswered && level.prediction) {
                      setShowPredictModal(true)
                    } else if ('grid' in level) {
                      void runProgram()
                    } else {
                      void runOutputProgram()
                    }
                  }}
                  disabled={status === 'running'}
                >
                  {labels.btnRun ?? '▶ Run'}
                </button>
                <button className="btn" onClick={reset} disabled={status === 'running'}>
                  {'grid' in level ? (labels.btnReset ?? 'Reset robot') : 'Reset'}
                </button>
                {'grid' in level && (
                  <button className="btn" onClick={() => requestHint(2)}>
                    💡 Hint
                  </button>
                )}
                {'grid' in level && (
                  <button
                    className="btn"
                    onClick={() => handleExport(level)}
                    title="Download this maze + your solution as a .cq.json file"
                  >
                    📤 Share
                  </button>
                )}
                {/* Stage 2 only: "See the Code" reveal panel — hidden at stage 3+ since code tab replaces it */}
                {'grid' in level && stage === 2 && (
                  <button
                    className={`btn${showPythonPanel ? ' btn-active' : ''}`}
                    onClick={() => setShowPythonPanel((v) => !v)}
                    title="See your blocks as Python or JavaScript code"
                  >
                    👁 See the Code
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    if ('grid' in level) {
                      void runFromCode()
                    } else {
                      void runOutputProgram()
                    }
                  }}
                  disabled={status === 'running'}
                >
                  ▶ Run Code
                </button>
                <button className="btn" onClick={reset} disabled={status === 'running'}>
                  {'grid' in level ? (labels.btnReset ?? 'Reset robot') : 'Reset'}
                </button>
                {'grid' in level && (
                  <button className="btn" onClick={() => requestHint(2)}>
                    💡 Hint
                  </button>
                )}
              </>
            )}
            {(canAdvance || TEST_MODE) && getNextLevel(level.id) && (
              <button
                className="btn btn-advance"
                onClick={goToNextLevel}
                disabled={status === 'running'}
                title={
                  TEST_MODE && !canAdvance
                    ? '⚠️ TEST MODE — skip without solving'
                    : lastWinEfficient
                    ? 'Move on to the next level'
                    : 'You can move on — or keep tidying this solution first'
                }
              >
                {TEST_MODE && !canAdvance ? '⚡ Skip (test)' : 'Next level →'}
              </button>
            )}
          </div>

          {/* Stage 2 only: code-reveal panel (below controls, on blocks tab) */}
          {stage === 2 && showPythonPanel && workspaceTab === 'blocks' && (
            <PythonPanel
              pythonCode={pythonCode}
              jsCode={jsCode}
              defaultLanguage={themeConfig?.codeLanguage ?? 'python'}
            />
          )}
        </div>

        {/* Drag handle between workspace and game */}
        <div
          className={`resize-divider${isPanelDragging ? ' is-dragging' : ''}`}
          onMouseDown={startPanelResize}
          title="Drag to resize panels"
        />

        {/* Game */}
        <div className="panel is-game" style={{ width: gameWidth }}>
          <h2>{labels.panelGame ?? 'Game'}</h2>
          {/* Starter question card — shown above goal until dismissed */}
          {!starterQDismissed && currentStarterQ && (
            <StarterQuestionCard
              question={currentStarterQ}
              onDismiss={() => setStarterQDismissed(true)}
            />
          )}
          <div className="goal">🎯 {'grid' in level ? (labels.levelStories?.[level.id] ?? level.goal) : level.goal}</div>
          <div className="stage">
            {'grid' in level ? (
              <MazeCanvas
                level={level}
                robot={robot}
                status={status}
                collectedKey={collectedKey}
                theme={resolvedTheme.game}
              />
            ) : (
              <OutputDisplay
                level={level}
                actual={outputLines}
                status={status}
                error={outputError}
              />
            )}
          </div>
          <div className={bannerClass}>{banner}</div>
          {/* Aha moment — shown below the win banner */}
          {status === 'win' && (
            <AhaMoment
              text={level.lesson.ahaMoment}
              concept={level.lesson.concept}
              efficient={lastWinEfficient}
              bonusConcepts={lastWinBonusConcepts}
            />
          )}
          {/* Efficiency badge — shown after winning (maze levels use blocks, output levels use lines) */}
          {status === 'win' && 'grid' in level && level.optimalBlocks != null && (
            <EfficiencyBadge
              blockCount={lastBlockCount}
              optimalBlocks={level.optimalBlocks}
              bonusConcepts={lastWinBonusConcepts}
            />
          )}
          {status === 'win' && !('grid' in level) && (level as OutputLevel).optimalLines != null && (
            <EfficiencyBadge
              blockCount={lastBlockCount}
              optimalBlocks={(level as OutputLevel).optimalLines!}
              bonusConcepts={[]}
            />
          )}
          {/* Debug card — shown after 2+ failures (maze only) */}
          {'grid' in level && status === 'fail' && failureCount >= 2 && (
            <DebugCard character={resolvedTheme.labels.character ?? 'robot'} />
          )}
        </div>
        </div>{/* end workspace-game-area */}

        {/* Side panel: mastery + events */}
        <div className="panel is-mastery">
          <h2>{labels.panelProgress ?? 'Your Progress'}</h2>
          <div className="mastery">
            {(['sequencing', 'loops', 'conditionals', 'variables', 'repeatUntil'] as const).map(
              (k) => (
                <div key={k}>
                  <div className="row">
                    <span>{labels.conceptLabels?.[k] ?? k}</span>
                    <span>{Math.round(mastery[k] * 100)}%</span>
                  </div>
                  <div className="bar">
                    <span style={{ width: `${mastery[k] * 100}%` }} />
                  </div>
                </div>
              ),
            )}
          </div>

          {/* ── Learning Roadmap ──────────────────────────────────────── */}
          <div className="build-section">
            <div style={{ padding: '8px 14px 4px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#6b7280' }}>
              🗺 Learning Roadmap
            </div>
            <RoadmapPanel
              levels={ALL_LEVELS}
              completedIds={completedLevelIds}
              currentId={level.id}
              onSelect={(id) => advanceToLevel(id)}
            />
          </div>

          {/* ── Vocabulary Glossary ──────────────────────────────────── */}
          {seenConcepts.length > 0 && (
            <div className="build-section">
              <VocabularyGlossary seenConcepts={seenConcepts} allLevels={ALL_LEVELS} />
            </div>
          )}

          {/* Dev-only: raw event stream — hidden from students in production */}
          {TEST_MODE && (
            <>
              <h2>Event log → harness</h2>
              <div className="event-log">
                {eventsLog.length === 0 && (
                  <div style={{ color: '#9ca3af' }}>No events yet.</div>
                )}
                {eventsLog.map((e, i) => (
                  <div className="event" key={i}>
                    <span className="ts">{e.at.slice(11, 19)}</span>
                    <span className="type">{e.type}</span>{' '}
                    <span className="data">{e.data ? JSON.stringify(e.data) : ''}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Level Builder ─────────────────────────────────────────── */}
          <div className="build-section">
            <button
              className="build-toggle"
              onClick={() => setBuildOpen((v) => !v)}
            >
              {buildOpen ? '▼' : '▶'} 🛠 Build a Level
            </button>

            {buildOpen && (
              <div className="build-body">
                {/* Hidden file input for import */}
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,.cq.json"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) await handleImportFile(file)
                    e.target.value = ''
                  }}
                />

                {(buildStatus ?? importStatus) && (
                  <div className={`build-status build-status-${(buildStatus ?? importStatus)!.type}`}>
                    {(buildStatus ?? importStatus)!.message}
                  </div>
                )}

                {buildMode === 'describe' ? (
                  <>
                    {/* Primary: visual editor */}
                    <button
                      className="btn btn-draw"
                      onClick={() => setShowEditor(true)}
                    >
                      🎨 Draw It Yourself
                    </button>

                    {/* Import */}
                    <button
                      className="btn btn-import"
                      onClick={() => { setImportStatus(null); importInputRef.current?.click() }}
                    >
                      📥 Import a Maze (.cq.json)
                    </button>

                    <p className="build-note" style={{ margin: '2px 0 4px' }}>
                      — or describe it and let Dot build it —
                    </p>

                    <textarea
                      className="build-textarea"
                      rows={3}
                      placeholder="e.g. 'A brutal 8×8 snake maze that needs nested loops'"
                      value={buildDescription}
                      onChange={(e) => setBuildDescription(e.target.value)}
                    />
                    <div className="build-actions">
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '6px 10px' }}
                        onClick={handleRequestBuild}
                        disabled={!buildDescription.trim() || pu.isStandalone}
                        title={
                          pu.isStandalone
                            ? 'Requires a Dot connection — open in SchoolAI to use'
                            : 'Ask Dot to design and build this level'
                        }
                      >
                        🤖 Ask Dot
                      </button>
                      <button
                        className="btn"
                        style={{ fontSize: 12, padding: '6px 10px' }}
                        onClick={() => { setBuildMode('json'); setBuildStatus(null) }}
                      >
                        Paste JSON
                      </button>
                    </div>
                    {pu.isStandalone && (
                      <p className="build-note">
                        "Ask Dot" requires a SchoolAI connection.
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <textarea
                      className="build-textarea build-textarea-json"
                      rows={7}
                      placeholder={'{\n  "id": "my-level",\n  "name": "My Level",\n  ...\n}'}
                      value={buildJsonText}
                      onChange={(e) => setBuildJsonText(e.target.value)}
                    />
                    <div className="build-actions">
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: '6px 10px' }}
                        onClick={handleLoadJson}
                        disabled={!buildJsonText.trim()}
                      >
                        ✓ Load
                      </button>
                      <button
                        className="btn"
                        style={{ fontSize: 12, padding: '6px 10px' }}
                        onClick={() => { setBuildMode('describe'); setBuildStatus(null) }}
                      >
                        ← Back
                      </button>
                    </div>
                  </>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </div>

    {/* Visual maze editor — renders as a full-screen overlay */}
    {showEditor && (
      <MazeEditor
        onClose={() => setShowEditor(false)}
        onLoad={(lvl) => {
          upsertCustomLevel(lvl)
          advanceToLevel(lvl.id, lvl)
          setBuildStatus({ type: 'success', message: `"${lvl.name}" loaded!` })
        }}
      />
    )}

    {/* ── Concept Intro Modal ── */}
    {showConceptModal && (
      <ConceptIntroModal
        concept={pendingConceptName}
        explanation={ALL_LEVELS.find((l) => l.lesson.concept === pendingConceptName)?.lesson.explanation ?? ''}
        onClose={() => setShowConceptModal(false)}
      />
    )}

    {/* ── Predict Before You Run Modal — maze levels only ── */}
    {'grid' in level && showPredictModal && (level as MazeLevel).prediction && (
      <PredictModal
        prediction={(level as MazeLevel).prediction!}
        onRun={(_selectedIndex) => {
          setShowPredictModal(false)
          setPredictionAnswered(true)
          void runProgram()
        }}
        onClose={() => setShowPredictModal(false)}
      />
    )}
    </>
    </ThemeProvider>
  )
}

// ── ConnectionBadge ──────────────────────────────────────────────────────────

interface BadgeProps {
  isConnected: boolean
  isStandalone: boolean
  error: Error | null
}
function ConnectionBadge({ isConnected, isStandalone, error }: BadgeProps) {
  if (isStandalone) {
    return (
      <span style={{ color: '#f59e0b' }} title="No host detected">
        standalone
      </span>
    )
  }
  if (error) {
    return (
      <span style={{ color: '#ef4444' }} title={error.message}>
        handshake failed
      </span>
    )
  }
  if (!isConnected) {
    return <span style={{ color: '#9ca3af' }}>connecting…</span>
  }
  return <span style={{ color: '#10b981' }}>connected</span>
}

function sleep(ms: number) {
  return new Promise<void>((res) => setTimeout(res, ms))
}

function describeFailure(
  f: RunResult['failureSignal'],
  msgs: Partial<Record<string, string>> = {},
  character = 'robot',
): string {
  // 'no-blocks' is always generic — not worth theming.
  if (f === 'no-blocks') return 'Drag some blocks into the workspace, then press Run.'
  const key = f ?? 'default'
  return (
    msgs[key] ??
    msgs['default'] ??
    (f === 'hit-wall'      ? `💥 Ouch — the ${character} crashed into a wall. Try turning before moving forward.` :
     f === 'out-of-bounds' ? `🚧 The ${character} fell off the map. Try a different direction.` :
     f === 'step-limit'    ? '⏳ Too many steps. Maybe the loop is too big — try a smaller number?' :
     f === 'door-locked'   ? '🔒 The door is locked! Go pick up the key 🔑 first, then come back.' :
     'Not at the goal yet — keep trying!')
  )
}

/**
 * Returns the Blockly block type that should flash in the toolbox when the
 * student is stuck — i.e. the key construct the level is teaching.
 */
function getHintBlockType(level: MazeLevel): string | null {
  if (level.concepts.includes('conditionals')) return 'maze_if_has_key'
  if (level.concepts.includes('variables'))    return 'maze_set_steps'
  if (level.concepts.includes('repeatUntil'))  return 'maze_move_until_wall'
  if (level.concepts.includes('nestedLoops'))  return 'maze_repeat'
  if (level.concepts.includes('loops'))        return 'maze_repeat'
  return null
}

/**
 * Returns an extra hint string to append to the failure banner, escalating
 * based on how many times the student has failed on this level.
 *
 *   1 failure  → silent (base message is enough)
 *   2 failures → concept-specific encouragement nudge
 *   3+ failures → direct concept tip + note about the glowing block
 */
function buildFailureHint(level: MazeLevel, failCount: number, character = 'robot'): string {
  if (failCount < 2) return ''

  const conceptNudge: Record<string, string> = {
    conditionals: `Think about when the ${character} should go to the door — only if it has the key!`,
    variables:    'What if you could store the number of steps in a box and reuse it?',
    repeatUntil:  'What if you had a block that just kept moving until it hit a wall?',
    nestedLoops:  'Can you put one repeat block inside another repeat block?',
    loops:        'Is there a block that runs the same move multiple times for you?',
  }

  const relevantConcept = ['conditionals', 'variables', 'repeatUntil', 'nestedLoops', 'loops']
    .find((c) => level.concepts.includes(c))

  const nudge = relevantConcept ? conceptNudge[relevantConcept] : ''

  if (failCount === 2) {
    return nudge ? `💡 ${nudge}` : 'Keep experimenting — you\'re getting closer!'
  }

  // 3+ failures: direct tip + flag the block flash
  const blockName = getHintBlockType(level)
  const blockCue = blockName
    ? ' Check the toolbox — one block is glowing orange to point you in the right direction!'
    : ''
  return nudge ? `💡 ${nudge}${blockCue}` : `Keep trying!${blockCue}`
}

// ── ConceptIntroModal ─────────────────────────────────────────────────────────

interface ConceptIntroModalProps {
  concept: string
  explanation: string
  onClose: () => void
}

function ConceptIntroModal({ concept, explanation, onClose }: ConceptIntroModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>
          New Concept: <span className="concept-name">{concept}</span>
        </h2>
        <p>{explanation}</p>
        <button className="btn btn-primary btn-close" onClick={onClose}>
          Got it! Let&apos;s go →
        </button>
      </div>
    </div>
  )
}

// ── PredictModal ──────────────────────────────────────────────────────────────

interface PredictModalProps {
  prediction: LevelPrediction
  onRun: (selectedIndex: number) => void
  onClose: () => void
}

function PredictModal({ prediction, onRun, onClose }: PredictModalProps) {
  const [selected, setSelected] = useState<number | null>(null)
  return (
    <div className="modal-overlay">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Predict Before You Run!</h2>
        <p style={{ color: '#374151', margin: '0 0 4px' }}>{prediction.question}</p>
        <div className="predict-options">
          {prediction.options.map((opt, idx) => (
            <button
              key={idx}
              className={`predict-option${selected === idx ? ' selected' : ''}`}
              onClick={() => setSelected(idx)}
            >
              <span style={{ fontSize: 16 }}>{selected === idx ? '🔵' : '⚪'}</span>
              <span>{opt}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={() => { if (selected !== null) onRun(selected) }}
            disabled={selected === null}
          >
            Run it →
          </button>
          <button className="btn" onClick={onClose}>
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}

// ── StarterQuestionCard ───────────────────────────────────────────────────────

interface StarterQuestionCardProps {
  question: string
  onDismiss: () => void
}

function StarterQuestionCard({ question, onDismiss }: StarterQuestionCardProps) {
  return (
    <div className="starter-question">
      <span className="sq-text">🤔 Think about it: {question}</span>
      <button className="sq-dismiss" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}

// ── DebugCard ─────────────────────────────────────────────────────────────────

function DebugCard({ character = 'robot' }: { character?: string }) {
  const [open, setOpen] = useState(true)
  if (!open) return null
  return (
    <div className="debug-card">
      <h4
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
        onClick={() => setOpen(false)}
      >
        🔍 Debug It <span style={{ fontWeight: 400, fontSize: 12 }}>✕</span>
      </h4>
      <ol>
        <li>What was the {character} supposed to do?</li>
        <li>What did the {character} ACTUALLY do?</li>
        <li>Which block might be causing it?</li>
      </ol>
    </div>
  )
}

// ── AhaMoment ─────────────────────────────────────────────────────────────────

interface AhaMomentProps {
  text: string
  concept: string
  efficient: boolean
  bonusConcepts: string[]
}

function AhaMoment({ text, concept, efficient, bonusConcepts }: AhaMomentProps) {
  if (bonusConcepts.length > 0) {
    // Student used MORE advanced techniques than this level requires.
    // Celebrate the sophistication — don't imply anything was wrong.
    const bonusLabel = bonusConcepts.join(' and ')
    return (
      <div className="aha-moment" style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#14532d' }}>
        🌟 You used <strong>{bonusLabel}</strong> to solve this — that&apos;s more advanced than what this level teaches! Nice work thinking ahead.
      </div>
    )
  }
  if (efficient) {
    return (
      <div className="aha-moment">
        💡 You just learned: &quot;{text}&quot;
      </div>
    )
  }
  // Student solved it without using the target concept — acknowledge their
  // approach and invite curiosity rather than claiming a learning they didn't have.
  return (
    <div className="aha-moment" style={{ background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
      ✨ You found your own way to solve it! This level is designed to teach <strong>{concept}</strong> — want to replay and try that approach too?
    </div>
  )
}

// ── EfficiencyBadge ───────────────────────────────────────────────────────────

interface EfficiencyBadgeProps {
  blockCount: number
  optimalBlocks: number
  bonusConcepts: string[]
}

function EfficiencyBadge({ blockCount, optimalBlocks, bonusConcepts }: EfficiencyBadgeProps) {
  let label: string
  if (bonusConcepts.length > 0) {
    // Student used advanced techniques — don't compare against a simpler baseline.
    const bonusLabel = bonusConcepts.join(' + ')
    label = `🚀 Used ${bonusLabel}! (${blockCount} blocks)`
  } else if (blockCount <= optimalBlocks) {
    label = `⭐ Perfect solution! ${blockCount}/${optimalBlocks} blocks`
  } else if (blockCount <= Math.ceil(optimalBlocks * 1.5)) {
    label = `✨ Nice! ${blockCount} blocks (optimal: ${optimalBlocks})`
  } else {
    label = `💪 Solved! Can you do it in ${optimalBlocks} blocks?`
  }
  return (
    <div style={{ padding: '0 14px 10px' }}>
      <div className="efficiency-badge">{label}</div>
    </div>
  )
}

// ── RoadmapPanel ──────────────────────────────────────────────────────────────

interface RoadmapPanelProps {
  levels: AnyLevel[]
  completedIds: string[]
  currentId: string
  onSelect: (id: string) => void
}

function RoadmapPanel({ levels, completedIds, currentId, onSelect }: RoadmapPanelProps) {
  // A level is "unlocked" if it's current, completed, or all levels before it are completed.
  const currentIdx = levels.findIndex((l) => l.id === currentId)

  return (
    <div className="roadmap" style={{ padding: '0 10px 8px' }}>
      {levels.map((l, idx) => {
        const isDone = completedIds.includes(l.id)
        const isCurrent = l.id === currentId
        // Unlocked if it's at or before the current progression point
        const isUnlocked = idx <= currentIdx || isDone
        const isLocked = !isUnlocked

        let nodeClass = 'roadmap-node'
        if (isLocked) nodeClass += ' roadmap-locked'
        else if (isCurrent) nodeClass += ' roadmap-current'
        else if (isDone) nodeClass += ' roadmap-done'

        // Pick the primary concept emoji
        const primaryConcept = l.concepts.find((c) => CONCEPT_EMOJI[c]) ?? l.concepts[0] ?? ''
        const emoji = CONCEPT_EMOJI[primaryConcept] ?? ('grid' in l ? '🤖' : '🖥️')
        const statusIcon = isDone ? '✅' : isCurrent ? '▶' : isLocked ? '🔒' : '○'

        return (
          <div key={l.id}>
            {idx > 0 && <div className="roadmap-connector" />}
            <div
              className={nodeClass}
              onClick={() => { if (!isLocked && !isCurrent) onSelect(l.id) }}
              title={isLocked ? 'Complete earlier levels to unlock' : l.goal}
            >
              <div className="roadmap-icon">{emoji}</div>
              <div className="roadmap-info">
                <div className="roadmap-name">{l.name}</div>
                <div className="roadmap-concept">{l.lesson.concept}</div>
              </div>
              <div className="roadmap-status">{statusIcon}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── VocabularyGlossary ────────────────────────────────────────────────────────

interface VocabularyGlossaryProps {
  seenConcepts: string[]
  allLevels: AnyLevel[]
}

function VocabularyGlossary({ seenConcepts, allLevels }: VocabularyGlossaryProps) {
  const [open, setOpen] = useState(false)

  // Map concept name → first sentence of explanation
  const entries = seenConcepts
    .map((concept) => {
      const lvl = allLevels.find((l) => l.lesson.concept === concept)
      if (!lvl) return null
      const firstSentence = lvl.lesson.explanation.split(/[.!?]/)[0] ?? lvl.lesson.explanation
      return { concept, def: firstSentence.trim() }
    })
    .filter((e): e is { concept: string; def: string } => e !== null)

  if (entries.length === 0) return null

  return (
    <>
      <button className="build-toggle" onClick={() => setOpen((v) => !v)}>
        {open ? '▼' : '▶'} 📖 Words to Know
      </button>
      {open && (
        <div className="glossary" style={{ padding: '0 14px 10px' }}>
          {entries.map(({ concept, def }) => (
            <div key={concept} className="glossary-entry">
              <div className="glossary-term">{concept}</div>
              <div className="glossary-def">{def}.</div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
