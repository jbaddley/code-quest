import type { MazeLevel } from '../types'

/**
 * Level 7 — "Fog of War" (Repeat Until / Move Until Wall)
 *
 *   S . . . . . . . . .   row 0  (open east corridor — 9 moves)
 *   # # # # # # # # # .   row 1  (wall 0-8; passage at col 9)
 *   . . . . . . . . . .   row 2  (open west corridor — 9 moves)
 *   . # # # # # # # # #   row 3  (passage at col 0; wall 1-9)
 *   . . . . . . . . . G   row 4  (open east corridor — 9 moves to goal)
 *
 * Same zig-zag shape as Level 3 — but 10 wide instead of 7.  Counting 9 steps
 * three times is tedious and error-prone.  `move until wall` traverses each
 * corridor in one block regardless of length: the student never needs to count.
 *
 * Efficient solution:
 *   move-until-wall; turn right; move; move;
 *   turn right; move-until-wall; turn left; move; move;
 *   turn left; move-until-wall
 *
 * (The two "move; move" segments cross the single-cell-wide passage rows.)
 */
export const level7: MazeLevel = {
  id: 'fog-of-war',
  name: 'Fog of War',
  goal: 'The corridors are too long to count — find a smarter way to move.',
  optimalBlocks: 9,
  prediction: {
    question: "If you use 'repeat 9 {move}' but the corridor is actually 10 cells long, what happens?",
    options: [
      'The robot reaches the end fine',
      'The robot stops one cell too early',
      'The robot crashes',
    ],
    correctIndex: 1,
  },
  grid: [
    ['start', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['wall',  'wall',  'wall',  'wall',  'wall',  'wall',  'wall',  'wall',  'wall',  'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'wall',  'wall',  'wall',  'wall',  'wall',  'wall',  'wall',  'wall',  'wall'],
    ['empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'empty', 'goal'],
  ],
  startDir: 'east',
  concepts: ['sequencing', 'repeatUntil'],
  maxSteps: 400,
  hints: {
    1: "Counting 9 steps every time is painful. What if there was a block that just kept moving until it couldn't anymore?",
    2: "Use `move forward until wall` for every stretch — including the short south hops. The walls stop the robot at exactly the right spot each time.",
    3: "Five `move until wall` blocks, four turns: move-until-wall, turn right, move-until-wall, turn right, move-until-wall, turn left, move-until-wall, turn left, move-until-wall. The last one lands right on the goal!",
  },
  lesson: {
    concept: 'Repeat Until (while loops)',
    explanation:
      "A *while loop* keeps repeating as long as a condition is true — or until something changes. " +
      "`Move until wall` is a while loop: it keeps moving forward until it CAN'T anymore. " +
      "You don't need to know how far — the loop figures it out. This is much more powerful than counting!",
    starterQuestions: [
      "How many steps is each long corridor in this maze? Would you want to type that number manually?",
      "Imagine a robot exploring a building. It has no map — it can't count rooms. How would it know when to stop walking down a corridor?",
      "What's the difference between `repeat 9 { move }` and `move until wall`? Which is safer if the corridor length changes?",
    ],
    ahaMoment:
      "While loops check a condition instead of counting. They're perfect when you don't know — or don't care — how many times something should repeat.",
  },
}
