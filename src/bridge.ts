/**
 * Bridge — a minimal in-browser host that lets an outside orchestrator
 * (Playwright + the drive-dot.mjs script) drive the Code Quest iframe
 * through the real `@schoolai/powerup-sdk` harness protocol.
 *
 * Why this exists: the sandbox UI is a manual RPC tester, and the
 * simulate-dot script is "what would Dot do" without actually closing
 * the loop. This page is the missing third option — a programmatically-
 * driveable host that uses the same handshake + postMessage protocol
 * the production SchoolAI app uses, so the iframe runs unchanged.
 *
 * Loaded by `bridge.html`. Exposes `window.__bridge` for Playwright.
 */

import { PowerupHarness } from '@schoolai/powerup-sdk'
import type { JSONValue, State } from '@schoolai/powerup-sdk'
import type { ThemeConfig } from './types'

declare global {
  interface Window {
    __bridge: {
      ready: boolean
      callRpc: (name: string, params?: unknown) => Promise<unknown>
      getEvents: () => Array<BridgeEvent>
      clearEvents: () => void
      getState: () => unknown
      sessionId: string
    }
  }
}

interface BridgeEvent {
  at: string
  type: string
  data: unknown
}

const iframe = document.querySelector<HTMLIFrameElement>('#powerup-iframe')
if (!iframe) throw new Error('bridge: iframe#powerup-iframe not found')

// In-memory state replaces what the AI Platform would persist server-side.
const stateVersions: State[] = []
let currentVersion = 0
const events: BridgeEvent[] = []

// Read ?theme=<preset> from this page's URL so that opening
// bridge.html?theme=space activates the space preset in the PowerUp.
const themeParam = new URLSearchParams(window.location.search).get('theme')
const bridgeThemeConfig: ThemeConfig | undefined = themeParam
  ? { preset: themeParam as ThemeConfig['preset'] }
  : undefined

const sessionId = `bridge-${Date.now()}`
const slug = 'code-quest'

const ARTIFACT_ID = `artifact-${Date.now()}`

function snapshot(data: JSONValue): State {
  currentVersion += 1
  return {
    stateId: ARTIFACT_ID,
    versionNumber: currentVersion,
    data,
  }
}

// Seed an initial empty state so getState() never returns undefined.
stateVersions.push(snapshot(null))

const rpcHandlers = {
  hide: async () => undefined,
  setIsMaximized: async () => undefined,
  navigateTo: async () => undefined,
  getUserAuthToken: async () => 'bridge-mock-token',
  getState: async (): Promise<State> => stateVersions[stateVersions.length - 1],
  updateState: async ({ data }: { data: JSONValue }): Promise<State> => {
    // In production the latest state is mutated in place; here we treat
    // updateState as overwriting the head version.
    const next = snapshot(data)
    stateVersions[stateVersions.length - 1] = next
    return next
  },
  createStateVersion: async ({ data }: { data: JSONValue }): Promise<State> => {
    const next = snapshot(data)
    stateVersions.push(next)
    return next
  },
  listStateVersions: async (): Promise<State[]> => stateVersions.slice(),
  getParentOrigin: async () => window.location.origin,
  getChatContext: async () => ({
    chatId: 'bridge-chat',
    collectionId: 'bridge-collection',
    attachments: { files: [], standards: [] },
    spaceCreationType: 'manual',
    spaceType: 'student-learning',
    // Forward ?theme= from bridge.html's URL into the PowerUp's ChatContext.
    ...(bridgeThemeConfig ? { themeConfig: bridgeThemeConfig } : {}),
  }),
  publishPowerupEvents: async ({
    data,
  }: {
    data: { id: string; eventType: string; eventData: unknown }
  }) => {
    events.push({
      at: new Date().toISOString(),
      type: data.eventType,
      data: data.eventData,
    })
  },
  getGoogleAccessTokenWithScopes: async () => null,
}

// Wait for the iframe to load before initializing the harness. The harness
// sends SYN to iframe.contentWindow as soon as init() is called; if the iframe
// hasn't loaded yet, the Client isn't listening and the handshake fails.
function whenIframeLoaded(): Promise<void> {
  if (iframe!.contentDocument?.readyState === 'complete') return Promise.resolve()
  return new Promise((resolve) => {
    iframe!.addEventListener('load', () => resolve(), { once: true })
  })
}

const status = document.querySelector<HTMLDivElement>('#bridge-status')
function setStatus(text: string) {
  if (status) status.textContent = text
  // eslint-disable-next-line no-console
  console.log('[bridge]', text)
}

async function start() {
  setStatus('waiting for iframe…')
  await whenIframeLoaded()

  setStatus('starting handshake…')
  const harness = new PowerupHarness({
    targetWindow: iframe!.contentWindow!,
    targetOrigin: window.location.origin,
    rpcHandlers,
    debug: false,
  })

  // `init` performs the SYN/ACK + calls the iframe's `onInitialize`. By the
  // time it resolves, the iframe is ready to receive `routeRPCCall` invocations.
  await harness.init({
    iframeContentWindow: iframe!.contentWindow!,
    iframeSrc: iframe!.src,
    sessionId,
    slug,
  })

  setStatus(`connected — session ${sessionId}`)

  window.__bridge = {
    ready: true,
    sessionId,
    async callRpc(name, params = {}) {
      // sessionId/slug come from the harness constructor — they are not part
      // of routeRPCCall's args. We keep them on the harness instance above.
      return await harness.routeRPCCall({
        functionName: name,
        params: params as Record<string, unknown>,
        // The game's evaluateAttempt animates the robot ~220ms per step; on
        // a long maze that can take a few seconds. Generous default keeps
        // Playwright happy.
        responseTimeoutMillis: 60_000,
      })
    },
    getEvents() {
      return events.slice()
    },
    clearEvents() {
      events.length = 0
    },
    getState() {
      return stateVersions[stateVersions.length - 1]?.data ?? null
    },
  }

  // Belt-and-suspenders for tests that poll for readiness rather than awaiting it.
  document.title = `Code Quest Bridge — ready · ${ARTIFACT_ID}`
}

void start().catch((err) => {
  setStatus(`handshake failed: ${(err as Error).message}`)
  // eslint-disable-next-line no-console
  console.error('[bridge] init failed', err)
})
