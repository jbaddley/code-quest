/**
 * Lightweight Python syntax highlighter for the Stage 2 code-reveal panel.
 *
 * Produces an HTML string with CSS class spans. No dependencies — just regexes
 * applied to the predictable Python that our maze generator produces.
 *
 * CSS classes: py-kw, py-fn, py-fn-user, py-num, py-comment, py-var, py-param
 */

/** Maze API functions — highlighted as built-in calls. */
const MAZE_API = new Set([
  'move_forward', 'turn_left', 'turn_right',
  'has_key', 'path_clear',
])

/** Python keywords — highlighted in blue. */
const KEYWORDS = new Set([
  'def', 'for', 'while', 'if', 'else', 'elif',
  'in', 'range', 'return', 'pass', 'not', 'and', 'or',
])

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Tokenise a single line (no comments, no leading whitespace) into highlighted spans.
 * We split on word/non-word boundaries so each token is either an identifier,
 * a number, punctuation, or whitespace.
 */
function highlightTokens(text: string): string {
  // Split on boundaries: identifiers, numbers, everything else
  const parts = text.split(/([A-Za-z_][A-Za-z0-9_]*|\d+)/)
  return parts.map((tok) => {
    if (!tok) return ''
    if (/^\d+$/.test(tok)) {
      return `<span class="py-num">${tok}</span>`
    }
    if (MAZE_API.has(tok)) {
      return `<span class="py-fn">${tok}</span>`
    }
    if (KEYWORDS.has(tok)) {
      return `<span class="py-kw">${tok}</span>`
    }
    if (tok === '_') {
      // The loop placeholder `for _ in range(...)` — style like a keyword
      return `<span class="py-kw">_</span>`
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(tok)) {
      // Unknown identifier — could be a variable or user-defined function
      return `<span class="py-id">${escHtml(tok)}</span>`
    }
    return escHtml(tok)
  }).join('')
}

/** Highlight a single line of Python, handling comments and leading whitespace. */
function highlightLine(line: string): string {
  // Preserve leading whitespace exactly (spaces/tabs)
  const match = line.match(/^(\s*)(.*)$/)
  if (!match) return escHtml(line)
  const [, indent, content] = match

  if (!content) return escHtml(indent)

  // Full-line comment
  if (content.startsWith('#')) {
    return escHtml(indent) + `<span class="py-comment">${escHtml(content)}</span>`
  }

  // Inline comment: split at first #
  const commentIdx = content.indexOf(' #')
  let main = content
  let comment = ''
  if (commentIdx !== -1) {
    main = content.slice(0, commentIdx)
    comment = content.slice(commentIdx)
  }

  const highlighted = highlightTokens(main)
  const commentHtml = comment
    ? `<span class="py-comment">${escHtml(comment)}</span>`
    : ''

  return escHtml(indent) + highlighted + commentHtml
}

/**
 * Convert a Python code string to an HTML string with syntax highlighting spans.
 * Safe to insert via dangerouslySetInnerHTML — only the non-code text is escaped.
 */
export function highlightPython(code: string): string {
  if (!code.trim()) return ''
  return code
    .split('\n')
    .map(highlightLine)
    .join('\n')
}
