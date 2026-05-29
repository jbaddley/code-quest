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
] as const

export type CodeQuestToolName = (typeof CODE_QUEST_TOOLS)[number]['name']
