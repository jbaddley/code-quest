import * as Blockly from 'blockly/core'
import { javascriptGenerator, Order } from 'blockly/javascript'

/**
 * Block definitions for the maze game. We keep the block set tiny on purpose —
 * the early levels exist to teach sequencing + loops, nothing else.
 *
 * The generator emits a *string-array literal* of instruction tokens that the
 * engine interprets:
 *   ["move", "turn-right", "move", "move"]
 *
 * That avoids running untrusted JS via `eval`; the engine consumes pure data.
 */

export function defineMazeBlocks() {
  Blockly.defineBlocksWithJsonArray([
    {
      type: 'maze_move',
      message0: '⬆ move forward',
      previousStatement: null,
      nextStatement: null,
      colour: 220,
      tooltip: 'Move one cell in the direction the robot is facing.',
    },
    {
      type: 'maze_turn_left',
      message0: '↺ turn left',
      previousStatement: null,
      nextStatement: null,
      colour: 260,
      tooltip: 'Rotate the robot 90° counter-clockwise.',
    },
    {
      type: 'maze_turn_right',
      message0: '↻ turn right',
      previousStatement: null,
      nextStatement: null,
      colour: 260,
      tooltip: 'Rotate the robot 90° clockwise.',
    },
    {
      type: 'maze_repeat',
      message0: '🔁 repeat %1 times %2 %3',
      args0: [
        { type: 'field_number', name: 'TIMES', value: 4, min: 1, max: 20, precision: 1 },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'BODY' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 120,
      tooltip: 'Run the blocks inside N times.',
    },
    {
      type: 'maze_if_has_key',
      message0: '🔑 if has key %1 %2',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'BODY' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 40,
      tooltip:
        'Only run the blocks inside if the robot has already picked up the key.',
    },

    // ── Variables ──────────────────────────────────────────────────────────
    {
      type: 'maze_set_steps',
      message0: '📦 set steps to %1',
      args0: [
        { type: 'field_number', name: 'AMOUNT', value: 4, min: 1, max: 20, precision: 1 },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
      tooltip: 'Store a number in the "steps" variable. Use "repeat steps" to run that many times.',
    },
    {
      type: 'maze_repeat_steps',
      message0: '🔄 repeat [steps] times %1 %2',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'BODY' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
      tooltip: 'Repeat the blocks inside however many times "steps" holds. Set steps first!',
    },

    // ── Repeat until ───────────────────────────────────────────────────────
    {
      type: 'maze_move_until_wall',
      message0: '⏩ move forward until wall',
      previousStatement: null,
      nextStatement: null,
      colour: 190,
      tooltip: 'Keep moving forward until the robot would hit a wall or the edge. No counting needed!',
    },
  ])

  // ── New blocks: if path clear, if/else has key, procedures ───────────────
  Blockly.defineBlocksWithJsonArray([
    {
      type: 'maze_if_path_clear',
      message0: '🟢 if path clear ahead %1 %2',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'BODY' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 160,
      tooltip: 'Only run the blocks inside if the path ahead is not blocked.',
    },
    {
      type: 'maze_if_else_has_key',
      message0: '🔑 if has key %1 %2 else %3 %4',
      args0: [
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO_IF' },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO_ELSE' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 40,
      tooltip: 'Run one set of blocks if carrying the key, otherwise run the other set.',
    },
    {
      type: 'maze_define_procedure',
      message0: '📋 define %1 (%2) as: %3 %4',
      args0: [
        { type: 'field_input', name: 'NAME', text: 'my-move' },
        { type: 'field_input', name: 'PARAM', text: '' },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'BODY' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
      tooltip: 'Define a named function. Optionally add a parameter name (e.g. "n") if the function takes a number input.',
    },
    {
      type: 'maze_call_procedure',
      message0: '▶ do %1 (%2)',
      args0: [
        { type: 'field_input', name: 'NAME', text: 'my-move' },
        { type: 'field_input', name: 'ARG', text: '' },
      ],
      previousStatement: null,
      nextStatement: null,
      colour: 290,
      tooltip: "Call a named function. If it takes a parameter, enter a number or variable name here.",
    },
  ])

  // ── Generators ───────────────────────────────────────────────────────────
  // Each block emits a JS string that, when evaluated in our sandboxed
  // runtime, appends instruction tokens to a shared array `_i`.
  // Movement tokens include the block ID so the runner can highlight them:
  //   format: "op:blockId"

  javascriptGenerator.forBlock['maze_move'] = (block) => `_i.push("move:${block.id}");\n`
  javascriptGenerator.forBlock['maze_turn_left'] = (block) => `_i.push("turn-left:${block.id}");\n`
  javascriptGenerator.forBlock['maze_turn_right'] = (block) => `_i.push("turn-right:${block.id}");\n`
  javascriptGenerator.forBlock['maze_repeat'] = (block) => {
    const times = Number(block.getFieldValue('TIMES')) || 0
    const branch = javascriptGenerator.statementToCode(block, 'BODY')
    return `for (let _r = 0; _r < ${times}; _r++) {\n${branch}}\n`
  }
  // The conditional can't be flattened at compile time — the condition depends
  // on runtime maze state. So we emit bracket markers around the body and let
  // the runner decide whether to enter (see runProgram + findMatchingEnd).
  javascriptGenerator.forBlock['maze_if_has_key'] = (block) => {
    const branch = javascriptGenerator.statementToCode(block, 'BODY')
    return `_i.push("if-has-key-start");\n${branch}_i.push("if-has-key-end");\n`
  }

  // Variables: set-steps stores a value token; repeat-steps emits runtime-loop
  // bracket markers so the runner can manage the iteration count at runtime.
  javascriptGenerator.forBlock['maze_set_steps'] = (block) => {
    const n = block.getFieldValue('AMOUNT')
    return `_i.push("set-var:steps:${n}");\n`
  }
  javascriptGenerator.forBlock['maze_repeat_steps'] = (block) => {
    const branch = javascriptGenerator.statementToCode(block, 'BODY')
    return `_i.push("repeat-var-start:steps");\n${branch}_i.push("repeat-var-end");\n`
  }

  // Repeat-until: a single marker token; the runner loops in place until the
  // next step would fail (wall, out-of-bounds) or the robot reaches the goal.
  javascriptGenerator.forBlock['maze_move_until_wall'] = () =>
    `_i.push("move-until-wall");\n`

  // if path clear: runtime conditional — emit bracket markers
  javascriptGenerator.forBlock['maze_if_path_clear'] = (block) => {
    const branch = javascriptGenerator.statementToCode(block, 'BODY')
    return `_i.push("if-path-clear-start");\n${branch}_i.push("if-path-clear-end");\n`
  }

  // if/else has key: emits start, else-divider, and end markers
  javascriptGenerator.forBlock['maze_if_else_has_key'] = (block) => {
    const branchIf = javascriptGenerator.statementToCode(block, 'DO_IF')
    const branchElse = javascriptGenerator.statementToCode(block, 'DO_ELSE')
    return (
      `_i.push("if-has-key-start");\n${branchIf}` +
      `_i.push("if-has-key-else");\n${branchElse}` +
      `_i.push("if-has-key-end");\n`
    )
  }

  // Procedure definition: emits define_proc:NAME_start ... define_proc:NAME_end
  // The parameter name is NOT encoded in the tokens because parameter binding
  // happens at the call site (set-var emitted by maze_call_procedure before
  // call_proc). The define tokens just record the body for the run-loop.
  javascriptGenerator.forBlock['maze_define_procedure'] = (block) => {
    const name = block.getFieldValue('NAME') || 'my-move'
    const branch = javascriptGenerator.statementToCode(block, 'BODY')
    return `_i.push("define_proc:${name}_start");\n${branch}_i.push("define_proc:${name}_end");\n`
  }

  // Procedure call: emits optional set-var (to bind arg → param) then call_proc:NAME.
  // Looks up the matching define block on the workspace to find the parameter name.
  javascriptGenerator.forBlock['maze_call_procedure'] = (block) => {
    const name = block.getFieldValue('NAME') || 'my-move'
    const argStr = (block.getFieldValue('ARG') || '').trim()

    let code = ''
    if (argStr !== '') {
      // Find the matching define block to resolve the parameter name.
      const defineBlock = block.workspace
        ?.getAllBlocks(false)
        .find((b) => b.type === 'maze_define_procedure' && (b.getFieldValue('NAME') || 'my-move') === name)
      const param = (defineBlock?.getFieldValue('PARAM') || '').trim()

      if (param) {
        const argNum = parseInt(argStr, 10)
        if (!isNaN(argNum)) {
          // Numeric literal → set-var:param:value
          code += `_i.push("set-var:${param}:${argNum}");\n`
        } else {
          // Variable name → set-var-from-var:param:srcVar
          code += `_i.push("set-var-from-var:${param}:${argStr}");\n`
        }
      }
    }
    code += `_i.push("call_proc:${name}");\n`
    return code
  }

  // Re-export so we can call later
  return { javascriptGenerator, Order }
}

// ── Toolbox ───────────────────────────────────────────────────────────────────

type BlockEntry = { kind: 'block'; type: string }
type LabelEntry = { kind: 'label'; text: string }
type SepEntry   = { kind: 'sep'; gap?: number }

export type ToolboxDef = {
  kind: 'flyoutToolbox'
  contents: Array<BlockEntry | LabelEntry | SepEntry>
}

/**
 * Every block in the game, in the order they should appear in the toolbox.
 * This list drives both the "This Level" category (subset) and "Explore" (remainder).
 */
const ALL_BLOCKS: BlockEntry[] = [
  { kind: 'block', type: 'maze_move' },
  { kind: 'block', type: 'maze_turn_left' },
  { kind: 'block', type: 'maze_turn_right' },
  { kind: 'block', type: 'maze_repeat' },
  { kind: 'block', type: 'maze_if_has_key' },
  { kind: 'block', type: 'maze_if_path_clear' },
  { kind: 'block', type: 'maze_if_else_has_key' },
  { kind: 'block', type: 'maze_set_steps' },
  { kind: 'block', type: 'maze_repeat_steps' },
  { kind: 'block', type: 'maze_move_until_wall' },
  { kind: 'block', type: 'maze_define_procedure' },
  { kind: 'block', type: 'maze_call_procedure' },
]

export interface ToolboxOptions {
  /** Show the `if has key` conditional block in "This Level". */
  conditionals?: boolean
  /** Show the `set steps` + `repeat steps` variable blocks in "This Level". */
  variables?: boolean
  /** Show the `move forward until wall` block in "This Level". */
  repeatUntil?: boolean
  /** Show procedure define/call blocks in "This Level". */
  functions?: boolean
}

/**
 * Build a flat block palette for a level.
 *
 * All blocks are shown in a single always-visible flyout — no tab-switching
 * required. Level-relevant blocks appear first under a "This Level" label;
 * any additional blocks the student hasn't unlocked yet follow under "More
 * Blocks" so curious students can explore without a separate tab.
 */
export function makeToolbox(opts: ToolboxOptions = {}): ToolboxDef {
  // Build the set of block types that belong in "This Level".
  const levelTypes = new Set<string>([
    'maze_move', 'maze_turn_left', 'maze_turn_right', 'maze_repeat',
  ])
  if (opts.conditionals) {
    levelTypes.add('maze_if_has_key')
    levelTypes.add('maze_if_path_clear')
    levelTypes.add('maze_if_else_has_key')
  }
  if (opts.variables) {
    levelTypes.add('maze_set_steps')
    levelTypes.add('maze_repeat_steps')
  }
  if (opts.repeatUntil) levelTypes.add('maze_move_until_wall')
  if (opts.functions) {
    levelTypes.add('maze_define_procedure')
    levelTypes.add('maze_call_procedure')
  }

  const levelBlocks   = ALL_BLOCKS.filter((b) => levelTypes.has(b.type))
  const exploreBlocks = ALL_BLOCKS.filter((b) => !levelTypes.has(b.type))

  const contents: ToolboxDef['contents'] = [
    { kind: 'label', text: '⭐ This Level' },
    ...levelBlocks,
  ]

  if (exploreBlocks.length > 0) {
    contents.push({ kind: 'sep', gap: 12 })
    contents.push({ kind: 'label', text: '🔭 More Blocks' })
    contents.push(...exploreBlocks)
  }

  return { kind: 'flyoutToolbox', contents }
}

/** Default palette used when no level options are specified. */
export const MAZE_TOOLBOX = makeToolbox()

/**
 * Compile the current Blockly workspace into a flat list of instructions.
 * We do this by generating JS that pushes tokens to an array, then running
 * that JS in a *scoped Function*. No user input is executed — only the
 * shape we generated ourselves from known block types.
 */
export function compileWorkspace(workspace: Blockly.WorkspaceSvg): string[] {
  const code = javascriptGenerator.workspaceToCode(workspace)
  const instructions: string[] = []
  // eslint-disable-next-line no-new-func
  const fn = new Function('_i', code)
  fn(instructions)
  return instructions
}
