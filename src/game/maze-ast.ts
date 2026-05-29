/**
 * Shared AST (Abstract Syntax Tree) for the maze programming vocabulary.
 *
 * Bridges between:
 *   - Python source code (parsed by python-parser.ts)
 *   - JavaScript source code (parsed by js-parser.ts)
 *   - Blockly workspace state (for workspace reconstruction)
 *   - Flat token arrays (for execution by the run loop)
 *
 * Preserves loop/block structure — unlike the flat token format which unrolls
 * fixed-N `for` loops at compile time.
 */

// ── AST Node Types ──────────────────────────────────────────────────────────────

export type ASTNode =
  | { type: 'move' }
  | { type: 'turn-left' }
  | { type: 'turn-right' }
  | { type: 'repeat'; count: number; body: ASTNode[] }
  | { type: 'repeat-var'; varName: string; body: ASTNode[] }
  | { type: 'while-path-clear' }
  | { type: 'set-var'; name: string; value: number }
  | { type: 'if-has-key'; thenBody: ASTNode[]; elseBody?: ASTNode[] }
  | { type: 'if-path-clear'; body: ASTNode[] }
  | { type: 'define-proc'; name: string; param?: string; body: ASTNode[] }
  | { type: 'call-proc'; name: string; arg?: number | string }

// ── Name Conversion Helpers ─────────────────────────────────────────────────────

/** snake_case or kebab-case → camelCase  (e.g. "my_move" → "myMove") */
export function toCamelCase(s: string): string {
  return s
    .replace(/-([a-zA-Z])/g, (_, c: string) => c.toUpperCase())
    .replace(/_([a-zA-Z])/g, (_, c: string) => c.toUpperCase())
}

/** camelCase → snake_case  (e.g. "myMove" → "my_move") */
export function toSnakeCase(s: string): string {
  return s.replace(/([A-Z])/g, '_$1').toLowerCase()
}

// ── AST → Execution Tokens ──────────────────────────────────────────────────────

/**
 * Convert AST nodes to a flat token array for the maze engine.
 * Fixed-count `repeat` nodes are unrolled (matches compile-time behaviour in
 * maze-blocks.ts, where `maze_repeat` generates a real JS `for` loop).
 *
 * Parameterised procedure calls (e.g. `takeSteps(4)`) emit a `set-var` token
 * for the parameter before the `call_proc` token so the run-loop has the right
 * variable value when it executes the procedure body.
 *
 * @param nodes  - AST nodes to convert.
 * @param _pm    - Internal: pre-built proc→param map threaded through recursion.
 */
export function astToTokens(nodes: ASTNode[], _pm?: ReadonlyMap<string, string>): string[] {
  // On the initial (top-level) call, scan the entire tree once to build a
  // map of { procName → paramName } so parameterised call-sites can emit the
  // right `set-var` token before the `call_proc`.
  const pm: ReadonlyMap<string, string> = _pm ?? (() => {
    const m = new Map<string, string>()
    const collect = (ns: ASTNode[]): void => {
      for (const n of ns) {
        if (n.type === 'define-proc') {
          if (n.param) m.set(n.name, n.param)
          collect(n.body)
        }
        if (n.type === 'repeat')        collect(n.body)
        if (n.type === 'repeat-var')    collect(n.body)
        if (n.type === 'if-has-key')  { collect(n.thenBody); if (n.elseBody) collect(n.elseBody) }
        if (n.type === 'if-path-clear') collect(n.body)
      }
    }
    collect(nodes)
    return m
  })()

  const tokens: string[] = []

  function visit(node: ASTNode): void {
    switch (node.type) {
      case 'move':       tokens.push('move'); break
      case 'turn-left':  tokens.push('turn-left'); break
      case 'turn-right': tokens.push('turn-right'); break

      case 'repeat': {
        const n = Math.min(node.count, 200)
        const bodyTokens = astToTokens(node.body, pm)
        for (let i = 0; i < n; i++) tokens.push(...bodyTokens)
        break
      }

      case 'repeat-var':
        tokens.push(`repeat-var-start:${node.varName}`)
        tokens.push(...astToTokens(node.body, pm))
        tokens.push('repeat-var-end')
        break

      case 'while-path-clear':
        tokens.push('move-until-wall')
        break

      case 'set-var':
        tokens.push(`set-var:${node.name}:${node.value}`)
        break

      case 'if-has-key':
        tokens.push('if-has-key-start')
        tokens.push(...astToTokens(node.thenBody, pm))
        if (node.elseBody && node.elseBody.length > 0) {
          tokens.push('if-has-key-else')
          tokens.push(...astToTokens(node.elseBody, pm))
        }
        tokens.push('if-has-key-end')
        break

      case 'if-path-clear':
        tokens.push('if-path-clear-start')
        tokens.push(...astToTokens(node.body, pm))
        tokens.push('if-path-clear-end')
        break

      case 'define-proc':
        tokens.push(`define_proc:${node.name}_start`)
        tokens.push(...astToTokens(node.body, pm))
        tokens.push(`define_proc:${node.name}_end`)
        break

      case 'call-proc': {
        // If the proc takes a parameter and an arg is provided, inject a set-var
        // token so the run-loop has the right value before entering the body.
        // Numeric literal → set-var:paramName:value
        // Variable name   → set-var-from-var:paramName:srcVarName
        const paramName = pm.get(node.name)
        if (paramName !== undefined && node.arg !== undefined) {
          if (typeof node.arg === 'string') {
            tokens.push(`set-var-from-var:${paramName}:${node.arg}`)
          } else {
            tokens.push(`set-var:${paramName}:${node.arg}`)
          }
        }
        tokens.push(`call_proc:${node.name}`)
        break
      }
    }
  }

  nodes.forEach(visit)
  return tokens
}

