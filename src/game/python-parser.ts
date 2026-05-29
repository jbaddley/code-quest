/**
 * Vocabulary-limited Python parser for Code Quest Stage 3.
 *
 * Primary export: `parsePythonToAst()` — returns a structure-preserving AST
 * that other parts of the app use for cross-language code generation and
 * Blockly workspace reconstruction.
 *
 * Secondary export: `parsePython()` — thin wrapper that converts the AST to
 * the flat token array consumed by the maze run-loop (back-compat).
 *
 * Supported vocabulary:
 *   move_forward()               → move
 *   turn_left()                  → turn-left
 *   turn_right()                 → turn-right
 *   for _ in range(N):           → repeat(N, body)
 *   for _ in range(VAR):         → repeat-var(VAR, body)
 *   while path_clear():          → while-path-clear
 *       move_forward()
 *   VAR = N                      → set-var(VAR, N)
 *   if has_key():                → if-has-key(thenBody [, elseBody])
 *   if has_key(): … else: …
 *   if path_clear():             → if-path-clear(body)
 *   def name():                  → define-proc(name, body)
 *   def name(param):             → define-proc(name, param, body)
 *   name()                       → call-proc(name)
 *   name(4)                      → call-proc(name, arg=4)
 *   pass / # comments            → (ignored)
 */

import type { ASTNode } from './maze-ast'
import { astToTokens } from './maze-ast'

export interface ParseError {
  /** 1-based line number */
  line: number
  message: string
}

export interface ParseResult {
  tokens: string[]
  errors: ParseError[]
}

export interface AstParseResult {
  nodes: ASTNode[]
  errors: ParseError[]
}

const MAZE_API_CALLS = new Set([
  'move_forward', 'turn_left', 'turn_right', 'has_key', 'path_clear',
])

function getIndent(s: string): number {
  let n = 0
  for (const ch of s) {
    if (ch === ' ') n++
    else if (ch === '\t') n += 4
    else break
  }
  return n
}

/** Parse Python source into a structured AST (preserves loop structure). */
export function parsePythonToAst(code: string): AstParseResult {
  const rawLines = code.split('\n')
  const errors: ParseError[] = []
  let cursor = 0

  function skipBlank(): void {
    while (cursor < rawLines.length) {
      const t = rawLines[cursor].trim()
      if (t && !t.startsWith('#')) return
      cursor++
    }
  }

  /**
   * Parse all lines whose indent is strictly greater than `parentIndent`.
   * Stops when it hits a line at or below `parentIndent` or EOF.
   */
  function parseBlock(parentIndent: number): ASTNode[] {
    const nodes: ASTNode[] = []
    while (cursor < rawLines.length) {
      skipBlank()
      if (cursor >= rawLines.length) break
      const line = rawLines[cursor]
      const lineIndent = getIndent(line)
      if (lineIndent <= parentIndent) break
      const content = line.trim()
      const lineNum = cursor + 1
      cursor++
      const result = parseLine(content, lineNum, lineIndent)
      if (result !== null) {
        if (Array.isArray(result)) nodes.push(...result)
        else nodes.push(result)
      }
    }
    return nodes
  }

  function parseLine(content: string, lineNum: number, lineIndent: number): ASTNode | ASTNode[] | null {
    // ── pass / blank ─────────────────────────────────────────────────────────
    if (!content || content === 'pass') return null

    // ── Simple movement ───────────────────────────────────────────────────────
    if (content === 'move_forward()') return { type: 'move' }
    if (content === 'turn_left()')    return { type: 'turn-left' }
    if (content === 'turn_right()')   return { type: 'turn-right' }

    // ── Variable assignment: VAR = N ──────────────────────────────────────────
    const varAssign = content.match(/^([a-zA-Z_]\w*)\s*=\s*(\d+)$/)
    if (varAssign) {
      return { type: 'set-var', name: varAssign[1], value: Number(varAssign[2]) }
    }

    // ── for _ in range(N): ────────────────────────────────────────────────────
    const forFixed = content.match(/^for\s+_\s+in\s+range\((\d+)\)\s*:$/)
    if (forFixed) {
      const n = Math.min(Number(forFixed[1]), 200)
      const body = parseBlock(lineIndent)
      return { type: 'repeat', count: n, body }
    }

    // ── for _ in range(VAR): ──────────────────────────────────────────────────
    const forVar = content.match(/^for\s+_\s+in\s+range\(([a-zA-Z_]\w*)\)\s*:$/)
    if (forVar) {
      const body = parseBlock(lineIndent)
      return { type: 'repeat-var', varName: forVar[1], body }
    }

    // ── while path_clear(): ───────────────────────────────────────────────────
    if (content === 'while path_clear():') {
      parseBlock(lineIndent) // consume body (always move_forward — discarded)
      return { type: 'while-path-clear' }
    }

    // ── if has_key(): ─────────────────────────────────────────────────────────
    if (content === 'if has_key():') {
      const thenBody = parseBlock(lineIndent)
      skipBlank()
      const elseLine    = rawLines[cursor]?.trim()
      const elseIndent  = cursor < rawLines.length ? getIndent(rawLines[cursor]) : -1
      if (elseLine === 'else:' && elseIndent === lineIndent) {
        cursor++
        const elseBody = parseBlock(lineIndent)
        return { type: 'if-has-key', thenBody, elseBody }
      }
      return { type: 'if-has-key', thenBody }
    }

    // ── if path_clear(): ──────────────────────────────────────────────────────
    if (content === 'if path_clear():') {
      const body = parseBlock(lineIndent)
      return { type: 'if-path-clear', body }
    }

    // ── def name(): or def name(param): ──────────────────────────────────────
    // Accepts zero or one parameter name; no default values or rest params.
    const defMatch = content.match(/^def\s+([a-zA-Z_]\w*)\(\s*([a-zA-Z_]\w*)?\s*\)\s*:$/)
    if (defMatch) {
      const body = parseBlock(lineIndent)
      return { type: 'define-proc', name: defMatch[1], param: defMatch[2] || undefined, body }
    }

    // ── name() or name(4) or name(var) — function call ────────────────────────
    // Accepts zero, one integer literal, or one variable-name argument.
    const callMatch = content.match(/^([a-zA-Z_]\w*)\(([a-zA-Z_]\w*|\d+)?\)$/)
    if (callMatch) {
      const name = callMatch[1]
      if (MAZE_API_CALLS.has(name)) {
        errors.push({ line: lineNum, message: `"${name}" is a maze command — call the right function` })
        return null
      }
      const rawArg = callMatch[2]
      const arg: number | string | undefined =
        rawArg === undefined ? undefined :
        /^\d+$/.test(rawArg) ? Number(rawArg) :
        rawArg
      return { type: 'call-proc', name, arg }
    }

    // ── Unknown ────────────────────────────────────────────────────────────────
    errors.push({ line: lineNum, message: `Don't know how to run: "${content}"` })
    return null
  }

  const nodes = parseBlock(-1)
  return { nodes, errors }
}

/** Parse Python source to a flat token array (for the maze run-loop). */
export function parsePython(code: string): ParseResult {
  const { nodes, errors } = parsePythonToAst(code)
  return { tokens: astToTokens(nodes), errors }
}
