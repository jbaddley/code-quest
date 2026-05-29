import type { OutputLevel } from '../types'

interface Props {
  level: OutputLevel
  actual: string[]
  status: 'idle' | 'running' | 'win' | 'fail'
  error?: string
}

/**
 * Dark-terminal output panel shown instead of MazeCanvas for OutputLevel
 * challenges.  Displays:
 *  - Idle:    "Press Run to see output"
 *  - Running: "Running…" with a spinner
 *  - After run: each captured line with a ✓ (match) or ✗ (mismatch)
 *  - Error:   the error message in red
 *  - Always:  the expected output at the bottom so students know the target
 */
export function OutputDisplay({ level, actual, status, error }: Props) {
  const expected = level.expectedOutput

  return (
    <div className="output-display">
      {/* ── Output area ── */}
      <div className="output-terminal">
        <div className="output-terminal-header">
          <span className="output-terminal-dot" style={{ background: '#ff5f57' }} />
          <span className="output-terminal-dot" style={{ background: '#ffbd2e' }} />
          <span className="output-terminal-dot" style={{ background: '#28c840' }} />
          <span className="output-terminal-title">Output</span>
        </div>

        <div className="output-terminal-body">
          {status === 'idle' && (
            <span className="output-placeholder">Press Run to see output</span>
          )}
          {status === 'running' && (
            <span className="output-placeholder output-running">Running…</span>
          )}
          {(status === 'win' || status === 'fail') && (
            <>
              {error ? (
                <div className="output-error">{error}</div>
              ) : actual.length === 0 ? (
                <span className="output-placeholder">No output produced</span>
              ) : (
                actual.map((line, i) => {
                  const matched = expected[i] !== undefined && line.trim() === expected[i].trim()
                  return (
                    <div
                      key={i}
                      className={`output-line ${matched ? 'output-line--pass' : 'output-line--fail'}`}
                    >
                      <span className="output-line-text">{line || <em>(empty line)</em>}</span>
                      <span className="output-line-badge">
                        {matched ? '✓' : (
                          <span title={`Expected: "${expected[i] ?? '(nothing)'}"`}>✗</span>
                        )}
                      </span>
                    </div>
                  )
                })
              )}
              {/* Extra expected lines that weren't printed */}
              {!error && actual.length < expected.length && (
                expected.slice(actual.length).map((exp, j) => (
                  <div key={`missing-${j}`} className="output-line output-line--missing">
                    <span className="output-line-text output-line-missing-text">
                      (missing: "{exp}")
                    </span>
                    <span className="output-line-badge">✗</span>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Expected output ── */}
      <div className="output-expected">
        <div className="output-expected-label">Expected output:</div>
        {expected.map((line, i) => (
          <div key={i} className="output-expected-line">
            <span className="output-expected-num">{i + 1}</span>
            <span className="output-expected-text">{line || <em>(empty line)</em>}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