// ── AST → Python ────────────────────────────────────────────────────────────────

/** Generate Python source code from an AST node list. */
export function astToPython(nodes: ASTNode[], indent = 0): string {
  return nodes.map(node => _nodeToPy(node, indent)).join('')
}

function _pad(indent: number): string { return '    '.repeat(indent) }

function _nodeToPy(node: ASTNode, indent: number): string {
  const pad = _pad(indent)
  const inner = indent + 1
  switch (node.type) {
    case 'move':       return `${pad}move_forward()\n`
    case 'turn-left':  return `${pad}turn_left()\n`
    case 'turn-right': return `${pad}turn_right()\n`

    case 'repeat': {
      const body = node.body.length > 0
        ? astToPython(node.body, inner)
        : `${_pad(inner)}pass\n`
      return `${pad}for _ in range(${node.count}):\n${body}`
    }

    case 'repeat-var': {
      const varName = toSnakeCase(node.varName)
      const body = node.body.length > 0
        ? astToPython(node.body, inner)
        : `${_pad(inner)}pass\n`
      return `${pad}for _ in range(${varName}):\n${body}`
    }

    case 'while-path-clear':
      return `${pad}while path_clear():\n${_pad(inner)}move_forward()\n`

    case 'set-var':
      return `${pad}${toSnakeCase(node.name)} = ${node.value}\n`

    case 'if-has-key': {
      const thenCode = node.thenBody.length > 0
        ? astToPython(node.thenBody, inner)
        : `${_pad(inner)}pass\n`
      let result = `${pad}if has_key():\n${thenCode}`
      if (node.elseBody && node.elseBody.length > 0) {
        result += `${pad}else:\n${astToPython(node.elseBody, inner)}`
      }
      return result
    }

    case 'if-path-clear': {
      const body = node.body.length > 0
        ? astToPython(node.body, inner)
        : `${_pad(inner)}pass\n`
      return `${pad}if path_clear():\n${body}`
    }

    case 'define-proc': {
      const name = toSnakeCase(node.name)
      const paramStr = node.param ? toSnakeCase(node.param) : ''
      const body = node.body.length > 0
        ? astToPython(node.body, inner)
        : `${_pad(inner)}pass\n`
      return `${pad}def ${name}(${paramStr}):\n${body}\n`
    }

    case 'call-proc': {
      const argStr = node.arg !== undefined
        ? (typeof node.arg === 'string' ? toSnakeCase(node.arg) : String(node.arg))
        : ''
      return `${pad}${toSnakeCase(node.name)}(${argStr})\n`
    }
  }
}

// ── AST → JavaScript ────────────────────────────────────────────────────────────

/** Generate JavaScript source code from an AST node list. */
export function astToJavaScript(nodes: ASTNode[], indent = 0): string {
  return nodes.map(node => _nodeToJs(node, indent)).join('')
}

