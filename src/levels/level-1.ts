import type { MazeLevel } from '../types'

/**
 * Level 1 — "Robot's first steps"
 *
 *   S . . . .
 *   # # # . .
 *   . . . . .
 *   . . . . .
 *   . . . . G
 *
 * The robot starts at top-left facing east, needs to reach the star.
 *
 * One solution: move 4 east → turn right → move 4 south.
 * Loop-aware solution: repeat 4 (move forward) → turn right → repeat 4 (move forward).
 *
 * Mastery scoring rewards `loops` when a repeat block is used.
 */
export const level1: MazeLevel = {
  id: 'robots-first-steps',
  name: "Robot's first steps",
  goal: 'Guide the robot to the star.',
  optimalBlocks: 5,
  prediction: {
    question: "If you put just ONE 'move forward' block and press Run, what will happen?",
    options: [
      'The robot zooms all the way to the star',
      'The robot takes one step forward',
      'The robot turns toward the star',
    ],
    correctIndex: 1,
  },
  grid: [
    ['start', 'empty', 'empty', 'empty', 'empty'],
    ['wall', 'wall', 'wall', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'goal'],
  ],
  startDir: 'east',
  concepts: ['sequencing', 'loops'],
  maxSteps: 200,
  hints: {
    1: 'Look at the wall pattern. What direction does the robot need to go first, and how can you avoid hitting the wall?',
    2: 'Try moving east 4 times, then turn right, then south 4 times. Want to use a `repeat 4` block to make it shorter?',
    3: 'Drag a `repeat 4` block. Inside it, put one `move forward`. After the repeat, add `turn right`, then another `repeat 4` with a `move forward` inside.',
  },
  lesson: {
    concept: 'Sequencing',
    explanation:
      "Computers follow instructions one at a time, in the exact order you write them — " +
      "this is called a *sequence*. Change the order, get a different result. " +
      "It's like a recipe: you crack the egg before you scramble it, never after!",
    starterQuestions: [
      "If I told you to put on your shoes — what would happen if you tried to tie the laces BEFORE putting them on?",
      "Do you think the robot cares about order? What do you think happens if you tell it to turn before it's even moved?",
      "Looking at the maze, what's the very FIRST move the robot should make to get past that wall?",
    ],
    ahaMoment:
      "Order matters. Computers do exactly what you say, in exactly the order you say it — no more, no less.",
  },
}
