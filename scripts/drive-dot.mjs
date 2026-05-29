#!/usr/bin/env node
/**
 * Code Quest — end-to-end Dot driver.
 *
 * Closes the loop that simulate-dot.mjs left open:
 *
 *   you type a student message
 *     → Claude (as Dot) picks an RPC
 *     → Playwright dispatches that RPC against the real iframe via the SDK harness
 *     → the iframe runs the game (you see the robot animate in the browser)
 *     → the MCPToolResult comes back to Claude
 *     → Claude responds (and possibly calls another RPC)
 *
 * Architecture:
 *   - bridge.html (served by your Vite dev server on :9010) hosts the
 *     Code Quest iframe inside a PowerupHarness. The harness uses the same
 *     postMessage protocol the production SchoolAI app does.
 *   - This script launches Chromium via Playwright, navigates to bridge.html,
 *     and dispatches RPCs through `window.__bridge.callRpc(name, args)`.
 *   - Anthropic SDK with claude-opus-4-7, adaptive thinking, prompt caching.
 *
 * Run:
 *   ANTHROPIC_API_KEY=sk-ant-... pnpm drive-dot
 *
 * Headless mode (faster, no browser window):
 *   HEADLESS=1 pnpm drive-dot
 *
 * Custom dev-server origin:
 *   BRIDGE_URL=http://127.0.0.1:9010/bridge.html pnpm drive-dot
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import readline from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const manifestPath = join(__dirname, '..', 'manifest.json')

const BRIDGE_URL = process.env.BRIDGE_URL ?? 'http://127.0.0.1:9010/bridge.html'
const HEADLESS = process.env.HEADLESS === '1'

// Fail fast — otherwise we spin up Chromium + connect to the bridge before
// the first messages.create() throws on the missing key, which is annoying.
if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'ANTHROPIC_API_KEY is not set.\n' +
      '\n' +
      'Set it for this run:\n' +
      '  ANTHROPIC_API_KEY=sk-ant-... pnpm drive-dot\n' +
      '\n' +
      'Or persist it for your shell:\n' +
      "  echo 'export ANTHROPIC_API_KEY=sk-ant-...' >> ~/.zshrc && source ~/.zshrc",
  )
  process.exit(1)
}

// ── Load manifest + translate to Anthropic tool shape ────────────────────
const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
const tools = manifest.powerupMCPSpecification.tools.map((t) => ({
  name: t.name,
  description: t.description,
  input_schema: t.inputSchema,
}))

const SYSTEM_PROMPT = `You are Dot, the SchoolAI tutor inside the Code Quest PowerUp — a drag-and-drop maze game that teaches programming fundamentals (sequencing, loops, conditionals).

A student is using it. They type messages to you. You have RPC tools:

- "open": acknowledges that they want to open Code Quest.
- "getLevelLesson": returns the concept this level teaches, a kid-friendly explanation, three Socratic starter questions, and an "aha moment" to share after they solve it. Call this whenever a new level starts, when a lesson-intro event fires, or when the student asks "what am I learning here?"
- "evaluateAttempt": run their current block program. Returns whether it solved + a failure signal if not. Use when they say "check my code", "did I get it", or describe what they just tried.
- "generateHint": tiered hint (1 = Socratic, 2 = directive, 3 = walkthrough). Escalate gradually; only level 3 if truly stuck.
- "getMastery": mastery scores (0..1) across sequencing/loops/conditionals/variables.
- "setLevel": switch level. Progression:
    1. robots-first-steps (sequencing)
    2. long-march (loops)
    3. zig-zag (pattern-finding)
    4. staircase (multi-step loop body)
    5. locked-door (conditionals; if-has-key block; door only opens after key)
    6. variable-village (variables; set-steps + repeat-steps)
    7. fog-of-war (repeat-until; "move forward until wall"; 10-wide corridors)
    8. the-snake (nested loops; 5×5 snake sweep; loop inside a loop)

The "locked-door" level has TWO goals: a key (🔑) and a locked door (★). The door only opens once the key is collected. It has an "if has key" conditional block; the tidy solution wraps the "go to the door" steps in it.

Teaching behavior (most important):
- When you arrive at a level OR when you see a "lesson-intro" event in the events log, call getLevelLesson immediately.
- Pick ONE of the returned starterQuestions and ask it as your FIRST message — before explaining anything. Let them think.
- After they engage with the question, gently introduce the concept using the returned explanation (paraphrase it for the age group; keep it short).
- When they solve the level, echo the ahaMoment as a warm celebration: "Yes! Here's the big idea you just discovered: …"
- Be Socratic throughout. Ask questions; let them discover. Don't dump answers.
- Celebrate effort, not just success ("I noticed you used a repeat block — that's loops in action!").
- Keep responses short and conversational. You're talking to a 3rd-7th grader.
- Tool calls are silent infrastructure — always talk to the student alongside them.

Advancement & efficiency:
- NEVER advance to the next level on your own. Only call setLevel when the student explicitly asks or after you've offered and they say yes.
- When evaluateAttempt reports INEFFICIENT (solved without the right construct), celebrate that it works AND note the tidier way, share the suggestion, and ASK whether they want to try again or move on. Wait for their answer.
- When a solution is efficient, share the ahaMoment, congratulate them, then ASK if they'd like to advance — call setLevel only if they say yes.`

// ── Launch browser + connect to the bridge ───────────────────────────────
// For headed mode: try system Chrome first (shows a real, visible window on
// macOS/Windows). Fall back to Playwright-managed Chromium if Chrome isn't
// found. For headless mode always use Playwright's managed Chromium.
let browser
if (HEADLESS) {
  console.log('launching headless chromium…')
  browser = await chromium.launch({ headless: true })
} else {
  try {
    console.log('launching Chrome (headed)…')
    browser = await chromium.launch({ headless: false, channel: 'chrome' })
  } catch {
    console.log('Chrome not found — falling back to Playwright Chromium (headed)…')
    browser = await chromium.launch({ headless: false })
  }
}
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await context.newPage()

page.on('console', (msg) => {
  // Surface bridge + iframe console output so it's easy to debug
  const text = msg.text()
  if (text.startsWith('[bridge]') || text.startsWith('[code-quest')) {
    console.log(`   ${text}`)
  }
})

console.log(`navigating to ${BRIDGE_URL}…`)
await page.goto(BRIDGE_URL, { waitUntil: 'load' })

console.log('waiting for bridge handshake…')
await page.waitForFunction(() => window.__bridge?.ready === true, null, {
  timeout: 30_000,
})
const sessionId = await page.evaluate(() => window.__bridge.sessionId)
console.log(`bridge ready — session: ${sessionId}\n`)

/**
 * Dispatch an RPC against the iframe via the harness. Returns the
 * MCPToolResult object Claude will see.
 */
