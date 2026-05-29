import type { OutputLevel } from '../types'

/**
 * Output Level 2 — "Print a Number"
 * Goal: print the number 42
 * Expected: ["42"]
 *
 * Introduces number literals — distinct from text strings.
 */
export const outputLevel2: OutputLevel = {
  type: 'output',
  id: 'output-print-number',
  name: 'Print a Number',
  goal: 'Make the program print the number 42.',
  concepts: ['print', 'literals'],
  expectedOutput: ['42'],
  optimalLines: 1,
  hints: {
    1: 'Numbers and text are different in code. Which block is built for printing numbers?',
    2: 'Use the 🔢 print block and change the number field to 42.',
    3: 'Drag the "🔢 print" block and set its number to 42, then press Run.',
  },
  lesson: {
    concept: 'Output',
    explanation:
      'In programming, numbers and text (called "strings") are different kinds of data. ' +
      'A number like 42 can be used in math; a string like "Hello" is just characters. ' +
      '`print()` works with both — but it is good to know the difference.',
    starterQuestions: [
      'What is the difference between the word "42" and the number 42?',
      'If you add 1 to the word "42", what do you think happens?',
      'Can you think of a program that would need to print a number?',
    ],
    ahaMoment:
      'Numbers and text are different types of data — `print()` can show both, but they behave differently in calculations.',
  },
}
