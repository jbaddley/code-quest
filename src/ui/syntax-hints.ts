/**
 * Syntax hint text for each recognised line of the maze vocabulary.
 *
 * `getLineHint(trimmedLine, language)` returns a short, plain-English
 * explanation suitable for display as a read-only comment decoration in the
 * CodeMirror editor — or null for lines that need no explanation (blank lines,
 * real comments, closing braces, unrecognised constructs).
 *
 * The hints are intentionally short so they fit on one line beside the code.
 */

// Maze API calls that have their own dedicated hint entries and should NOT
// fall through to the generic "call function" fallback.
const MAZE_API_PY = new Set(['move_forward', 'turn_left', 'turn_right', 'has_key', 'path_clear'])
const MAZE_API_JS = new Set(['moveForward', 'turnLeft', 'turnRight', 'hasKey', 'pathClear'])

type HintFn = (m: RegExpMatchArray) => string | null
type HintEntry = [RegExp, string | HintFn]

// ── Python hints ──────────────────────────────────────────────────────────────

const PY_HINTS: HintEntry[] = [
  [/^move_forward\(\)$/, 'move the robot forward one step'],
  [/^turn_left\(\)$/, 'turn the robot 90° to the left'],
  [/^turn_right\(\)$/, 'turn the robot 90° to the right'],

  // for _ in range(N):
  [/^for\s+_\s+in\s+range\((\d+)\)\s*:$/, m =>
    `repeat the block below ${m[1]} time${Number(m[1]) !== 1 ? 's' : ''}`],
  // for _ in range(VAR):
  [/^for\s+_\s+in\s+range\(([a-zA-Z_]\w*)\)\s*:$/, m =>
    `repeat the block below "${m[1]}" times`],

  [/^while\s+path_clear\(\)\s*:$/, 'keep repeating while the path ahead is open'],

  // VAR = N  (assignment)
  [/^([a-zA-Z_]\w*)\s*=\s*(\d+)$/, m => `set variable "${m[1]}" to ${m[2]}`],

  [/^if\s+has_key\(\)\s*:$/, 'only do the block below if the robot is carrying the key'],
  [/^if\s+path_clear\(\)\s*:$/, 'only do the block below if the path ahead is clear'],
  [/^else\s*:$/, 'otherwise, do this block instead'],

  // def name():  and  def name(param):
  [/^def\s+([a-zA-Z_]\w*)\(\)\s*:$/, m => `define a reusable function called "${m[1]}"`],
  [/^def\s+([a-zA-Z_]\w*)\(([a-zA-Z_]\w*)\)\s*:$/, m =>
    `define function "${m[1]}" — "${m[2]}" is the number passed in`],

  // name(4)  — parameterised call with literal (before generic call, to take priority)
  [/^([a-zA-Z_]\w*)\((\d+)\)$/, m =>
    MAZE_API_PY.has(m[1]) ? null : `call function "${m[1]}" passing in the value ${m[2]}`],

  // name(var)  — parameterised call with variable
  [/^([a-zA-Z_]\w*)\(([a-zA-Z_]\w+)\)$/, m =>
    MAZE_API_PY.has(m[1]) ? null : `call function "${m[1]}" passing in the value of "${m[2]}"`],

  // name()   — zero-arg call
  [/^([a-zA-Z_]\w*)\(\)$/, m =>
    MAZE_API_PY.has(m[1]) ? null : `call the function named "${m[1]}"`],

  [/^pass$/, 'placeholder — does nothing (required for empty blocks in Python)'],
]

// ── JavaScript hints ──────────────────────────────────────────────────────────

