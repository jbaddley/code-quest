export interface ModuleValidationResult {
  valid: boolean
  errors: string[]
}

export function validateModule(raw: unknown): ModuleValidationResult {
  const errors: string[] = []

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, errors: ['Module must be a non-null object'] }
  }

  const m = raw as Record<string, unknown>

  if (m.schemaVersion !== 1) errors.push('schemaVersion must be 1')

  if (typeof m.id !== 'string' || !m.id) {
    errors.push('id is required')
  } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.id)) {
    errors.push('id must be kebab-case (lowercase letters, numbers, hyphens)')
  }

  if (typeof m.title !== 'string' || !m.title) errors.push('title is required')
  if (typeof m.description !== 'string' || !m.description) errors.push('description is required')
  if (typeof m.author !== 'string' || !m.author) errors.push('author is required')
  if (typeof m.createdAt !== 'string') errors.push('createdAt is required')
  if (typeof m.updatedAt !== 'string') errors.push('updatedAt is required')

  if (!Array.isArray(m.gradeBand) || m.gradeBand.length !== 2) {
    errors.push('gradeBand must be a [minGrade, maxGrade] two-element array')
  } else {
    const [min, max] = m.gradeBand as unknown[]
    if (typeof min !== 'number' || typeof max !== 'number') {
      errors.push('gradeBand values must be numbers')
    } else if (min > max) {
      errors.push('gradeBand[0] must be <= gradeBand[1]')
    } else if (min < 0 || max > 12) {
      errors.push('gradeBand values must be in range [0, 12]')
    }
  }

  if (!Array.isArray(m.concepts) || m.concepts.length === 0) {
    errors.push('concepts must be a non-empty array')
  }
  if (!Array.isArray(m.objectives) || m.objectives.length === 0) {
    errors.push('objectives must be a non-empty array')
  }
  if (!Array.isArray(m.prerequisites)) {
    errors.push('prerequisites must be an array')
  }
  if (typeof m.published !== 'boolean') {
    errors.push('published must be a boolean')
  }

  if (!Array.isArray(m.levels) || m.levels.length === 0) {
    errors.push('levels must be a non-empty array')
  } else {
    const levelIds = new Set<string>()
    for (let i = 0; i < m.levels.length; i++) {
      const lvl = m.levels[i] as Record<string, unknown>
      if (typeof lvl.id !== 'string' || !lvl.id) {
        errors.push(`levels[${i}]: id is required`)
      } else if (levelIds.has(lvl.id)) {
        errors.push(`levels[${i}]: duplicate level id "${lvl.id}"`)
      } else {
        levelIds.add(lvl.id)
      }
      if (typeof lvl.name !== 'string' || !lvl.name) errors.push(`levels[${i}]: name is required`)
      if (typeof lvl.goal !== 'string' || !lvl.goal) errors.push(`levels[${i}]: goal is required`)
      // Validate maze levels have grid; output levels have expectedOutput
      if (lvl.type === 'output') {
        if (!Array.isArray(lvl.expectedOutput)) {
          errors.push(`levels[${i}] (output): expectedOutput must be an array`)
        }
      } else {
        if (!Array.isArray(lvl.grid)) errors.push(`levels[${i}] (maze): grid is required`)
      }
    }

    if (m.narrative && typeof m.narrative === 'object' && !Array.isArray(m.narrative)) {
      const narr = m.narrative as Record<string, unknown>
      if (Array.isArray(narr.chapters)) {
        for (const ch of narr.chapters as Array<Record<string, unknown>>) {
          if (typeof ch.levelId === 'string' && !levelIds.has(ch.levelId)) {
            errors.push(`narrative: chapter references unknown levelId "${ch.levelId}"`)
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
