import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react'
import * as Blockly from 'blockly/core'
import 'blockly/blocks'
import 'blockly/javascript'
import { defineMazeBlocks, MAZE_TOOLBOX } from './maze-blocks'
import { defineMazePythonGenerators } from './maze-python-generator'
import { defineMazeJsGenerators } from './maze-js-generator'

// Initialise in this specific order: Python generators first, then JS display
// generators, then DSL generators LAST so they win on the shared
// `javascriptGenerator` instance that `compileWorkspace` uses for execution.
defineMazePythonGenerators()
defineMazeJsGenerators()
defineMazeBlocks()

export interface BlocklyWorkspaceHandle {
  /** Highlight a block by ID. Pass empty string to clear. */
  highlightBlock: (id: string) => void
  /** Load a serialized workspace state (from astToBlocklyState) into the workspace. */
  loadState: (state: object) => void
}

interface Props {
  onChange?: (workspace: Blockly.WorkspaceSvg, xml: string) => void
  initialXml?: string
  /** Block palette for this level. Defaults to the move/turn/repeat set. */
  toolbox?: unknown
  /**
   * When set, the matching block type in the toolbox flyout will pulse with
   * an orange glow to guide a stuck student toward the right block.
   * Pass `null` (or leave undefined) to clear all flashing.
   */
  flashBlockType?: string | null
}

const FLASH_CLASS = 'hint-block-flash'

/** Apply/remove the flash class on the flyout block matching `type`. */
function applyFlyoutFlash(ws: Blockly.WorkspaceSvg, type: string | null | undefined) {
  const flyout = ws.getFlyout()
  const flyoutWs = flyout?.getWorkspace()
  if (!flyoutWs) return
  for (const b of flyoutWs.getAllBlocks(false)) {
    (b as Blockly.BlockSvg).getSvgRoot()?.classList.remove(FLASH_CLASS)
  }
  if (type) {
    for (const b of flyoutWs.getBlocksByType(type, false)) {
      (b as Blockly.BlockSvg).getSvgRoot()?.classList.add(FLASH_CLASS)
    }
  }
}

/**
 * Parse a categoryToolbox definition into an array of per-tab flyout toolboxes.
 * Falls back to treating the toolbox itself as a single un-labelled tab.
 */
type Tab = { label: string; flyout: Blockly.utils.toolbox.ToolboxDefinition }

function parseTabs(toolbox: unknown): Tab[] {
  // flyoutToolbox: single flat list — no tabs needed.
  return [{ label: '', flyout: toolbox as Blockly.utils.toolbox.ToolboxDefinition }]
}

// ── Internal Blockly flyout shape (not exposed in public types) ──────────────
type InternalFlyout = {
  width_: number
  reflowInternal_(): void
  position(): void
}

/**
 * After Blockly renders, switch through all tabs one frame each to find the
 * widest flyout, then patch `reflowInternal_` so the flyout width (and therefore
 * the main-workspace left offset) never shrinks when switching to a narrower tab.
 */
async function lockFlyoutWidth(
  ws: Blockly.WorkspaceSvg,
  tabs: Tab[],
  signal: { cancelled: boolean },
) {
  if (tabs.length <= 1) return
  const flyout = ws.getFlyout() as unknown as InternalFlyout | null
  if (!flyout) return

  const raf = () => new Promise<void>(r => requestAnimationFrame(() => r()))

  // Measure each tab (one animation frame each so Blockly has time to lay out).
  let maxW = 0
  for (const tab of tabs) {
    if (signal.cancelled) return
    ws.updateToolbox(tab.flyout)
    await raf()
    maxW = Math.max(maxW, flyout.width_)
  }

  // Restore first tab.
  if (signal.cancelled) return
  ws.updateToolbox(tabs[0].flyout)
  await raf()

  if (signal.cancelled) return

  // Patch reflowInternal_ so future tab switches never produce a narrower flyout.
  const orig = flyout.reflowInternal_.bind(flyout)
  flyout.reflowInternal_ = function () {
    orig()
    if (flyout.width_ < maxW) {
      flyout.width_ = maxW
      flyout.position()
    }
  }
  // Apply immediately in case the first tab is already narrower than the max.
  if (flyout.width_ < maxW) {
    flyout.width_ = maxW
    flyout.position()
  }
}

