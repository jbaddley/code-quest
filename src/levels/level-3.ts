import type { MazeLevel } from '../types'

/**
 * Level 3 — "Zig-zag"
 *
 *   S . . . . . .
 *   # # # # # # .
 *   . . . . . . .
 *   . # # # # # #
 *   . . . . . . G
 *
 * Forces multiple direction changes — every row needs the opposite heading.
 * Robot starts facing east; the path is:
 *   east 6 → turn right → south 2 → turn right → west 6 → turn left → south 2 → turn left → east 6
 *
 * 5 straight runs of 6 moves plus 4 turns. With sequencing alone that's
 * 34 blocks; with three `repeat 6` blocks it collapses to ~9 blocks.
 * The level lights up the loops concept and starts to hint at "this would
 * be even tidier if we could parameterize the turn direction" — a natural
 * lead-in to variables and functions in later levels.
 */
export const level3: MazeLevel = {
  id: 'zig-zag',
  name: 'Zig-zag',
  goal: 'The walls force you to weave. Repeats are your friend.',
  optimalBlocks: 14,
  prediction: {
    question: 'Count the long straight corridors. How many are there?',
    options: ['2 corridors', '3 corridors', '4 corridors'],
    correctIndex: 1,
  },
  grid: [
    ['start', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'wall', 'wall', 'wall', 'wall', 'wall', 'wall'],
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'goal'],
  ],
  startDir: 'east',
  concepts: ['sequencing', 'loops'],
  maxSteps: 300,
  hints: {
    1: 'Trace the path with your finger first. How many segments of 6 moves do you see?',
    2: 'East 6, turn right, south 2, turn right, west 6, turn left, south 2, turn left, east 6. Use `repeat 6` for each long run.',
    3: 'Three `repeat 6` blocks (each with a `move forward` inside), separated by the right turns. Between them: `turn right` after segment 1, `turn right` then south 2 then `turn right` after segment 2, and `turn left` then south 2 then `turn left` to point back east for segment 3.',
  },
  lesson: {
    concept: 'Finding Patterns',
    explanation:
      "Every complicated path is actually a pattern in disguise. " +
      "Once you spot what's repeating, you can describe it with a loop instead of a long list of steps. " +
      "Programmers call this *abstraction* — seeing the shape of a problem, not just every little detail.",
    starterQuestions: [
      "Before writing a single block, trace the path with your finger. Do you notice any part that looks the same more than once?",
      "How many long corridors does the robot have to run down? Are they all the same length?",
      "If you had to describe this whole maze path in ONE sentence to a friend, what would you say?",
    ],
    ahaMoment:
      "Complex paths are just simple patterns repeated. Spot the pattern first — then code it.",
  },
}
