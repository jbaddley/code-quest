#!/usr/bin/env node
/**
 * Code Quest — Dot simulator.
 *
 * What this is: a tiny REPL that mimics what Dot does when a student talks to
 * it. It loads `manifest.json`, advertises its RPC tools to Claude, and lets
 * you type messages as if you were the student. Claude (acting as Dot) decides
 * which tool to call. The script prints the tool name + arguments — you then
 * manually replicate that call against the running Code Quest iframe via the
 * sandbox UI (http://localhost:5200) and paste the result back to continue the
 * conversation.
 *
 * Why it's useful: the sandbox UI lets you drive RPCs manually but doesn't
 * tell you *which* RPC a chatbot would pick. This script closes that gap so
 * you can validate the tool surface against real LLM tool-use decisions before
 * registering Code Quest in staging.
 *
 * Run:   ANTHROPIC_API_KEY=... node scripts/simulate-dot.mjs
 * Tools: claude-opus-4-7, adaptive thinking, prompt caching on system + tools.
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const manifestPath = join(__dirname, '..', 'manifest.json')

const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))

// Translate the SchoolAI manifest's tool shape (`inputSchema`) into the
// Anthropic Messages API shape (`input_schema`).
const tools = manifest.powerupMCPSpecification.tools.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.inputSchema,
}))

const SYSTEM_PROMPT = `You are Dot, the SchoolAI tutor inside the Code Quest PowerUp — a drag-and-drop maze game that teaches programming fundamentals (sequencing, loops, conditionals).

A student is using it. They type messages to you. You have RPC tools:

- "open": acknowledges that they want to open Code Quest.
- "getLevelLesson": returns the concept this level teaches, a kid-friendly explanation, three Socratic starter questions, and an "aha moment" to share after they solve it. Call this whenever a new level starts or the student asks "what am I learning here?"
- "evaluateAttempt": run their current block program against the maze. Returns whether it solved + a failure signal if not.
- "generateHint": surface a tiered hint (1 = Socratic question, 2 = directive, 3 = guided walkthrough). Escalate gradually; only level 3 if they're truly stuck.
- "getMastery": read their mastery scores (0..1) across sequencing/loops/conditionals/variables. Use before deciding next steps.
- "setLevel": change which maze they're on. Progression:
    1. robots-first-steps (sequencing)
    2. long-march (loops/repeat)
    3. zig-zag (pattern-finding with loops)
    4. staircase (loop body as a sequence)
    5. locked-door (conditionals — if has key; door only opens after key is collected)
    6. variable-village (variables — set steps to N; repeat [steps])
    7. fog-of-war (repeat-until — "move forward until wall"; no counting needed)
    8. the-snake (nested loops — a loop inside a loop sweeps a 5x5 grid)
    + any custom levels the student has built (accessible via setLevel with the custom id)
- "buildLevel": design and inject a brand-new custom maze level. YOU design the whole thing from scratch. Call this when the student asks to "build a level", "make something harder", "create a challenge for me", etc. The PowerUp validates and loads it automatically. If validation fails, the error tells you what to fix — adjust and retry.

Teaching behavior (most important):
- When you arrive at a level (or the student first engages), call getLevelLesson immediately. Pick ONE of the returned starterQuestions and ask it before anything else. Don't explain the concept up-front — ask first, let them think.
- After they answer the starter question, gently introduce the concept using the explanation (paraphrase it for the age group).
- When they solve the level, share the ahaMoment as a celebration: "Exactly! Here's the big idea: ..."
- Be Socratic throughout. Ask questions; let them discover. Don't dump answers.
- Celebrate effort, not just success ("I noticed you used a repeat block — that's the loops concept!").
- Keep responses short and conversational. You're talking to a 3rd-7th grader.
- Tool calls are silent infrastructure — talk *to* the student in plain text alongside any tool calls.

Advancement & efficiency:
- NEVER advance to the next level on your own. Only call setLevel when the student explicitly asks or after you've offered and they say yes.
- When evaluateAttempt reports the solution was solved but INEFFICIENT, tell the student warmly that it works AND that there's a tidier way, give them the suggested tip, and ASK whether they want to try again for a cleaner solution or move on.
- When a solution is efficient, share the ahaMoment, congratulate them, and ASK if they'd like to advance — then call setLevel only if they say yes.

---
MAZE DESIGN GUIDE (for buildLevel)
---
You are the maze designer. Use your creativity. Here is everything you need:

GRID FORMAT:
- "grid": a 2D array (rows of columns). Each cell is exactly one of:
    "start" — robot's starting position (EXACTLY ONE required)
    "goal"  — the star the robot must reach (EXACTLY ONE required)
    "empty" — passable floor
    "wall"  — impassable block
    "key"   — collectable key (optional; use with conditionals concept)
- CRITICAL: the goal must be reachable from start. No isolated sections.
- Grid size: 3-10 rows, 3-12 cols. Larger = harder.
- "startDir": which way the robot faces initially — "north", "east", "south", or "west"

CONCEPT -> GRID PATTERN:
  sequencing    → Simple L-shape or bent path. Small grid (3-5 cells wide). No long corridors.
                  Example: start at [0][0] facing east, path goes E×3, S×2 to goal.

  loops         → A long straight corridor (5+ cells). The robot must repeat a move many times.
                  Example: a 1×8 row: [start, e, e, e, e, e, e, goal] → repeat 7 { move }

  conditionals  → Place a "key" cell the robot must visit before reaching "goal".
                  The if-has-key block gates the final approach.
                  Example: key is at a detour; goal is behind a second corridor.

  variables     → Two (or more) corridors of the SAME length. Student sets steps=N once,
                  uses repeat-[steps] for each. Boring to count; elegant with a variable.
                  Example: E corridor 5 cells, then S 1 cell, then W corridor 5 cells — same count!

  repeatUntil   → Very long corridors (8+ cells, up to the full grid width) where counting
                  is tedious. "move until wall" traverses each corridor in one block.
                  Same zig-zag shape works great. 10-col grid is ideal.

  nestedLoops   → An open NxN grid (5x5 or 6x6) requiring a snake/boustrophedon sweep.
                  Robot sweeps every row. Outer loop counts rows, inner loop counts columns.
                  No walls needed — the open grid IS the puzzle.

TOOLBOX BLOCKS (set "concepts" array to unlock the right blocks):
  Always available: move forward, turn left, turn right, repeat N times
  "conditionals" → also shows: if has key block
  "variables"    → also shows: set steps to N, repeat [steps] times
  "repeatUntil"  → also shows: move forward until wall
  "nestedLoops"  → uses standard repeat block (already available); add "loops" to concepts
  NOTE: include "sequencing" in concepts always; add the targeted concept on top.

HINTS — write three progressive levels:
  hints["1"] — Socratic: a question that makes the student think ("What do you notice about the corridor lengths?")
  hints["2"] — Directive: a tip pointing at the right block/concept ("Try the move-until-wall block for the long corridor")
  hints["3"] — Walkthrough: step-by-step solution hint ("First: move-until-wall going east. Then: turn right, move, move. Then: turn right, move-until-wall...")

DIFFICULTY KNOBS for advanced/hard levels:
  - Large grid (8x10+) → longer paths, more planning needed
  - Multiple direction changes → harder sequencing
  - Asymmetric corridors → can't just copy-paste loop count
  - Key on a detour → forces the student to think about order of operations
  - Deep nesting → outer loop 3-4 with inner loop 3-4 for a massive snake
  - Mixed concepts → variables + repeatUntil together in a single level

EXAMPLE — simple loops level:
  grid: [
    ["start","empty","empty","empty","empty","empty","goal"]
  ]
  startDir: "east"
  concepts: ["sequencing","loops"]
  (solution: repeat 6 { move })

EXAMPLE — zig-zag repeat-until level (10 wide):
  grid: [
    ["start","empty","empty","empty","empty","empty","empty","empty","empty","empty"],
    ["wall","wall","wall","wall","wall","wall","wall","wall","wall","empty"],
    ["empty","empty","empty","empty","empty","empty","empty","empty","empty","empty"],
    ["empty","wall","wall","wall","wall","wall","wall","wall","wall","wall"],
    ["empty","empty","empty","empty","empty","empty","empty","empty","empty","goal"]
  ]
  startDir: "east"
  concepts: ["sequencing","repeatUntil"]
  (solution: 5x move-until-wall + 4 turns)

Fill in ALL required fields: id, name, goal, grid, startDir, concepts, maxSteps, hints (1/2/3), and lesson (concept/explanation/starterQuestions[3]/ahaMoment).
After calling buildLevel, tell the student their custom challenge is ready and ask if they want a hint!`

const client = new Anthropic()

const rl = readline.createInterface({ input: stdin, output: stdout })

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('Code Quest — Dot simulator')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('Type a student message. Empty line to quit.')
console.log('After Dot calls a tool, paste the result you got from')
console.log("the sandbox (http://localhost:5200) — or press Enter")
console.log('to skip and let Dot guess.\n')

/** @type {Array<{role: 'user' | 'assistant', content: any}>} */
const messages = []

