import type { MazeLevel } from '../types'

/**
 * Level 6 — "Variable village" (Variables)
 *
 *   S . . . . . .   row 0  (east corridor, 6 moves)
 *   # # # # # # .   row 1  (wall; passage at col 6)
 *   . . . . . . .   row 2
 *   . . . . . . .   row 3
 *   . . . . . . G   row 4  (south corridor, 4 moves down from row 0)
 *
 * Same L-shape as levels 1 & 2 — but now the numbers differ (6 east, 4 south).
 * The *lesson* is variables: store 6 in `steps`, use `repeat steps` to run east;
 * then store 4 and reuse the same loop to run south.  Seeing the same `repeat
 * steps` block change behaviour without touching the loop structure is the
 * "aha" for variables.
 *
 * Efficient solution:
 *   set steps = 6; repeat steps { move }; turn right;
 *   set steps = 4; repeat steps { move }
 */
export const level6: MazeLevel = {
  id: 'variable-village',
  name: 'Variable Village',
  goal: 'Two different distances — can one loop handle both?',
  optimalBlocks: 7,
  prediction: {
    question: "The two corridors have different lengths: 6 and 4. How many move blocks WITHOUT loops?",
    options: ['8 blocks total', '10 blocks total', '12 blocks total'],
    correctIndex: 1,
  },
  grid: [
    ['start', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['wall',  'wall',  'wall',  'wall',  'wall',  'wall',  'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'goal'],
  ],
  startDir: 'east',
  concepts: ['sequencing', 'variables'],
  maxSteps: 300,
  hints: {
    1: "The two corridors are different lengths. What if you could store the length in a box, then tell the loop to repeat that many times?",
    2: "Use `set steps to 6`, then `repeat [steps]` to move east. After turning, use `set steps to 4` and `repeat [steps]` again to move south.",
    3: "Drag `set steps to 6`, then a `repeat [steps]` block with one `move forward` inside. Add `turn right`. Then `set steps to 4`, another `repeat [steps]` with one `move forward` inside.",
  },
  lesson: {
    concept: 'Variables',
    explanation:
      "A *variable* is like a labelled box that holds a value. You can put a number in it, " +
      "use it in your program, then change what's in the box and use it again. " +
      "This means you can write ONE loop that works for ANY distance — just change the variable!",
    starterQuestions: [
      "Imagine you have a box labelled 'steps'. If I write `steps = 6` on a slip of paper and put it in, what does the loop `repeat steps { move }` do?",
      "The two corridors here are different lengths. Would you write two completely different loops — or find a way to reuse one?",
      "What's the difference between writing `repeat 6` and `repeat steps` where `steps = 6`?",
    ],
    ahaMoment:
      "Variables give names to values. Change the variable, and every place that uses it changes too — write the loop once, use it forever.",
  },
}
