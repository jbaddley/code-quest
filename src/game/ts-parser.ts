/**
 * Vocabulary-limited TypeScript parser for Code Quest Stage 3.
 *
 * TypeScript is a strict superset of JavaScript. This parser strips the type
 * annotations that TypeScript adds on top of JS before delegating to the
 * JavaScript parser.  The resulting AST is identical to what the JS parser
 * would produce for the untyped equivalent, so all existing cross-language
 * compilation, Blockly reconstruction, and run-loop execution paths work
 * without modification.
 *
 * Supported type annotations (all optional — plain JS is also accepted):
 *   const steps: number = 4;
 *   function name(): void { … }
 *   function name(param: number): void { … }
 *   function name(param: number) { … }
 *
 * Anything that the underlying JS parser does not recognise will produce a
 * parse error as normal.
 */

import type { ASTNode } from './maze-ast'
import { astToTokens } from './maze-ast'
import { parseJavaScriptToAst } from './js-parser'
import type { ParseError, ParseResult } from './python-parser'
export type { ParseError, ParseResult }

export interface AstParseResult {
  nodes: ASTNode[]
  errors: ParseError[]
}

// ── Type-annotation stripping ─────────────────────────────────────────────────

/**
 * Remove TypeScript type annotations from a single source line so the result
 * is valid JavaScript that the JS parser can handle.
 *
 * Patterns handled:
 *  • `(param: Type)` → `(param)`
 *  • `): ReturnType => {` → `) => {`  (arrow function return type)
 *  • `): ReturnType {` → `) {`
 *  • `const/let/var name: Type =` → `const/let/var name =`
 */
function stripAnnotations(line: string): string {
  // Arrow-function return type: `): Type => {` → `) => {`
  // Must come before the `): Type {` rule so the `=>` is preserved.
  line = line.replace(/\)\s*:\s*[a-zA-Z_][\w<>\[\] |]*\s*=>/, ') =>')
  // Function return type: `): SomeType {` → `) {`
  line = line.replace(/\)\s*:\s*[a-zA-Z_][\w<>\[\] |]*\s*\{/, ') {')
  // Function return type at end of line (no body on same line): `): SomeType` → `)`
  line = line.replace(/\)\s*:\s*[a-zA-Z_][\w<>\[\] |]*\s*$/, ')')
  // Single named parameter with type: `(param: Type)` → `(param)`
  line = line.replace(
    /\(\s*([a-zA-Z_]\w*)\s*:\s*[a-zA-Z_][\w<>\[\] |]*\s*\)/g,
    '($1)',
  )
  // Variable declaration with type: `const x: Type =` → `const x =`
  line = line.replace(
    /^(\s*(?:let|const|var)\s+[a-zA-Z_]\w*)\s*:\s*[a-zA-Z_][\w<>\[\] |]*\s*(=)/,
    '$1 $2',
  )
  return line
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Parse TypeScript source into a structured AST. */
export function parseTypeScriptToAst(code: string): AstParseResult {
  const stripped = code.split('\n').map(stripAnnotations).join('\n')
  return parseJavaScriptToAst(stripped)
}

/** Parse TypeScript source to a flat token array (for the maze run-loop). */
export function parseTypeScript(code: string): ParseResult {
  const { nodes, errors } = parseTypeScriptToAst(code)
  return { tokens: astToTokens(nodes), errors }
}
