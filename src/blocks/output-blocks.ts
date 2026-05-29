/**
 * Blockly block definitions for OutputLevel challenges.
 *
 * Two blocks cover the first batch (print + literals):
 *   output_print_text   — 🖨️ print "___"
 *   output_print_number — 🔢 print 0
 *
 * The JS generators emit `print(...)` calls which are intercepted by the
 * sandboxed evaluator in output-engine.ts.
 */
import * as Blockly from 'blockly/core'
import { javascriptGenerator } from 'blockly/javascript'
import type { ToolboxDef } from './maze-blocks'

let _defined = false

export function defineOutputBlocks() {
  if (_defined) return
  _defined = true

  Blockly.defineBlocksWithJsonArray([
    {
      type: 'output_print_text',
      message0: '🖨️ print %1',
      args0: [
        { type: 'field_input', name: 'TEXT', text: 'Hello' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 160,
      tooltip: 'Print a line of text.',
    },
    {
      type: 'output_print_number',
      message0: '🔢 print %1',
      args0: [
        { type: 'field_number', name: 'VALUE', value: 0 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 200,
      tooltip: 'Print a number.',
    },
  ])

  javascriptGenerator.forBlock['output_print_text'] = (block) => {
    const text = block.getFieldValue('TEXT') ?? ''
    // Escape backslashes and double-quotes in the string
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    return `print("${escaped}");\n`
  }

  javascriptGenerator.forBlock['output_print_number'] = (block) => {
    const value = block.getFieldValue('VALUE') ?? '0'
    return `print(${value});\n`
  }
}

/**
 * Build the toolbox for an OutputLevel.
 * Shows a single flat flyout with the two print blocks.
 */
export function makeOutputToolbox(): ToolboxDef {
  return {
    kind: 'flyoutToolbox',
    contents: [
      { kind: 'label', text: '⭐ This Level' },
      { kind: 'block', type: 'output_print_text' },
      { kind: 'block', type: 'output_print_number' },
    ],
  }
}

/**
 * Compile the current Blockly workspace for an OutputLevel into a JS string
 * that calls `print(...)` for each block.
 */
export function compileOutputWorkspace(workspace: Blockly.WorkspaceSvg): string {
  return javascriptGenerator.workspaceToCode(workspace)
}
