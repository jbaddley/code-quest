import type { MazeLevel } from '../types'

/**
 * Level 4 — "Staircase"
 *
 *   S . # # # # #
 *   # . . # # # #
 *   # # . . # # #
 *   # # # . . # #
 *   # # # # . . #
 *   # # # # # . .
 *   # # # # # # G
 *
 * A diagonal staircase. The robot starts facing east. The corridor zig-zags
 * down-and-right one cell at a time. Unlike the earlier mazes (one heading per
 * long run), here the *loop body itself* has to contain multiple actions —
 * the repeated unit is "turn, move, turn back, move". This is the level where
 * students learn a loop can wrap a little sequence, not just a single step.
 *
 * Optimal: move → repeat 5 (turn right, move, turn left, move) → turn right, move.
 */
export const level4: MazeLevel = {
  id: 'staircase',
  name: 'Staircase',
  goal: 'Climb the staircase down to the star.',
  optimalBlocks: 8,
  prediction: {
    question: 'Look at one stair step. How many actions does the robot take to complete it?',
    options: [
      '1 action (just forward)',
      '2 actions (forward + turn)',
      '4 actions (the whole stair pattern)',
    ],
    correctIndex: 2,
  },
  grid: [
    ['start', 'empty', 'wall', 'wall', 'wall', 'wall', 'wall'],
    ['wall', 'empty', 'empty', 'wall', 'wall', 'wall', 'wall'],
    ['wall', 'wall', 'empty', 'empty', 'wall', 'wall', 'wall'],
    ['wall', 'wall', 'wall', 'empty', 'empty', 'wall', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'empty', 'empty', 'wall'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'empty', 'empty'],
    ['wall', 'wall', 'wall', 'wall', 'wall', 'wall', 'goal'],
  ],
  startDir: 'east',
  concepts: ['sequencing', 'loops'],
  maxSteps: 300,
  hints: {
    1: 'Each step of the staircase is the same little dance. What two moves repeat?',
    2: 'The repeating unit is: turn right, move, turn left, move. Wrap that in a repeat block.',
    3: 'Start with one `move forward`. Then a `repeat 5` containing: turn right, move forward, turn left, move forward. Finish with turn right, move forward to land on the star.',
  },
  lesson: {
    concept: 'Loop Bodies',
    explanation:
      "A loop doesn't have to repeat just one move — it can repeat a whole little *program*. " +
      "You can put as many blocks as you like inside a loop, and all of them run together, over and over. " +
      "The stuff inside the loop is called the *loop body*.",
    starterQuestions: [
      "Look at just ONE step of the staircase. What does the robot have to do — how many moves is that?",
      "If the pattern for one stair is four actions, and there are 5 stairs, how many actions is that in total? Would you want to drag them all?",
      "What parts of the solution go INSIDE the loop, and what parts go OUTSIDE of it?",
    ],
    ahaMoment:
      "A loop body is its own mini-program. Find what repeats as a group, put the whole group inside the loop.",
  },
}
