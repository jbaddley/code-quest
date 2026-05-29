/**
 * JavaScript code generators for all maze Blockly blocks.
 *
 * Parallels maze-python-generator.ts but targets JavaScript syntax.
 * Uses camelCase API names that match real JS conventions:
 *   moveForward(), turnLeft(), turnRight(), hasKey(), pathClear()
 *
 * Call `defineMazeJsGenerators()` once at module load.
 *
 * NOTE: `compileToJavaScript` does NOT use `javascriptGenerator.workspaceToCode`
 * directly.  Both this file and maze-blocks.ts register generators on the same
 * `javascriptGenerator` singleton.  maze-blocks.ts must be initialised LAST
 * (so its DSL token generators win for the execution path in `compileWorkspace`).
 * For the JS code-display panel we therefore use a Python→AST→JS round-trip
 * instead of calling `workspaceToCode` a second time.
 */
import * as Blockly from 'blockly/core'
import { javascriptGenerator } from 'blockly/javascript'
import { compileToPython } from './maze-python-generator'
import { parsePythonToAst } from '../game/python-parser'
import { astToJavaScript } from '../game/maze-ast'

/** Convert a raw block name (snake_case or kebab-case) to camelCase. */
function toCamel(raw: string): string {
  return raw
    .replace(/-([a-zA-Z])/g, (_, c: string) => c.toUpperCase())
    .replace(/_([a-zA-Z])/g, (_, c: string) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '')
}

export function defineMazeJsGenerators() {
  // 4-space indent — consistent with the Python panel so students see a fair comparison.
  javascriptGenerator.INDENT = '    '

  // ── Movement ────────────────────────────────────────────────────────────────

  javascriptGenerator.forBlock['maze_move']       = () => 'moveForward();\n'
  javascriptGenerator.forBlock['maze_turn_left']  = () => 'turnLeft();\n'
  javascriptGenerator.forBlock['maze_turn_right'] = () => 'turnRight();\n'

  // ── Loops ───────────────────────────────────────────────────────────────────

  javascriptGenerator.forBlock['maze_repeat'] = (block) => {
    const times = Number(block.getFieldValue('TIMES')) || 1
    const body  = javascriptGenerator.statementToCode(block, 'BODY') || '    // empty\n'
    return `for (let i = 0; i < ${times}; i++) {\n${body}}\n`
  }

  javascriptGenerator.forBlock['maze_move_until_wall'] = () =>
    'while (pathClear()) {\n    moveForward();\n}\n'

  // ── Conditionals ────────────────────────────────────────────────────────────

  javascriptGenerator.forBlock['maze_if_has_key'] = (block) => {
    const body = javascriptGenerator.statementToCode(block, 'BODY') || '    // empty\n'
    return `if (hasKey()) {\n${body}}\n`
  }

  javascriptGenerator.forBlock['maze_if_path_clear'] = (block) => {
    const body = javascriptGenerator.statementToCode(block, 'BODY') || '    // empty\n'
    return `if (pathClear()) {\n${body}}\n`
  }

  javascriptGenerator.forBlock['maze_if_else_has_key'] = (block) => {
    const ifBody   = javascriptGenerator.statementToCode(block, 'DO_IF')   || '    // empty\n'
    const elseBody = javascriptGenerator.statementToCode(block, 'DO_ELSE') || '    // empty\n'
    return `if (hasKey()) {\n${ifBody}} else {\n${elseBody}}\n`
  }

  // ── Variables ───────────────────────────────────────────────────────────────

  javascriptGenerator.forBlock['maze_set_steps'] = (block) => {
    const n = block.getFieldValue('AMOUNT')
    return `let steps = ${n};\n`
  }

  javascriptGenerator.forBlock['maze_repeat_steps'] = (block) => {
    const body = javascriptGenerator.statementToCode(block, 'BODY') || '    // empty\n'
    return `for (let i = 0; i < steps; i++) {\n${body}}\n`
  }

  // ── Functions ───────────────────────────────────────────────────────────────

  javascriptGenerator.forBlock['maze_define_procedure'] = (block) => {
    const name = toCamel(block.getFieldValue('NAME') || 'myMove')
    const rawParam = (block.getFieldValue('PARAM') || '').trim()
    const param = rawParam ? toCamel(rawParam) : ''
    const body  = javascriptGenerator.statementToCode(block, 'BODY') || '    // empty\n'
    return `function ${name}(${param}) {\n${body}}\n`
  }

  javascriptGenerator.forBlock['maze_call_procedure'] = (block) => {
    const name = toCamel(block.getFieldValue('NAME') || 'myMove')
    const rawArg = (block.getFieldValue('ARG') || '').trim()
    const arg = rawArg ? toCamel(rawArg) : ''
    return `${name}(${arg});\n`
  }
}

/**
 * Generate a JavaScript string from the current Blockly workspace.
 * Uses a Python→AST→JavaScript round-trip to avoid the `javascriptGenerator`
 * conflict described in the module docstring above.
 * Returns an empty string if the workspace is empty.
 */
export function compileToJavaScript(workspace: Blockly.WorkspaceSvg): string {
  const python = compileToPython(workspace)
  if (!python.trim()) return ''
  const { nodes } = parsePythonToAst(python)
  return astToJavaScript(nodes)
}
