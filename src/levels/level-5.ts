import type { MazeLevel } from '../types'

/**
 * Level 5 — "Locked door" (conditionals + two goals)
 *
 *   S . . . .
 *   . . . . .
 *   . . D . .      D = the door (the star / goal)
 *   . . . . .
 *   K . . . .      K = the key
 *
 * Two goals with an ordering rule: the door (goal 2) is LOCKED until the key
 * (goal 1) is collected. The open grid tempts the student to drive straight to
 * the door — doing so lands them on a locked door and fails with a clear
 * message. The lesson: get the key first.
 *
 * The conditional block `if has key { … }` lets the student express that the
 * "go to the door" part of their program should only run once they hold the
 * key. Using it earns conditionals mastery and is the level's tidy solution.
 *
 * Intended solution:
 *   turn right            (face south)
 *   repeat 4 (move)       → reach the key at (4,0)
 *   if has key:
 *     turn left           (face east)
 *     move, move          → (4,2)
 *     turn left           (face north)
 *     move, move          → (2,2) = door
 */
export const level5: MazeLevel = {
  id: 'locked-door',
  name: 'Locked door',
  goal: 'The door is locked! Grab the key 🔑 first, then open the door ★.',
  optimalBlocks: 10,
  prediction: {
    question: "What do you think happens if the robot goes straight to the door without the key?",
    options: [
      'The door opens anyway',
      'The robot gets stuck — door is locked!',
      'The robot turns around',
    ],
    correctIndex: 1,
  },
  grid: [
    ['start', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'goal', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty', 'empty'],
    ['key', 'empty', 'empty', 'empty', 'empty'],
  ],
  startDir: 'east',
  concepts: ['sequencing', 'conditionals'],
  maxSteps: 300,
  hints: {
    1: 'The door is locked. What do you need before you can open it — and where is it?',
    2: 'Go get the key in the bottom-left corner first. Then head to the door. Use the `if has key` block to wrap the "go to the door" steps.',
    3: 'Face south and move down 4 to the key. Then add an `if has key` block. Inside it: turn to face the door (east 2, then north 2) so you only approach the door once you actually hold the key.',
  },
  lesson: {
    concept: 'Conditionals (if statements)',
    explanation:
      "Sometimes you only want to do something *if* a certain condition is true — that's an `if` statement. " +
      "It checks something, and only runs the code inside it when the answer is yes. " +
      "This is how programs make decisions: games check if you won, apps check if you're logged in, " +
      "and our robot checks whether it's holding the key!",
    starterQuestions: [
      "What do you think happens if the robot goes straight to the door without picking up the key first? Give it a try!",
      "Have you ever seen a locked gate in a video game — one that only opens after you find an item? How did that feel?",
      "The `if has key` block only runs what's inside it when the robot is carrying the key. Can you think of a real-life example of an 'if' rule like that?",
    ],
    ahaMoment:
      "Conditionals make programs smart. Instead of always doing the same thing, your program can check what's true and decide what to do.",
  },
}
