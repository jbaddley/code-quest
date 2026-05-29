import type { MazeLevel } from '../types'

/**
 * Level 8 — "The Snake" (Nested Loops)
 *
 *   S . . . .   row 0
 *   . . . . .   row 1
 *   . . . . .   row 2
 *   . . . . .   row 3
 *   . . . . G   row 4  (goal at bottom-right)
 *
 * An open 5×5 grid.  The robot must sweep in a snake / boustrophedon pattern:
 *
 *   → → → → →   (row 0, east 4)
 *               ↓  (south 1)
 *   ← ← ← ← ←  (row 1, west 4)
 *   ↓
 *   → → → → →  (row 2, east 4)
 *               ↓
 *   ← ← ← ← ←  (row 3, west 4)
 *   ↓
 *   → → → → G  (row 4, east 4 to goal)
 *
 * The outer loop runs twice. Each iteration covers one east-leg + one west-leg:
 *
 *   repeat 2 {
 *     repeat 4 { move }      ← east 4
 *     turn right; move       ← step south
 *     turn right
 *     repeat 4 { move }      ← west 4
 *     turn left; move        ← step south
 *     turn left
 *   }
 *   repeat 4 { move }        ← final east leg to the goal
 *
 * The "aha" is that a loop body can *itself* contain loops — a loop inside a loop.
 * Real-world uses: nested loops draw tables, process grids, render graphics.
 */
export const level8: MazeLevel = {
  id: 'the-snake',
  name: 'The Snake',
  goal: 'Sweep every row — your program must cover the whole grid.',
  optimalBlocks: 13,
  prediction: {
    question: "How many times does the 'sweep east, step down, sweep west, step down' pattern repeat?",
    options: ['Once', 'Twice', 'Three times'],
    correctIndex: 1,
  },
  grid: [
    ['start', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'goal'],
  ],
  startDir: 'east',
  concepts: ['sequencing', 'loops', 'nestedLoops'],
  maxSteps: 500,
  hints: {
    1: "Look at the path row by row. Does the east-then-west pattern repeat? How many times?",
    2: "The outer loop runs 2 times. Each time: move east 4, step south, turn around, move west 4, step south, turn around. Then one final east run to the goal.",
    3: "repeat 2 { repeat 4{move}, turn right, move, turn right, repeat 4{move}, turn left, move, turn left }. Then repeat 4{move} to reach the star.",
  },
  lesson: {
    concept: 'Nested Loops',
    explanation:
      "A loop's *body* is just a mini-program — which means it can contain other loops! " +
      "A *nested loop* is a loop inside a loop: the inner one runs completely for every single " +
      "step of the outer one. This is how programs draw grids, sweep areas, process tables, and render images.",
    starterQuestions: [
      "Look at the grid row by row — does the robot's movement form a repeating pattern? What's the smallest unit that repeats?",
      "If you had to describe the whole path to a friend in one sentence, what would you say?",
      "Can you put a `repeat 4 { move }` block inside another `repeat` block? What do you think happens?",
    ],
    ahaMoment:
      "A loop inside a loop: the inner loop completes ALL its rounds for each single step of the outer loop. This is how you describe patterns in two dimensions.",
  },
}
