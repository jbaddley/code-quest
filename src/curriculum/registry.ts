import type { AnyLevel } from '../types'
import type { CurriculumModule, ModuleLevel } from './types'
import mazeAdventuresRaw from './modules/maze-adventures.json'
import printAndOutputRaw from './modules/print-and-output.json'

export class CurriculumRegistry {
  private readonly modules: Map<string, CurriculumModule> = new Map()
  private readonly levelIndex: Map<string, ModuleLevel> = new Map()
  private readonly levelToModuleId: Map<string, string> = new Map()
  private readonly moduleOrder: string[] = []

  constructor(modules: CurriculumModule[]) {
    for (const mod of modules) {
      this.registerModule(mod)
    }
  }

  registerModule(module: CurriculumModule): void {
    this.modules.set(module.id, module)
    if (!this.moduleOrder.includes(module.id)) {
      this.moduleOrder.push(module.id)
    }
    for (const level of module.levels) {
      this.levelIndex.set(level.id, level)
      this.levelToModuleId.set(level.id, module.id)
    }
  }

  updateModule(id: string, patch: Partial<CurriculumModule>): void {
    const existing = this.modules.get(id)
    if (!existing) throw new Error(`Module "${id}" not found`)
    // Remove old level index entries
    for (const level of existing.levels) {
      this.levelIndex.delete(level.id)
      this.levelToModuleId.delete(level.id)
    }
    const updated: CurriculumModule = {
      ...existing,
      ...patch,
      id,
      updatedAt: new Date().toISOString(),
    }
    this.modules.set(id, updated)
    for (const level of updated.levels) {
      this.levelIndex.set(level.id, level)
      this.levelToModuleId.set(level.id, id)
    }
  }

  addLevelToModule(moduleId: string, level: ModuleLevel, position?: number): void {
    const module = this.modules.get(moduleId)
    if (!module) throw new Error(`Module "${moduleId}" not found`)
    const levels = [...module.levels]
    if (position !== undefined) {
      levels.splice(position, 0, level)
    } else {
      levels.push(level)
    }
    this.updateModule(moduleId, { levels })
  }

  getModule(id: string): CurriculumModule | undefined {
    return this.modules.get(id)
  }

  listModules(includeUnpublished = false): CurriculumModule[] {
    return this.moduleOrder
      .map((id) => this.modules.get(id)!)
      .filter((m) => includeUnpublished || m.published)
  }

  /** Flat list of all levels across all modules, in module + within-module order. */
  getAllLevels(): AnyLevel[] {
    const result: AnyLevel[] = []
    for (const id of this.moduleOrder) {
      const mod = this.modules.get(id)
      if (mod) {
        for (const level of mod.levels) {
          result.push(level as AnyLevel)
        }
      }
    }
    return result
  }

  getLevel(id: string): AnyLevel | undefined {
    return this.levelIndex.get(id) as AnyLevel | undefined
  }

  getNextLevel(currentId: string): AnyLevel | null {
    const allLevels = this.getAllLevels()
    const idx = allLevels.findIndex((l) => l.id === currentId)
    if (idx === -1) return null
    return allLevels[idx + 1] ?? null
  }

  getLevelModule(levelId: string): CurriculumModule | undefined {
    const moduleId = this.levelToModuleId.get(levelId)
    return moduleId ? this.modules.get(moduleId) : undefined
  }

  exportModule(id: string): string {
    const module = this.modules.get(id)
    if (!module) throw new Error(`Module "${id}" not found`)
    return JSON.stringify(module, null, 2)
  }
}

export const curriculumRegistry = new CurriculumRegistry([
  mazeAdventuresRaw as unknown as CurriculumModule,
  printAndOutputRaw as unknown as CurriculumModule,
])
