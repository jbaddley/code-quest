import type { MazeLevel } from '../types'

/**
 * Level 2 — "The long march"
 *
 *   S . . . . . .
 *   . . . . . . .
 *   . . . . . . .
 *   . . . . . . .
 *   . . . . . . .
 *   . . . . . . .
 *   . . . . . . G
 *
 * 7×7 open grid — no walls. Same L-shape solution as level 1, but with
 * longer runs in each direction (6 + 6 vs 4 + 4). Without a repeat block,
 * the student needs 12 move blocks; with two `repeat 6` blocks, just 4
 * blocks total. This is the level where the loops concept earns its keep.
 *
 * One solution: move 6 east → turn right → move 6 south.
 * Loop-aware solution: repeat 6 (move) → turn right → repeat 6 (move).
 */
export const level2: MazeLevel = {
  id: 'long-march',
  name: 'The long march',
  goal: 'Same path as before — but longer. There has to be a faster way…',
  optimalBlocks: 5,
  prediction: {
    question: "Without loops, how many 'move forward' blocks would you need to solve this?",
    options: ['6 blocks', '12 blocks', '18 blocks'],
    correctIndex: 1,
  },
  grid: [
    ['start', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'goal'],
  ],
  startDir: 'east',
  concepts: ['sequencing', 'loops'],
  maxSteps: 200,
  hints: {
    1: "It's the same shape as last time — just longer. Stacking 12 move blocks works, but is there a tidier way?",
    2: 'Try a `repeat 6` with a `move forward` inside. Then turn right. Then another `repeat 6`.',
    3: 'Drag a `repeat` block, change the 4 to a 6, drop one `move forward` inside. After it, add `turn right`. Then a second `repeat 6` with a `move forward` inside.',
  },
  lesson: {
    concept: 'Loops (repeat)',
    explanation:
      "When you need to do the same thing many times, a *loop* lets you write it once and run it many times. " +
      "Instead of dragging 6 move blocks, you drag one `repeat 6` block with a single move inside. " +
      "Programmers are lazy in a good way — they never write the same thing twice!",
    starterQuestions: [
      "If you had to walk 6 steps, would you rather say 'step, step, step, step, step, step' — or just 'walk 6 steps'?",
      "Count how many times the robot needs to move east on this grid. Does dragging that many blocks sound fun?",
      "What do you think a `repeat 6` block actually does when the program runs — can you picture it?",
    ],
    ahaMoment:
      "Loops are shortcuts. Find the part that repeats, wrap it in a loop, and your whole program gets shorter and cleaner.",
  },
}