function _nodeToJs(node: ASTNode, indent: number): string {
  const pad = _pad(indent)
  const inner = indent + 1
  const emptyBody = `${_pad(inner)}// empty\n`
  switch (node.type) {
    case 'move':       return `${pad}moveForward();\n`
    case 'turn-left':  return `${pad}turnLeft();\n`
    case 'turn-right': return `${pad}turnRight();\n`

    case 'repeat': {
      const body = node.body.length > 0
        ? astToJavaScript(node.body, inner)
        : emptyBody
      return `${pad}for (let i = 0; i < ${node.count}; i++) {\n${body}${pad}}\n`
    }

    case 'repeat-var': {
      const varName = toCamelCase(node.varName)
      const body = node.body.length > 0
        ? astToJavaScript(node.body, inner)
        : emptyBody
      return `${pad}for (let i = 0; i < ${varName}; i++) {\n${body}${pad}}\n`
    }

    case 'while-path-clear':
      return `${pad}while (pathClear()) {\n${_pad(inner)}moveForward();\n${pad}}\n`

    case 'set-var':
      return `${pad}let ${toCamelCase(node.name)} = ${node.value};\n`

    case 'if-has-key': {
      const thenCode = node.thenBody.length > 0
        ? astToJavaScript(node.thenBody, inner)
        : emptyBody
      if (node.elseBody && node.elseBody.length > 0) {
        const elseCode = astToJavaScript(node.elseBody, inner)
        return `${pad}if (hasKey()) {\n${thenCode}${pad}} else {\n${elseCode}${pad}}\n`
      }
      return `${pad}if (hasKey()) {\n${thenCode}${pad}}\n`
    }

    case 'if-path-clear': {
      const body = node.body.length > 0
        ? astToJavaScript(node.body, inner)
        : emptyBody
      return `${pad}if (pathClear()) {\n${body}${pad}}\n`
    }

    case 'define-proc': {
      const name = toCamelCase(node.name)
      const paramStr = node.param ? toCamelCase(node.param) : ''
      const body = node.body.length > 0
        ? astToJavaScript(node.body, inner)
        : emptyBody
      return `${pad}function ${name}(${paramStr}) {\n${body}${pad}}\n\n`
    }

    case 'call-proc': {
      const argStr = node.arg !== undefined
        ? (typeof node.arg === 'string' ? toCamelCase(node.arg) : String(node.arg))
        : ''
      return `${pad}${toCamelCase(node.name)}(${argStr});\n`
    }
  }
}

// ── AST → TypeScript ────────────────────────────────────────────────────────────

/**
 * Generate TypeScript source code from an AST node list.
 * Like JavaScript but adds explicit `number` type annotations on variable
 * declarations and function signatures so students see real TypeScript idioms.
 */
export function astToTypeScript(nodes: ASTNode[], indent = 0): string {
  return nodes.map(node => _nodeToTs(node, indent)).join('')
}

function _nodeToTs(node: ASTNode, indent: number): string {
  const pad = _pad(indent)
  const inner = indent + 1
  const emptyBody = `${_pad(inner)}// empty\n`
  switch (node.type) {
    case 'move':       return `${pad}moveForward();\n`
    case 'turn-left':  return `${pad}turnLeft();\n`
    case 'turn-right': return `${pad}turnRight();\n`

    case 'repeat': {
      const body = node.body.length > 0
        ? astToTypeScript(node.body, inner)
        : emptyBody
      return `${pad}for (let i = 0; i < ${node.count}; i++) {\n${body}${pad}}\n`
    }

    case 'repeat-var': {
      const varName = toCamelCase(node.varName)
      const body = node.body.length > 0
        ? astToTypeScript(node.body, inner)
        : emptyBody
      return `${pad}for (let i = 0; i < ${varName}; i++) {\n${body}${pad}}\n`
    }

    case 'while-path-clear':
      return `${pad}while (pathClear()) {\n${_pad(inner)}moveForward();\n${pad}}\n`

    case 'set-var':
      // TypeScript: add explicit `: number` annotation
      return `${pad}const ${toCamelCase(node.name)}: number = ${node.value};\n`

    case 'if-has-key': {
      const thenCode = node.thenBody.length > 0
        ? astToTypeScript(node.thenBody, inner)
        : emptyBody
      if (node.elseBody && node.elseBody.length > 0) {
        const elseCode = astToTypeScript(node.elseBody, inner)
        return `${pad}if (hasKey()) {\n${thenCode}${pad}} else {\n${elseCode}${pad}}\n`
      }
      return `${pad}if (hasKey()) {\n${thenCode}${pad}}\n`
    }

    case 'if-path-clear': {
      const body = node.body.length > 0
        ? astToTypeScript(node.body, inner)
        : emptyBody
      return `${pad}if (pathClear()) {\n${body}${pad}}\n`
    }

    case 'define-proc': {
      const name = toCamelCase(node.name)
      // TypeScript: annotate parameter type and add `: void` return type
      const paramStr = node.param ? `${toCamelCase(node.param)}: number` : ''
      const body = node.body.length > 0
        ? astToTypeScript(node.body, inner)
        : emptyBody
      return `${pad}function ${name}(${paramStr}): void {\n${body}${pad}}\n\n`
    }

    case 'call-proc': {
      const argStr = node.arg !== undefined
        ? (typeof node.arg === 'string' ? toCamelCase(node.arg) : String(node.arg))
        : ''
      return `${pad}${toCamelCase(node.name)}(${argStr});\n`
    }
  }
}

// ── AST → Blockly Workspace State ───────────────────────────────────────────────

