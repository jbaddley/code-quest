/**
 * Code Quest's RPC tool definitions — single source of truth.
 *
 * Both the runtime handler map in `App.tsx` and the `manifest.json`
 * `powerupMCPSpecification.tools` list read from these. Keep the names
 * consistent (camelCase, matching the official SchoolAI example PowerUps).
 */

export const CODE_QUEST_TOOLS = [
  {
    name: 'open',
    description: 'Opens the Code Quest PowerUp.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'evaluateAttempt',
    description:
      "Runs the student's current block program against the active maze level " +
      'and returns whether it solved the maze, plus a failure signal if not.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'generateHint',
    description:
      'Returns a tiered hint for the current level. Level 1 is Socratic, ' +
      '2 is directive, 3 is a guided walkthrough.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        level: {
          type: 'number',
          enum: [1, 2, 3],
          description: 'Hint escalation level (1=Socratic, 2=directive, 3=walkthrough).',
        },
      },
      required: ['level'],
    },
  },
  {
    name: 'getMastery',
    description:
      "Returns the student's current mastery scores (0..1) across the " +
      'concepts this PowerUp teaches: sequencing, loops, conditionals, variables.',
    inputSchema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'setLevel',
    description:
      'Switches the active level. Used by teachers (or Dot, with permission) ' +
      'to promote a stuck student to an easier level or advance a fast one.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        levelId: { type: 'string', description: 'Target level identifier.' },
      },
      required: ['levelId'],
    },
  },
  {
    name: 'listModules',
    description:
      'Returns all curriculum modules with their metadata (title, description, concepts, ' +
      'grade band, estimated time, prerequisites). Does not include level data. ' +
      'Use this to tell a student what learning paths are available or to recommend a next module.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        includeUnpublished: {
          type: 'boolean',
          description: 'If true, include draft/unpublished modules. Default: false.',
        },
      },
      required: [],
    },
  },
  {
    name: 'getModule',
    description:
      'Returns full metadata for a specific curriculum module, including its level list ' +
      '(IDs, names, concepts) and narrative arc. Does not include full level data.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        moduleId: { type: 'string', description: "The module's kebab-case identifier, e.g. 'maze-adventures'." },
      },
      required: ['moduleId'],
    },
  },
  {
    name: 'setModule',
    description:
      'Activates a curriculum module, switching the student to its first level (or a specific level). ' +
      'Use this to move a student between learning paths or start a new module.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        moduleId: { type: 'string', description: 'The module to activate.' },
        levelId: {
          type: 'string',
          description: 'Optional: jump to a specific level within the module. Defaults to the first level.',
        },
      },
      required: ['moduleId'],
    },
  },
  {
    name: 'createModule',
    description:
      'Creates a new curriculum module with the given metadata. The module starts with no levels; ' +
      'use addLevelToModule (or buildLevel) to populate it. Returns the new module ID.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        id: { type: 'string', description: 'Unique kebab-case identifier, e.g. "my-custom-module".' },
        title: { type: 'string', description: 'Display title.' },
        description: { type: 'string', description: '1-3 sentence description.' },
        concepts: {
          type: 'array',
          items: { type: 'string' },
          description: "Concepts this module teaches, e.g. ['loops', 'conditionals'].",
        },
        objectives: {
          type: 'array',
          items: { type: 'string' },
          description: '"Students will be able to…" learning objectives.',
        },
        gradeBand: {
          type: 'array',
          items: { type: 'integer' },
          description: '[minGrade, maxGrade] e.g. [2, 5].',
        },
        prerequisites: {
          type: 'array',
          items: { type: 'string' },
          description: 'Module IDs that should be completed before this one. Use [] for none.',
        },
        estimatedMinutes: { type: 'integer', description: 'Approximate completion time in minutes.' },
        author: { type: 'string', description: 'Author name.' },
      },
      required: ['id', 'title', 'description', 'concepts', 'objectives', 'gradeBand'],
    },
  },
  {
    name: 'addLevelToModule',
    description:
      'Adds an existing level (built-in or custom) to a curriculum module by level ID. ' +
      'Use after buildLevel to incorporate a newly created level into a module.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        moduleId: { type: 'string', description: 'The module to add the level to.' },
        levelId: { type: 'string', description: 'ID of the level to add.' },
        position: {
          type: 'integer',
          description: '0-based index to insert at. Omit to append at the end.',
        },
      },
      required: ['moduleId', 'levelId'],
    },
  },
  {
    name: 'exportModule',
    description:
      'Returns the complete JSON definition of a module as a string — including all embedded levels, ' +
      'metadata, standards, assessments, and narrative. Ready to save as a .json file.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        moduleId: { type: 'string', description: 'The module to export.' },
      },
      required: ['moduleId'],
    },
  },
] as const

export type CodeQuestToolName = (typeof CODE_QUEST_TOOLS)[number]['name']
