/**
 * Vocabulary-limited JavaScript parser for Code Quest Stage 3.
 *
 * Primary export: `parseJavaScriptToAst()` — returns a structure-preserving AST
 * for cross-language code generation and Blockly workspace reconstruction.
 *
 * Secondary export: `parseJavaScript()` — thin wrapper producing the flat token
 * array consumed by the maze run-loop (back-compat).
 *
 * Supported vocabulary:
 *   moveForward();               → move
 *   turnLeft();                  → turn-left
 *   turnRight();                 → turn-right
 *   for (let i = 0; i < N; i++) → repeat(N, body)
 *   for (let i = 0; i < VAR; i++)→ repeat-var(VAR, body)
 *   while (pathClear()) { … }    → while-path-clear
 *   let VAR = N;                 → set-var(VAR, N)
 *   if (hasKey()) { … }          → if-has-key(thenBody [, elseBody])
 *   if (hasKey()) {…} else {…}
 *   if (pathClear()) { … }       → if-path-clear(body)
 *   function name() { … }        → define-proc(name, body)
 *   function name(param) { … }   → define-proc(name, param, body)
 *   name();                      → call-proc(name)
 *   name(4);                     → call-proc(name, arg=4)
 *   // comments                  → (ignored)
 */

import type { ASTNode } from './maze-ast'
import { astToTokens } from './maze-ast'
import type { ParseError, ParseResult } from './python-parser'
export type { ParseError, ParseResult }

export interface AstParseResult {
  nodes: ASTNode[]
  errors: ParseError[]
}

const MAZE_API_CALLS = new Set([
  'moveForward', 'turnLeft', 'turnRight', 'hasKey', 'pathClear',
])

/** Strip trailing `;` and trim. */
const strip = (s: string) => s.replace(/;\s*$/, '').trim()

