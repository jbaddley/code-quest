/**
 * CodeMirror 6 editor wrapper for Code Quest Stage 3.
 *
 * Controlled component: `value` drives the editor content.
 * Recreates the editor instance when `language`, `readOnly`, or
 * `showSyntaxHints` changes so extensions are always consistent.
 *
 * Programmatic value updates (from cross-language compilation) suppress the
 * onChange callback to avoid infinite update loops.
 *
 * When `showSyntaxHints` is true a read-only decoration is added at the end of
 * each recognised line — styled as a grey inline comment.  The decorations are
 * purely visual: they do NOT appear in the document content and are never
 * included in the code that runs.
 */
import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { ViewPlugin, Decoration, WidgetType, keymap } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'
import { getLineHint } from './syntax-hints'

interface Props {
  value: string
  onChange?: (value: string) => void
  language?: 'python' | 'javascript' | 'typescript'
  /** When true the editor is displayed but not editable (Stage 2 read-only mode). */
  readOnly?: boolean
  /**
   * When true, a short plain-English explanation is rendered as a read-only
   * ghost comment at the end of each recognised line.  Toggle with the
   * "💬 Hints" button in the UI; defaults to false.
   */
  showSyntaxHints?: boolean
}

// ── Syntax-hint decoration ────────────────────────────────────────────────────

class HintWidget extends WidgetType {
  constructor(readonly text: string) { super() }
  eq(other: HintWidget) { return this.text === other.text }
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-syntax-hint'
    span.setAttribute('aria-hidden', 'true')
    span.textContent = this.text
    return span
  }
  ignoreEvent() { return true }
}

function buildHintDecorations(
  view: EditorView,
  language: 'python' | 'javascript' | 'typescript',
): DecorationSet {
  const commentPfx = language === 'python' ? '  # ' : '  // '
  // Use unknown[] to avoid importing @codemirror/state's Range type directly;
  // the actual values are Range<Decoration> as required by Decoration.set().
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const widgets: any[] = []
  const doc = view.state.doc

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const hint = getLineHint(line.text.trim(), language)
    if (hint) {
      widgets.push(
        Decoration.widget({
          widget: new HintWidget(`${commentPfx}${hint}`),
          side: 1, // attach after the line end
        }).range(line.to),
      )
    }
  }

  return Decoration.set(widgets)
}

function makeSyntaxHintsPlugin(language: 'python' | 'javascript' | 'typescript') {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(view: EditorView) {
        this.decorations = buildHintDecorations(view, language)
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildHintDecorations(update.view, language)
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CodeEditor({
  value,
  onChange,
  language = 'python',
  readOnly = false,
  showSyntaxHints = false,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const viewRef       = useRef<EditorView | null>(null)
  // Use a ref for the callback so the effect closure never goes stale.
  const onChangeRef   = useRef(onChange)
  onChangeRef.current = onChange
  // Suppress onChange when we programmatically update the editor value
  // (e.g. from cross-language compilation) to avoid infinite update loops.
  const suppressOnChange = useRef(false)

  // ── Create / recreate editor when language, readOnly, or hints toggle ─────
  useEffect(() => {
    if (!containerRef.current) return

    // Dispose previous instance
    viewRef.current?.destroy()

    const langExt =
      language === 'python'
        ? python()
        : javascript({ typescript: language === 'typescript' })

    const extensions = [
      basicSetup,
      langExt,
      oneDark,
      // Tab inserts indentation; Shift-Tab removes it.
      keymap.of([indentWithTab]),
      EditorView.editable.of(!readOnly),
      EditorView.theme({
        '&': { fontSize: '13px', fontFamily: "'Fira Code','Cascadia Code','JetBrains Mono','Menlo',monospace" },
        '.cm-scroller': { lineHeight: '1.65' },
      }),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && !readOnly && !suppressOnChange.current) {
          onChangeRef.current?.(update.state.doc.toString())
        }
      }),
    ]

    if (showSyntaxHints) {
      extensions.push(makeSyntaxHintsPlugin(language))
    }

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions,
      }),
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Re-create when language, readOnly, or hint visibility changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly, showSyntaxHints])

  // ── Sync external value changes into the live editor ─────────────────────
  // (Only runs when `value` changes while the editor already exists,
  //  i.e. programmatic updates like "populate from blocks" or cross-compile.)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      // CodeMirror dispatches are synchronous — the updateListener fires
      // inline, so setting this flag before dispatch prevents it from calling
      // onChange with the programmatically-injected value.
      suppressOnChange.current = true
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
      suppressOnChange.current = false
    }
  }, [value])

  return <div ref={containerRef} className="code-editor-host" />
}