const JS_HINTS: HintEntry[] = [
  [/^moveForward\(\);?$/, 'move the robot forward one step'],
  [/^turnLeft\(\);?$/, 'turn the robot 90° to the left'],
  [/^turnRight\(\);?$/, 'turn the robot 90° to the right'],

  // for (let i = 0; i < N; i++) {
  [/^for\s*\(let\s+\w+\s*=\s*0;\s*\w+\s*<\s*(\d+);\s*\w+\+\+\s*\)\s*\{?$/, m =>
    `repeat the block below ${m[1]} time${Number(m[1]) !== 1 ? 's' : ''}`],
  // for (let i = 0; i < VAR; i++) {
  [/^for\s*\(let\s+\w+\s*=\s*0;\s*\w+\s*<\s*([a-zA-Z_]\w*);\s*\w+\+\+\s*\)\s*\{?$/, m =>
    `repeat the block below "${m[1]}" times`],

  [/^while\s*\(pathClear\(\)\)\s*\{?$/, 'keep repeating while the path ahead is open'],

  // let/const/var VAR = N;
  [/^(?:let|const|var)\s+([a-zA-Z_]\w*)\s*=\s*(\d+);?$/, m =>
    `create variable "${m[1]}" and set it to ${m[2]}`],

  [/^if\s*\(hasKey\(\)\)\s*\{?$/, 'only do the block below if the robot is carrying the key'],
  [/^if\s*\(pathClear\(\)\)\s*\{?$/, 'only do the block below if the path ahead is clear'],
  [/^\}\s*else\s*\{?$/, 'otherwise, do this block instead'],

  // function name() {  and  function name(param) {
  [/^function\s+([a-zA-Z_]\w*)\s*\(\s*\)\s*\{?$/, m =>
    `define a reusable function called "${m[1]}"`],
  [/^function\s+([a-zA-Z_]\w*)\s*\(([a-zA-Z_]\w*)\)\s*\{?$/, m =>
    `define function "${m[1]}" — "${m[2]}" is the number passed in`],

  // const/let/var name = () => {  and  name = (param) => {  (arrow functions)
  [/^(?:const|let|var)\s+([a-zA-Z_]\w*)\s*=\s*\(\s*\)\s*=>\s*\{?$/, m =>
    `define a reusable function called "${m[1]}"`],
  [/^(?:const|let|var)\s+([a-zA-Z_]\w*)\s*=\s*\(([a-zA-Z_]\w*)\)\s*=>\s*\{?$/, m =>
    `define function "${m[1]}" — "${m[2]}" is the number passed in`],

  // name(4);  — parameterised call with literal
  [/^([a-zA-Z_]\w*)\((\d+)\);?$/, m =>
    MAZE_API_JS.has(m[1]) ? null : `call function "${m[1]}" passing in the value ${m[2]}`],

  // name(var);  — parameterised call with variable
  [/^([a-zA-Z_]\w*)\(([a-zA-Z_]\w+)\);?$/, m =>
    MAZE_API_JS.has(m[1]) ? null : `call function "${m[1]}" passing in the value of "${m[2]}"`],

  // name();  — zero-arg call
  [/^([a-zA-Z_]\w*)\(\);?$/, m =>
    MAZE_API_JS.has(m[1]) ? null : `call the function named "${m[1]}"`],
]

// ── TypeScript annotation stripping (for hint normalisation) ─────────────────
// Mirrors the logic in ts-parser.ts — kept inline to avoid a circular dep.

function _stripTsAnnotationsForHint(line: string): string {
  line = line.replace(/\)\s*:\s*[a-zA-Z_][\w<>\[\] |]*\s*=>/, ') =>')
  line = line.replace(/\)\s*:\s*[a-zA-Z_][\w<>\[\] |]*\s*\{/, ') {')
  line = line.replace(/\)\s*:\s*[a-zA-Z_][\w<>\[\] |]*\s*$/, ')')
  line = line.replace(/\(\s*([a-zA-Z_]\w*)\s*:\s*[a-zA-Z_][\w<>\[\] |]*\s*\)/g, '($1)')
  line = line.replace(
    /^(\s*(?:let|const|var)\s+[a-zA-Z_]\w*)\s*:\s*[a-zA-Z_][\w<>\[\] |]*\s*(=)/,
    '$1 $2',
  )
  return line
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return a short, plain-English hint for a single trimmed line of code,
 * or null if the line needs no explanation.
 *
 * For TypeScript, type annotations are stripped before pattern matching so the
 * same JS hint rules apply — students see the same explanations regardless of
 * whether they wrote `let steps = 4` or `const steps: number = 4`.
 */
export function getLineHint(
  line: string,
  language: 'python' | 'javascript' | 'typescript',
): string | null {
  // Skip blank lines, real comments, and structural-only lines.
  if (!line) return null
  if (language === 'python' && line.startsWith('#')) return null
  if ((language === 'javascript' || language === 'typescript') && line.startsWith('//')) return null
  if (line === '}' || line === '{' || line === '};') return null

  // Normalise TypeScript lines to plain JS before matching
  const normalized = language === 'typescript' ? _stripTsAnnotationsForHint(line) : line

  const entries = language === 'python' ? PY_HINTS : JS_HINTS
  for (const [pattern, hint] of entries) {
    const m = normalized.match(pattern)
    if (m) {
      return typeof hint === 'function' ? hint(m) : hint
    }
  }
  return null
}
