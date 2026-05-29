/**
 * Sandboxed output evaluator for OutputLevel challenges.
 *
 * Students write code that calls `print()`.  We intercept every `print()`
 * call, collect the lines, then compare against the expected output array.
 * No maze engine or Blockly token system is involved.
 */

export interface OutputResult {
  /** Lines captured from `print()` calls, in order. */
  output: string[]
  /** Runtime error message, if the code threw. */
  error?: string
}

/**
 * Run `jsCode` in a sandboxed `Function` with a `print` binding.
 * Any call to `print(a, b, …)` appends `String(a) + " " + String(b) + …`
 * to the output array — matching Python's `print()` semantics.
 */
export function runOutput(jsCode: string): OutputResult {
  const lines: string[] = []
  const print = (...args: unknown[]) => lines.push(args.map(String).join(' '))
  try {
    // eslint-disable-next-line no-new-func
    new Function('print', jsCode)(print)
  } catch (e) {
    return { output: lines, error: String(e) }
  }
  return { output: lines }
}

/**
 * Returns true iff `actual` exactly matches `expected` (order-sensitive,
 * trimming leading/trailing whitespace from each line).
 */
export function checkOutput(actual: string[], expected: string[]): boolean {
  if (actual.length !== expected.length) return false
  return actual.every((line, i) => line.trim() === expected[i].trim())
}

/**
 * Minimal Python → JS transpiler covering the output-level vocabulary:
 *   print("text")   → print("text");
 *   print(42)       → print(42);
 *   x = 5           → let x = 5;
 *   x = "hello"     → let x = "hello";
 *   x = 'hello'     → let x = 'hello';
 *   # comment       → // comment
 *
 * Lines that don't match any known pattern are passed through unchanged
 * (the sandbox will throw a SyntaxError which surfaces as an error message).
 */
export function transpilePythonToJs(pythonCode: string): string {
  return pythonCode
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()

      // Skip blank lines
      if (trimmed === '') return ''

      // Comment
      if (trimmed.startsWith('#')) return `//${trimmed.slice(1)}`

      // print(...) — keep as-is (the sandbox injects the print function)
      if (/^print\s*\(/.test(trimmed)) return `${trimmed};`

      // Assignment: identifier = expression
      const assignMatch = trimmed.match(/^([A-Za-z_]\w*)\s*=\s*(.+)$/)
      if (assignMatch) return `let ${assignMatch[1]} = ${assignMatch[2]};`

      // Everything else: pass through
      return trimmed
    })
    .join('\n')
}
