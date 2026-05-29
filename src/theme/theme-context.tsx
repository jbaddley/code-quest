/**
 * Theme context for Code Quest.
 *
 * `ThemeProvider` resolves a `ThemeConfig` (preset + overrides) into a single
 * flat `ResolvedTheme` and:
 *   1. Writes the colour values as CSS custom properties on <html> so every
 *      component picks them up through CSS variables.
 *   2. Makes the resolved theme available via `useTheme()` for JS-level access
 *      (panel headers, button labels, canvas colours, etc.).
 */

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import type { ThemeColors, ThemeConfig, ThemeGame, ThemeLabels } from '../types'
import { PRESETS } from './presets'

// ── Resolved theme ────────────────────────────────────────────────────────────

export interface ResolvedTheme {
  colors: ThemeColors
  game: Required<ThemeGame>
  labels: ThemeLabels
}

export function resolveTheme(config: ThemeConfig | null | undefined): ResolvedTheme {
  const base = PRESETS[config?.preset ?? 'default']

  return {
    colors: { ...base.colors, ...(config?.colors ?? {}) },
    game:   { ...base.game,   ...(config?.game   ?? {}) } as Required<ThemeGame>,
    labels: {
      ...base.labels,
      ...(config?.labels ?? {}),
      // Merge nested conceptLabels instead of replacing the whole object.
      conceptLabels: {
        ...base.labels.conceptLabels,
        ...(config?.labels?.conceptLabels ?? {}),
      },
      // Same for failMessages.
      failMessages: {
        ...base.labels.failMessages,
        ...(config?.labels?.failMessages ?? {}),
      },
    },
  }
}

// ── CSS variable sync ─────────────────────────────────────────────────────────

const COLOR_VAR_MAP: Record<keyof ThemeColors, string> = {
  primary:     '--color-primary',
  primaryText: '--color-primary-text',
  header:      '--color-header',
  headerText:  '--color-header-text',
  stageBg:     '--color-stage-bg',
  winBg:       '--color-win-bg',
  winText:     '--color-win-text',
  failBg:      '--color-fail-bg',
  failText:    '--color-fail-text',
}

function applyCssVars(colors: ThemeColors) {
  const root = document.documentElement
  for (const [key, cssVar] of Object.entries(COLOR_VAR_MAP) as [keyof ThemeColors, string][]) {
    root.style.setProperty(cssVar, colors[key])
  }
}

// ── Context ───────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ResolvedTheme>(resolveTheme(null))

interface ThemeProviderProps {
  config?: ThemeConfig | null
  children: ReactNode
}

export function ThemeProvider({ config, children }: ThemeProviderProps) {
  const resolved = useMemo(() => resolveTheme(config), [config])

  // Sync CSS custom properties whenever the resolved colours change.
  useEffect(() => {
    applyCssVars(resolved.colors)
  }, [resolved.colors])

  return (
    <ThemeContext.Provider value={resolved}>
      {children}
    </ThemeContext.Provider>
  )
}

/** Access the fully-resolved theme from any component inside <ThemeProvider>. */
export function useTheme(): ResolvedTheme {
  return useContext(ThemeContext)
}
