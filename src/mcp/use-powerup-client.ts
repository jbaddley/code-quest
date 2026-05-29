import { useEffect, useRef, useState } from 'react'
import { Client } from '@schoolai/powerup-sdk'
import type { JSONValue } from '@schoolai/powerup-sdk'
import type { CodeQuestEventType, CodeQuestState, Mastery, ThemeConfig } from '../types'

/**
 * Map of RPC name → handler. The PowerUp SDK calls these when Dot invokes a
 * tool against the iframe. Each handler returns an `MCPToolResult`:
 *
 *     { isError: false, content: [{ type: 'text', text: '…' }] }
 *
 * Keep the names in sync with `manifest.json`'s `powerupMCPSpecification.tools`.
 */
export interface RpcHandlers {
  open: (args: Record<string, unknown>) => Promise<MCPToolResult>
  evaluateAttempt: (args: Record<string, unknown>) => Promise<MCPToolResult>
  generateHint: (args: { level?: 1 | 2 | 3 } & Record<string, unknown>) => Promise<MCPToolResult>
  getMastery: (args: Record<string, unknown>) => Promise<MCPToolResult>
  setLevel: (args: { levelId?: string } & Record<string, unknown>) => Promise<MCPToolResult>
  getLevelLesson: (args: Record<string, unknown>) => Promise<MCPToolResult>
  buildLevel: (args: Record<string, unknown>) => Promise<MCPToolResult>
}

export interface MCPToolResult {
  isError: boolean
  content: Array<{ type: 'text'; text: string }>
}

/** Detect whether we're running embedded inside a host iframe. */
const isEmbedded = (): boolean => {
  try {
    return window.parent !== window
  } catch {
    return true
  }
}

export interface PowerUpClientState {
  /** Connected `Client` instance, or null in standalone mode. */
  client: Client | null
  /** True after `onInitialize` resolves (handshake completed). */
  isConnected: boolean
  /** True when not embedded in any host. */
  isStandalone: boolean
  /** Last error from `client.init()`, if any. */
  error: Error | null
}

interface UseClientOptions {
  /** Read at every RPC dispatch — keep handlers up to date with React state. */
  getHandlers: () => RpcHandlers
  /** Called when the harness pushes a fresh chat context. */
  onContextReady?: (ctx: ChatContext) => void
  /** Called once on initialize, after we've called getState() — gives caller
   *  a chance to hydrate UI from persisted artifact state. */
  onHydrate?: (data: CodeQuestState | null) => void
}

/**
 * Mirrors `Client.getChatContext()`'s return type — kept loose because the
 * shape varies between SDK versions. `teacherRole` etc. show up in newer
 * builds; we treat them as optional.
 */
export interface ChatContext {
  chatId: string | null
  collectionId: string | null
  attachments?: { files: unknown[]; standards: unknown[] }
  spaceCreationType?: string
  userId?: string | null
  organizationIds?: string[]
  teacherRole?: string
  anonymousId?: string
  spaceType?: string
  /**
   * Teacher-supplied theme configuration. Set in the SchoolAI activity panel
   * and forwarded here through the bridge handshake payload so the PowerUp
   * can apply branded colours, emoji, and label overrides automatically.
   */
  themeConfig?: ThemeConfig
}