type BlocklyBlock = {
  type: string
  x?: number
  y?: number
  fields?: Record<string, unknown>
  inputs?: Record<string, { block: BlocklyBlock }>
  next?: { block: BlocklyBlock }
}

type BlocklyWorkspaceState = {
  blocks: { languageVersion: number; blocks: BlocklyBlock[] }
}

/** Build a linked chain from a node list.  Returns null for an empty list. */
function _chain(nodes: ASTNode[]): BlocklyBlock | null {
  const blocks: BlocklyBlock[] = []
  for (const node of nodes) {
    const b = _nodeToBlock(node)
    if (b) blocks.push(b)
  }
  if (blocks.length === 0) return null
  // Link them via `next`
  for (let i = blocks.length - 2; i >= 0; i--) {
    blocks[i].next = { block: blocks[i + 1] }
  }
  return blocks[0]
}

function _nodeToBlock(node: ASTNode): BlocklyBlock | null {
  switch (node.type) {
    case 'move':       return { type: 'maze_move' }
    case 'turn-left':  return { type: 'maze_turn_left' }
    case 'turn-right': return { type: 'maze_turn_right' }

    case 'repeat': {
      const bodyBlock = _chain(node.body)
      const b: BlocklyBlock = { type: 'maze_repeat', fields: { TIMES: node.count } }
      if (bodyBlock) b.inputs = { BODY: { block: bodyBlock } }
      return b
    }

    case 'repeat-var': {
      // Map to maze_repeat_steps (only the "steps" variable has a corresponding block)
      const bodyBlock = _chain(node.body)
      const b: BlocklyBlock = { type: 'maze_repeat_steps' }
      if (bodyBlock) b.inputs = { BODY: { block: bodyBlock } }
      return b
    }

    case 'while-path-clear':
      return { type: 'maze_move_until_wall' }

    case 'set-var':
      return { type: 'maze_set_steps', fields: { AMOUNT: node.value } }

    case 'if-has-key': {
      if (node.elseBody && node.elseBody.length > 0) {
        const ifBlock   = _chain(node.thenBody)
        const elseBlock = _chain(node.elseBody)
        const b: BlocklyBlock = { type: 'maze_if_else_has_key', inputs: {} }
        if (ifBlock)   b.inputs!['DO_IF']   = { block: ifBlock }
        if (elseBlock) b.inputs!['DO_ELSE'] = { block: elseBlock }
        return b
      }
      const bodyBlock = _chain(node.thenBody)
      const b: BlocklyBlock = { type: 'maze_if_has_key' }
      if (bodyBlock) b.inputs = { BODY: { block: bodyBlock } }
      return b
    }

    case 'if-path-clear': {
      const bodyBlock = _chain(node.body)
      const b: BlocklyBlock = { type: 'maze_if_path_clear' }
      if (bodyBlock) b.inputs = { BODY: { block: bodyBlock } }
      return b
    }

    case 'define-proc': {
      const bodyBlock = _chain(node.body)
      // Store name as snake_case so both Python + JS generators produce the right identifier.
      // Preserve PARAM so the block UI shows the parameter and code generators include it.
      const fields: Record<string, unknown> = { NAME: toSnakeCase(node.name) }
      if (node.param) fields['PARAM'] = toSnakeCase(node.param)
      const b: BlocklyBlock = { type: 'maze_define_procedure', fields }
      if (bodyBlock) b.inputs = { BODY: { block: bodyBlock } }
      return b
    }

    case 'call-proc': {
      // Preserve ARG (as a string) so code generators can emit the right call.
      const fields: Record<string, unknown> = { NAME: toSnakeCase(node.name) }
      if (node.arg !== undefined) fields['ARG'] = String(node.arg)
      return { type: 'maze_call_procedure', fields }
    }
  }
}

/**
 * Serialize an AST to a Blockly workspace state object suitable for
 * `Blockly.serialization.workspaces.load(state, workspace)`.
 *
 * Procedure definitions are placed as separate top-level block stacks below
 * the main sequence.
 */
export function astToBlocklyState(nodes: ASTNode[]): BlocklyWorkspaceState {
  const mainNodes = nodes.filter(n => n.type !== 'define-proc')
  const procNodes = nodes.filter(n => n.type === 'define-proc') as Extract<ASTNode, { type: 'define-proc' }>[]

  const topBlocks: BlocklyBlock[] = []

  const mainChain = _chain(mainNodes)
  if (mainChain) topBlocks.push({ ...mainChain, x: 50, y: 50 })

  let yOffset = 300
  for (const proc of procNodes) {
    const b = _nodeToBlock(proc)
    if (b) {
      topBlocks.push({ ...b, x: 50, y: yOffset })
      yOffset += 200
    }
  }

  return { blocks: { languageVersion: 0, blocks: topBlocks } }
}