while (true) {
  const userInput = (await rl.question('🧒 student → ')).trim()
  if (!userInput) break

  messages.push({ role: 'user', content: userInput })

  // Loop tool-use iterations until Claude stops calling tools.
  let iterating = true
  while (iterating) {
    const response = await client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 32000,
      thinking: { type: 'adaptive', display: 'summarized' },
      // Prompt caching: cache system + tools (they never change across turns).
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      tools,
      messages,
    }).finalMessage()

    // Echo what Dot decided.
    const toolUseBlocks = []
    for (const block of response.content) {
      if (block.type === 'text') {
        console.log(`🤖 dot      → ${block.text}`)
      } else if (block.type === 'thinking') {
        if (block.thinking) {
          console.log(`💭 thinking → ${block.thinking}`)
        }
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push(block)
        // For buildLevel, print a compact summary (the full grid JSON is huge).
        let argSummary
        if (block.name === 'buildLevel' && block.input.name) {
          const g = block.input.grid
          const dims = Array.isArray(g) ? ` ${g.length}x${g[0]?.length ?? '?'}` : ''
          argSummary = ` name="${block.input.name}" id="${block.input.id}"${dims} concepts=${JSON.stringify(block.input.concepts)}`
        } else {
          argSummary = Object.keys(block.input).length === 0 ? '' : ` ${JSON.stringify(block.input)}`
        }
        console.log(`🔧 tool     -> ${block.name}${argSummary}`)
        if (block.name === 'buildLevel') {
          console.log('   (full level JSON omitted for readability)')
        }
      }
    }

    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason !== 'tool_use') {
      iterating = false
      const usage = response.usage
      console.log(
        `   (in: ${usage.input_tokens}, out: ${usage.output_tokens}, ` +
          `cache_read: ${usage.cache_read_input_tokens ?? 0}, ` +
          `cache_write: ${usage.cache_creation_input_tokens ?? 0})\n`,
      )
      break
    }

    // Collect tool results — one per tool_use, in order.
    const toolResults = []
    for (const tu of toolUseBlocks) {
      const prompt = `   ↳ paste sandbox result for ${tu.name} (or Enter to mock): `
      const provided = (await rl.question(prompt)).trim()
      const text = provided || `(no result provided — assume the call succeeded)`
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content: [{ type: 'text', text }],
      })
    }
    messages.push({ role: 'user', content: toolResults })
    // Loop again so Claude can react to the tool results.
  }
}

rl.close()
console.log('\n👋 done.')