export const BlocklyWorkspace = forwardRef<BlocklyWorkspaceHandle, Props>(function BlocklyWorkspace(
  { onChange, initialXml, toolbox, flashBlockType }: Props,
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const wsRef   = useRef<Blockly.WorkspaceSvg | null>(null)

  useImperativeHandle(ref, () => ({
    highlightBlock: (id: string) => {
      const ws = wsRef.current
      if (!ws) return
      // Clear all highlight first
      ws.getAllBlocks(false).forEach((b) => {
        ;(b as Blockly.BlockSvg).setHighlighted(false)
      })
      if (id) {
        const block = ws.getBlockById(id)
        if (block) (block as Blockly.BlockSvg).setHighlighted(true)
      }
    },
    loadState: (state: object) => {
      const ws = wsRef.current
      if (!ws) return
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Blockly.serialization.workspaces.load(state as any, ws)
      } catch (e) {
        console.warn('[BlocklyWorkspace] loadState failed:', e)
      }
    },
  }))

  const [activeTab, setActiveTab] = useState(0)
  const activeTabRef = useRef(0)

  // Keep a stable ref so effects always read the latest tab list.
  const tabsRef = useRef(parseTabs(toolbox ?? MAZE_TOOLBOX))
  tabsRef.current = parseTabs(toolbox ?? MAZE_TOOLBOX)

  // ── Initial mount ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!hostRef.current) return

    const ws = Blockly.inject(hostRef.current, {
      toolbox: tabsRef.current[0].flyout,
      trashcan: true,
      scrollbars: true,
      grid: { spacing: 20, length: 3, colour: '#dbe2ee', snap: true },
      zoom: { controls: true, wheel: true, startScale: 0.95, maxScale: 1.5, minScale: 0.6 },
    })
    wsRef.current = ws

    if (initialXml) {
      try {
        const dom = Blockly.utils.xml.textToDom(initialXml)
        Blockly.Xml.domToWorkspace(dom, ws)
      } catch { /* ignore corrupt cached XML */ }
    }

    const listener = () => {
      if (!onChange) return
      const xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws))
      onChange(ws, xml)
    }
    ws.addChangeListener(listener)

    const resize = () => Blockly.svgResize(ws)
    const ro = new ResizeObserver(resize)
    ro.observe(hostRef.current)
    requestAnimationFrame(resize)
    if (document.fonts?.ready) void document.fonts.ready.then(resize)
    window.addEventListener('resize', resize)

    // Pre-measure all tabs then lock the flyout at the widest width.
    // A small initial delay lets the first tab finish rendering.
    const signal = { cancelled: false }
    const t = setTimeout(() => void lockFlyoutWidth(ws, tabsRef.current, signal), 120)

    return () => {
      signal.cancelled = true
      clearTimeout(t)
      window.removeEventListener('resize', resize)
      ro.disconnect()
      ws.dispose()
      wsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Tab switch: swap flyout contents ────────────────────────────────────
  useEffect(() => {
    activeTabRef.current = activeTab
    const ws = wsRef.current
    if (!ws) return
    const tab = tabsRef.current[activeTab]
    if (tab) ws.updateToolbox(tab.flyout)
  }, [activeTab])

  // ── Hint flash: ensure "This Level" tab is active first ─────────────────
  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return
    const run = () => {
      if (flashBlockType && activeTabRef.current !== 0) {
        setActiveTab(0)
        window.setTimeout(() => applyFlyoutFlash(ws, flashBlockType), 80)
      } else {
        applyFlyoutFlash(ws, flashBlockType)
      }
    }
    const t = window.setTimeout(run, 80)
    return () => window.clearTimeout(t)
  }, [flashBlockType])

  const tabs = tabsRef.current

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      {tabs.length > 1 && (
        <div className="ws-tabs">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              className={`ws-tab${activeTab === i ? ' ws-tab--active' : ''}`}
              onClick={() => setActiveTab(i)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      <div ref={hostRef} style={{ flex: 1, minHeight: 0 }} />
    </div>
  )
})
