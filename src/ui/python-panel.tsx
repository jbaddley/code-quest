/**
 * Stage 2 — "See the Code" panel.
 *
 * Displays a read-only, syntax-highlighted view of whatever blocks are in
 * the workspace, in either Python or JavaScript (student can toggle; teacher
 * can set the default via ThemeConfig.codeLanguage).
 *
 * Updates live as the student drags blocks.
 */
import { useMemo, useState } from 'react'
import { highlightPython } from './python-highlight'
import { highlightJavaScript } from './js-highlight'

type Language = 'python' | 'javascript'

interface Props {
  pythonCode: string
  jsCode: string
  /** Which tab is shown first. Defaults to 'python'. */
  defaultLanguage?: Language
}

export function PythonPanel({ pythonCode, jsCode, defaultLanguage = 'python' }: Props) {
  const [lang, setLang] = useState<Language>(defaultLanguage)

  const code = lang === 'python' ? pythonCode : jsCode
  const html  = useMemo(
    () => lang === 'python' ? highlightPython(pythonCode) : highlightJavaScript(jsCode),
    [lang, pythonCode, jsCode],
  )

  const empty = !code.trim()

  return (
    <div className="python-panel">
      <div className="python-panel-header">
        {/* Language tabs */}
        <div className="code-lang-tabs">
          <button
            className={`code-lang-tab${lang === 'python' ? ' active' : ''}`}
            onClick={() => setLang('python')}
          >
            🐍 Python
          </button>
          <button
            className={`code-lang-tab${lang === 'javascript' ? ' active' : ''}`}
            onClick={() => setLang('javascript')}
          >
            🟨 JavaScript
          </button>
        </div>
        <span className="python-panel-note">This is what your blocks look like as real code</span>
      </div>
      {empty ? (
        <div className="python-panel-empty">
          Add some blocks to see the {lang === 'python' ? 'Python' : 'JavaScript'} code here…
        </div>
      ) : (
        <pre
          className="python-panel-code"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  )
}