export function usePowerUpClient(opts: UseClientOptions): PowerUpClientState & {
  /** Persist state to the artifact (host-managed). Falls back to localStorage in standalone. */
  saveState: (data: CodeQuestState) => Promise<void>
  /** Publish an event to Dot. Falls back to console.debug in standalone. */
  publishEvent: (type: CodeQuestEventType, data?: Record<string, unknown>) => void
} {
  const standalone = !isEmbedded()
  const clientRef = useRef<Client | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Hold refs to the latest callbacks so the Client's RPC handlers (registered
  // once at mount) always read fresh React state.
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(() => {
    // Standalone: skip the handshake. We use localStorage in saveState/getState below.
    if (standalone) {
      // Hydrate from localStorage in standalone mode so the prototype is usable
      // when opened directly in a browser.
      try {
        const raw = localStorage.getItem('code-quest:state')
        optsRef.current.onHydrate?.(raw ? (JSON.parse(raw) as CodeQuestState) : null)
      } catch {
        optsRef.current.onHydrate?.(null)
      }
      return
    }

    const client = new Client({
      debug: false,
      rpcHandlers: {
        // The PowerUp SDK strongly types args as `Record<string, unknown>` — we
        // narrow inside each handler. Names MUST match manifest.json.
        open: (args) => optsRef.current.getHandlers().open(args),
        evaluateAttempt: (args) => optsRef.current.getHandlers().evaluateAttempt(args),
        generateHint: (args) =>
          optsRef.current.getHandlers().generateHint(args as { level?: 1 | 2 | 3 }),
        getMastery: (args) => optsRef.current.getHandlers().getMastery(args),
        setLevel: (args) =>
          optsRef.current.getHandlers().setLevel(args as { levelId?: string }),
        getLevelLesson: (args) => optsRef.current.getHandlers().getLevelLesson(args),
        buildLevel: (args) => optsRef.current.getHandlers().buildLevel(args),
      },
      hooks: {
        onInitialize: async (c) => {
          // SDK only routes other RPCs after this resolves, so do hydration here.
          try {
            const raw = await c.getState()
            const data = (raw?.data ?? null) as CodeQuestState | null
            optsRef.current.onHydrate?.(data)

            const ctx = await c.getChatContext()
            optsRef.current.onContextReady?.(ctx as unknown as ChatContext)
          } catch (err) {
            // Hydration failure shouldn't kill the session; log and continue.
            // eslint-disable-next-line no-console
            console.error('[code-quest] onInitialize hydration failed:', err)
          }
        },
      },
    })

    clientRef.current = client

    client
      .init()
      .then(() => setIsConnected(true))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err : new Error(String(err)))
      })

    return () => {
      // PowerUp SDK doesn't expose a public destroy; the page going away
      // unmounts the iframe and the harness cleans up.
      clientRef.current = null
    }
  }, [standalone])

  const saveState = async (data: CodeQuestState): Promise<void> => {
    if (standalone || !clientRef.current || !isConnected) {
      try {
        localStorage.setItem('code-quest:state', JSON.stringify(data))
      } catch {
        /* quota or private-mode — non-fatal */
      }
      return
    }
    // CodeQuestState's typed fields don't structurally satisfy JSONObject's
    // index signature, but it IS JSON-serializable at runtime.
    await clientRef.current.updateState({ data: data as unknown as JSONValue })
  }

  const publishEvent = (
    type: CodeQuestEventType,
    data?: Record<string, unknown>,
  ) => {
    // eslint-disable-next-line no-console
    console.debug('[code-quest event]', type, data)
    if (standalone || !clientRef.current || !isConnected) return
    // SDK's publishEvent expects specific event-type strings; our typed event
    // names are a superset. The SDK batch-queues + sends them to the harness.
    void clientRef.current
      // The SDK uses strongly-typed PowerUpEventType strings; CodeQuestEventType
      // is our internal taxonomy. Cast since the harness accepts any string and
      // it's only used for telemetry / Dot to read.
      .publishEvent(type as never, (data ?? {}) as never)
      .catch(() => undefined)
  }

  return {
    client: clientRef.current,
    isConnected: standalone ? false : isConnected,
    isStandalone: standalone,
    error,
    saveState,
    publishEvent,
  }
}

/** Pre-canned successful tool result with a single text content block. */
export const ok = (text: string, extra?: Record<string, unknown>): MCPToolResult => ({
  isError: false,
  content: [{ type: 'text', text }],
  ...(extra ?? {}),
})

/** Pre-canned failed tool result with a single text content block. */
export const fail = (text: string): MCPToolResult => ({
  isError: true,
  content: [{ type: 'text', text }],
})

/** Used by Mastery snapshots emitted to chat. */
export const formatMastery = (mastery: Mastery): string =>
  [
    `sequencing: ${pct(mastery.sequencing)}`,
    `loops: ${pct(mastery.loops)}`,
    `conditionals: ${pct(mastery.conditionals)}`,
    `variables: ${pct(mastery.variables)}`,
    `repeatUntil: ${pct(mastery.repeatUntil)}`,
  ].join(', ')

const pct = (n: number) => `${Math.round(n * 100)}%`
