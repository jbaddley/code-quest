import type { OutputLevel } from '../types'

/**
 * Output Level 1 — "Your First Output"
 * Goal: print the word Hello
 * Expected: ["Hello"]
 *
 * Introduces the print() function — the simplest possible program.
 */
export const outputLevel1: OutputLevel = {
  type: 'output',
  id: 'output-first-output',
  name: 'Your First Output',
  goal: 'Make the program print the word Hello.',
  concepts: ['print', 'literals'],
  expectedOutput: ['Hello'],
  optimalLines: 1,
  hints: {
    1: 'Every program needs a way to show its result. What block lets you print words?',
    2: 'Drag the 🖨️ print block into the workspace. You can type any text inside the quotes.',
    3: 'Drag "🖨️ print" and type Hello (with a capital H) in the text field, then press Run.',
  },
  lesson: {
    concept: 'Output',
    explanation:
      'A program is only useful if it can share its results. ' +
      '`print()` is how a program talks to you — it sends text to the screen. ' +
      "Every language has something like print(): it's one of the very first things every programmer learns.",
    starterQuestions: [
      'If a calculator gives you an answer, how do you see it?',
      'If you wrote a recipe program, how would it tell you the ingredients?',
      'What do you think the word "output" means in programming?',
    ],
    ahaMoment:
      'Programs communicate through output — `print()` is how your code says something to the world.',
  },
}
