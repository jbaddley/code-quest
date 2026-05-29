/**
 * Python code generators for all maze Blockly blocks.
 *
 * These parallel the JS generators in maze-blocks.ts, but produce human-readable
 * Python instead of DSL tokens. Used to power the Stage 2 "👁 See the Code" panel.
 *
 * Call `defineMazePythonGenerators()` once at module load time (alongside
 * `defineMazeBlocks()`), then call `compileToPython(workspace)` to get a Python
 * string that reflects the current block arrangement.
 */
import * as Blockly from 'blockly/core'
import { pythonGenerator } from 'blockly/python'

export function defineMazePythonGenerators() {
  // Use 4-space indentation — standard Python convention and more readable at small font sizes.
  pythonGenerator.INDENT = '    '

  // ── Movement ────────────────────────────────────────────────────────────────

  pythonGenerator.forBlock['maze_move'] = () => 'move_forward()\n'
  pythonGenerator.forBlock['maze_turn_left'] = () => 'turn_left()\n'
  pythonGenerator.forBlock['maze_turn_right'] = () => 'turn_right()\n'

  // ── Loops ───────────────────────────────────────────────────────────────────

  pythonGenerator.forBlock['maze_repeat'] = (block) => {
    const times = Number(block.getFieldValue('TIMES')) || 1
    const body = pythonGenerator.statementToCode(block, 'BODY') || '    pass\n'
    return `for _ in range(${times}):\n${body}`
  }

  pythonGenerator.forBlock['maze_move_until_wall'] = () =>
    'while path_clear():\n    move_forward()\n'

  // ── Conditionals ────────────────────────────────────────────────────────────

  pythonGenerator.forBlock['maze_if_has_key'] = (block) => {
    const body = pythonGenerator.statementToCode(block, 'BODY') || '    pass\n'
    return `if has_key():\n${body}`
  }

  pythonGenerator.forBlock['maze_if_path_clear'] = (block) => {
    const body = pythonGenerator.statementToCode(block, 'BODY') || '    pass\n'
    return `if path_clear():\n${body}`
  }

  pythonGenerator.forBlock['maze_if_else_has_key'] = (block) => {
    const ifBody = pythonGenerator.statementToCode(block, 'DO_IF') || '    pass\n'
    const elseBody = pythonGenerator.statementToCode(block, 'DO_ELSE') || '    pass\n'
    return `if has_key():\n${ifBody}else:\n${elseBody}`
  }

  // ── Variables ───────────────────────────────────────────────────────────────

  pythonGenerator.forBlock['maze_set_steps'] = (block) => {
    const n = block.getFieldValue('AMOUNT')
    return `steps = ${n}\n`
  }

  pythonGenerator.forBlock['maze_repeat_steps'] = (block) => {
    const body = pythonGenerator.statementToCode(block, 'BODY') || '    pass\n'
    return `for _ in range(steps):\n${body}`
  }

  // ── Functions ───────────────────────────────────────────────────────────────

  pythonGenerator.forBlock['maze_define_procedure'] = (block) => {
    // Convert kebab-case names (e.g. "my-move") to valid Python identifiers.
    const rawName = block.getFieldValue('NAME') || 'my_move'
    const name = rawName.replace(/-/g, '_').replace(/[^a-zA-Z0-9_]/g, '_')
    const rawParam = (block.getFieldValue('PARAM') || '').trim()
    const param = rawParam ? rawParam.replace(/-/g, '_').replace(/[^a-zA-Z0-9_]/g, '_') : ''
    const body = pythonGenerator.statementToCode(block, 'BODY') || '    pass\n'
    return `def ${name}(${param}):\n${body}\n`
  }

  pythonGenerator.forBlock['maze_call_procedure'] = (block) => {
    const rawName = block.getFieldValue('NAME') || 'my_move'
    const name = rawName.replace(/-/g, '_').replace(/[^a-zA-Z0-9_]/g, '_')
    const rawArg = (block.getFieldValue('ARG') || '').trim()
    const arg = rawArg ? rawArg.replace(/-/g, '_').replace(/[^a-zA-Z0-9_]/g, '_') : ''
    return `${name}(${arg})\n`
  }
}

/**
 * Generate a Python string from the current Blockly workspace.
 * Returns an empty string if the workspace is empty.
 */
export function compileToPython(workspace: Blockly.WorkspaceSvg): string {
  return pythonGenerator.workspaceToCode(workspace)
}