/** Parse JavaScript source into a structured AST (preserves loop structure). */
export function parseJavaScriptToAst(code: string): AstParseResult {
  const rawLines = code.split('\n')
  const errors: ParseError[] = []
  let cursor = 0

  function skipBlank(): void {
    while (cursor < rawLines.length) {
      const t = rawLines[cursor].trim()
      if (t && !t.startsWith('//')) return
      cursor++
    }
  }

  /**
   * Parse lines inside a `{ … }` block.
   * Returns nodes collected and whether the block ended on `} else {`.
   */
  function parseBlock(): { nodes: ASTNode[]; outcome: 'end' | 'else' } {
    const nodes: ASTNode[] = []
    while (cursor < rawLines.length) {
      skipBlank()
      if (cursor >= rawLines.length) return { nodes, outcome: 'end' }

      const line = rawLines[cursor].trim()
      const lineNum = cursor + 1
      cursor++

      if (line === '}') return { nodes, outcome: 'end' }
      if (line === '} else {') return { nodes, outcome: 'else' }

      const node = parseLine(line, lineNum)
      if (node !== null) nodes.push(node)
    }
    return { nodes, outcome: 'end' }
  }

  function parseLine(line: string, lineNum: number): ASTNode | null {
    if (!line || line === '{') return null

    // ── Simple movement ──────────────────────────────────────────────────────
    const stripped = strip(line)
    if (stripped === 'moveForward()') return { type: 'move' }
    if (stripped === 'turnLeft()')    return { type: 'turn-left' }
    if (stripped === 'turnRight()')   return { type: 'turn-right' }

    // ── Variable declaration: let/const/var VAR = N; ─────────────────────────
    const letMatch = stripped.match(/^(?:let|const|var)\s+([a-zA-Z_]\w*)\s*=\s*(\d+)$/)
    if (letMatch) {
      return { type: 'set-var', name: letMatch[1], value: Number(letMatch[2]) }
    }

    // ── for (let i = 0; i < N; i++) { ───────────────────────────────────────
    const forFixed = line.match(/^for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*(\d+)\s*;\s*\w+\+\+\s*\)\s*\{$/)
    if (forFixed) {
      const n = Math.min(Number(forFixed[1]), 200)
      const { nodes } = parseBlock()
      return { type: 'repeat', count: n, body: nodes }
    }

    // ── for (let i = 0; i < VAR; i++) { ─────────────────────────────────────
    const forVar = line.match(/^for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*([a-zA-Z_]\w*)\s*;\s*\w+\+\+\s*\)\s*\{$/)
    if (forVar) {
      const { nodes } = parseBlock()
      return { type: 'repeat-var', varName: forVar[1], body: nodes }
    }

    // ── while (pathClear()) { ───────────────────────────────────────────────
    if (line === 'while (pathClear()) {') {
      parseBlock() // consume body (always moveForward — discarded)
      return { type: 'while-path-clear' }
    }

    // ── if (hasKey()) { ──────────────────────────────────────────────────────
    if (line === 'if (hasKey()) {') {
      const { nodes: thenNodes, outcome } = parseBlock()
      if (outcome === 'else') {
        const { nodes: elseNodes } = parseBlock()
        return { type: 'if-has-key', thenBody: thenNodes, elseBody: elseNodes }
      }
      return { type: 'if-has-key', thenBody: thenNodes }
    }

    // ── if (pathClear()) { ───────────────────────────────────────────────────
    if (line === 'if (pathClear()) {') {
      const { nodes } = parseBlock()
      return { type: 'if-path-clear', body: nodes }
    }

    // ── function name() { … } or function name(param) { … } ─────────────────
    // Accepts zero or one parameter name; no default values or rest params.
    const funcMatch = line.match(/^function\s+([a-zA-Z_]\w*)\s*\(\s*([a-zA-Z_]\w*)?\s*\)\s*\{$/)
    if (funcMatch) {
      const { nodes } = parseBlock()
      return { type: 'define-proc', name: funcMatch[1], param: funcMatch[2] || undefined, body: nodes }
    }

    // ── const/let/var name = () => { … }  (arrow-function form) ──────────────
    // Accepts zero or one parameter name, no type annotations (TS strips those
    // before reaching here).  Both `=> {` (block body) forms are accepted.
    const arrowMatch = line.match(/^(?:const|let|var)\s+([a-zA-Z_]\w*)\s*=\s*\(\s*([a-zA-Z_]\w*)?\s*\)\s*=>\s*\{$/)
    if (arrowMatch) {
      const { nodes } = parseBlock()
      return { type: 'define-proc', name: arrowMatch[1], param: arrowMatch[2] || undefined, body: nodes }
    }

    // ── name(); or name(4); or name(VAR); — function call ────────────────────
    // Accepts zero, one integer literal, or one variable-name argument.
    const callMatch = stripped.match(/^([a-zA-Z_]\w*)\(([a-zA-Z_]\w*|\d+)?\)$/)
    if (callMatch) {
      const name = callMatch[1]
      if (MAZE_API_CALLS.has(name)) {
        errors.push({ line: lineNum, message: `"${name}" is a maze command — check your spelling` })
        return null
      }
      const rawArg = callMatch[2]
      const arg: number | string | undefined =
        rawArg === undefined ? undefined :
        /^\d+$/.test(rawArg) ? Number(rawArg) :
        rawArg
      return { type: 'call-proc', name, arg }
    }

    // ── Unknown ───────────────────────────────────────────────────────────────
    errors.push({ line: lineNum, message: `Don't know how to run: "${line}"` })
    return null
  }

  // Top-level parse loop
  const nodes: ASTNode[] = []
  while (cursor < rawLines.length) {
    skipBlank()
    if (cursor >= rawLines.length) break
    const line = rawLines[cursor].trim()
    const lineNum = cursor + 1
    cursor++
    const node = parseLine(line, lineNum)
    if (node !== null) nodes.push(node)
  }

  return { nodes, errors }
}

/** Parse JavaScript source to a flat token array (for the maze run-loop). */
export function parseJavaScript(code: string): ParseResult {
  const { nodes, errors } = parseJavaScriptToAst(code)
  return { tokens: astToTokens(nodes), errors }
}
