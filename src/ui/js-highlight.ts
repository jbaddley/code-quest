/**
 * Lightweight JavaScript syntax highlighter for the Stage 2 code-reveal panel.
 *
 * Produces an HTML string with CSS class spans. No external dependencies —
 * operates on the predictable, limited JS subset our maze generator produces.
 *
 * Reuses the same CSS class names as the Python highlighter so the dark panel
 * theme applies uniformly:
 *   py-kw  → keywords (function, for, while, if, else, let)
 *   py-fn  → maze API calls (moveForward, turnLeft, …)
 *   py-num → numeric literals
 *   py-id  → other identifiers
 *   py-comment → // comments
 */

/** Maze API functions — highlighted as built-ins. */
const MAZE_API = new Set([
  'moveForward', 'turnLeft', 'turnRight',
  'hasKey', 'pathClear',
])

/** JavaScript keywords. */
const KEYWORDS = new Set([
  'function', 'for', 'while', 'if', 'else',
  'let', 'const', 'var', 'return', 'true', 'false',
  'of', 'in', 'new', 'this',
])

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Tokenise a non-comment code fragment into highlighted HTML spans. */
function highlightTokens(text: string): string {
  const parts = text.split(/([A-Za-z_][A-Za-z0-9_]*|\d+)/)
  return parts
    .map((tok) => {
      if (!tok) return ''
      if (/^\d+$/.test(tok))   return `<span class="py-num">${tok}</span>`
      if (MAZE_API.has(tok))   return `<span class="py-fn">${tok}</span>`
      if (KEYWORDS.has(tok))   return `<span class="py-kw">${tok}</span>`
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(tok)) return `<span class="py-id">${escHtml(tok)}</span>`
      return escHtml(tok)
    })
    .join('')
}

/** Highlight a single JS line, handling comments and leading whitespace. */
function highlightLine(line: string): string {
  const match = line.match(/^(\s*)(.*)$/)
  if (!match) return escHtml(line)
  const [, indent, content] = match
  if (!content) return escHtml(indent)

  // Full-line // comment
  if (content.startsWith('//')) {
    return escHtml(indent) + `<span class="py-comment">${escHtml(content)}</span>`
  }

  // Inline // comment
  const commentIdx = content.indexOf(' //')
  let main = content
  let comment = ''
  if (commentIdx !== -1) {
    main = content.slice(0, commentIdx)
    comment = content.slice(commentIdx)
  }

  const highlighted = highlightTokens(main)
  const commentHtml = comment ? `<span class="py-comment">${escHtml(comment)}</span>` : ''
  return escHtml(indent) + highlighted + commentHtml
}

/**
 * Convert a JavaScript code string to an HTML string with syntax-highlighting spans.
 * Safe to insert via dangerouslySetInnerHTML — non-code text is always escaped.
 */
export function highlightJavaScript(code: string): string {
  if (!code.trim()) return ''
  return code.split('\n').map(highlightLine).join('\n')
}
