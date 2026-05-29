import type { MazeLevel } from '../types'

/**
 * Level 9 — "Define & Reuse" (Functions / Procedures)
 *
 *   S . . .   row 0
 *   . . . .   row 1
 *   # # . .   row 2
 *   . . . .   row 3
 *   . . . G   row 4
 *
 * The robot needs to "step down-right" multiple times. The pattern
 * (turn right, move, turn left) recurs — a great candidate for a named
 * procedure.
 *
 * Efficient solution: define "step-down" = {turn right, move, turn left},
 * then: move, move, move, call step-down, move, move, call step-down,
 * move, move, move (reaching the goal).
 */
export const level9: MazeLevel = {
  id: 'define-and-reuse',
  name: 'Define & Reuse',
  goal: 'Create your own named block and reuse it!',
  optimalBlocks: 8,
  prediction: {
    question: "If you had to write 'turn right, move, turn left' three times in a row, how many blocks would that be?",
    options: ['3 blocks', '9 blocks', 'It depends'],
    correctIndex: 1,
  },
  grid: [
    ['start', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty'],
    ['wall',  'wall',  'empty', 'empty'],
    ['empty', 'empty', 'empty', 'empty'],
    ['empty', 'empty', 'empty', 'goal'],
  ],
  startDir: 'east',
  concepts: ['sequencing', 'functions'],
  maxSteps: 300,
  hints: {
    1: 'The robot needs to make the same "step down" move more than once. Could you give that move a name?',
    2: 'Define a procedure called "step-down" that contains: turn right, move, turn left. Then call it wherever you need that move.',
    3: 'Drag "define my-move". Inside it: turn right, move forward, turn left. Then drag "do my-move" wherever you want to step down.',
  },
  lesson: {
    concept: 'Functions (Procedures)',
    explanation:
      "A *function* is a named block of code you define once and use many times. " +
      "Instead of copying the same moves over and over, you give them a name and 'call' them whenever you need them. " +
      "In real programming, functions are everywhere — they keep code short and organized.",
    starterQuestions: [
      "If you had to write 'turn right, move, turn left' three times, would you copy it, or would you rather give it a name?",
      "Think about verbs like 'eat breakfast' or 'brush teeth' — those are real-life functions. What moves could you bundle into a function in this maze?",
      "What do you think happens when you 'call' a function — does it happen once or every time you call it?",
    ],
    ahaMoment:
      "Functions are reusable actions. Name a sequence once, call it everywhere — your code gets shorter and changes in one place apply everywhere.",
  },
}