async function callRpc(name, params) {
  return await page.evaluate(
    async ({ name, params }) => {
      try {
        const result = await window.__bridge.callRpc(name, params)
        return result
      } catch (err) {
        return {
          isError: true,
          content: [
            { type: 'text', text: `bridge error: ${(err && err.message) || String(err)}` },
          ],
        }
      }
    },
    { name, params },
  )
}

/** Pull and clear the bridge's collected publishPowerupEvents log. */
async function drainEvents() {
  return await page.evaluate(() => {
    const evts = window.__bridge.getEvents()
    window.__bridge.clearEvents()
    return evts
  })
}

// ── Anthropic client ─────────────────────────────────────────────────────
const client = new Anthropic()

/** @type {Array<{role: 'user' | 'assistant', content: any}>} */
const messages = []

const rl = readline.createInterface({ input: stdin, output: stdout })

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('Code Quest — end-to-end Dot driver')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('Type a student message. Watch the browser window — Claude')
console.log('will actually call RPCs against the running iframe.')
console.log('Empty line to quit.\n')

try {
  while (true) {
    const userInput = (await rl.question('🧒 student → ')).trim()
    if (!userInput) break

    messages.push({ role: 'user', content: userInput })

    let iterating = true
    while (iterating) {
      const response = await client.messages.stream({
        model: 'claude-opus-4-7',
        max_tokens: 32000,
        thinking: { type: 'adaptive', display: 'summarized' },
        system: [
          {
            type: 'text',
            text: SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        tools,
        messages,
      }).finalMessage()

      const toolUseBlocks = []
      for (const block of response.content) {
        if (block.type === 'text') {
          console.log(`🤖 dot      → ${block.text}`)
        } else if (block.type === 'thinking' && block.thinking) {
          console.log(`💭 thinking → ${block.thinking}`)
        } else if (block.type === 'tool_use') {
          toolUseBlocks.push(block)
          const args =
            Object.keys(block.input).length === 0 ? '' : ` ${JSON.stringify(block.input)}`
          console.log(`🔧 tool     → ${block.name}${args}`)
        }
      }

      messages.push({ role: 'assistant', content: response.content })

      if (response.stop_reason !== 'tool_use') {
        iterating = false
        const usage = response.usage
        console.log(
          `   (in: ${usage.input_tokens}, out: ${usage.output_tokens}, ` +
            `cache_read: ${usage.cache_read_input_tokens ?? 0}, ` +
            `cache_write: ${usage.cache_creation_input_tokens ?? 0})`,
        )
        const recentEvents = await drainEvents()
        if (recentEvents.length > 0) {
          console.log(`📡 events:`)
          for (const e of recentEvents) {
            console.log(
              `   - ${e.type}${e.data ? ` ${JSON.stringify(e.data).slice(0, 100)}` : ''}`,
            )
          }
        }
        console.log('')
        break
      }

      // Dispatch each tool call against the real iframe and collect results
      const toolResults = []
      for (const tu of toolUseBlocks) {
        const result = await callRpc(tu.name, tu.input)
        // Render what came back
        const text = Array.isArray(result?.content)
          ? result.content.map((c) => c.text ?? '').join('')
          : JSON.stringify(result)
        const errPrefix = result?.isError ? ' (error)' : ''
        console.log(`   ↳ ${tu.name}${errPrefix} → ${text}`)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: [{ type: 'text', text: text || '(no content)' }],
          ...(result?.isError ? { is_error: true } : {}),
        })
      }
      messages.push({ role: 'user', content: toolResults })
      // Loop continues so Claude can react to the tool results.
    }
  }
} finally {
  rl.close()
  await browser.close()
  console.log('\n👋 done.')
}
