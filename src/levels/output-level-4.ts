import type { OutputLevel } from '../types'

/**
 * Output Level 4 — "Two Lines"
 * Goal: print "Hello" then "World" on separate lines
 * Expected: ["Hello", "World"]
 *
 * Introduces sequencing in output context — each print() call = one line.
 */
export const outputLevel4: OutputLevel = {
  type: 'output',
  id: 'output-two-lines',
  name: 'Two Lines',
  goal: 'Print "Hello" on one line, then "World" on the next line.',
  concepts: ['print', 'literals', 'sequencing'],
  expectedOutput: ['Hello', 'World'],
  optimalLines: 2,
  hints: {
    1: 'Each print() block creates a new line. How many blocks do you need for two lines?',
    2: 'Drag two 🖨️ print blocks — one for Hello and one for World. Stack them in the right order.',
    3: 'Stack "🖨️ print Hello" above "🖨️ print World". The top block runs first.',
  },
  lesson: {
    concept: 'Output',
    explanation:
      'Just like with the robot maze, order matters! Each `print()` runs top to bottom. ' +
      'The first block prints the first line; the second block prints the second line. ' +
      'This is sequencing applied to output — the same idea, a new context.',
    starterQuestions: [
      'If you flip the two blocks, what do you think will happen?',
      'How is "two print blocks" similar to "two move blocks" in the maze?',
      'What would you need to print your full name on two separate lines?',
    ],
    ahaMoment:
      'Sequencing works for output too — each `print()` runs in order, top to bottom, one line at a time.',
  },
}
