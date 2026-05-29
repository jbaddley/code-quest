import type { OutputLevel } from '../types'

/**
 * Output Level 5 — "Mixed Output"
 * Goal: print "The answer is" then 42
 * Expected: ["The answer is", "42"]
 *
 * Mixes text and number literals — uses both block types together.
 */
export const outputLevel5: OutputLevel = {
  type: 'output',
  id: 'output-mixed',
  name: 'Mixed Output',
  goal: 'Print "The answer is" on one line, then print the number 42 on the next line.',
  concepts: ['print', 'literals', 'sequencing'],
  expectedOutput: ['The answer is', '42'],
  optimalLines: 2,
  hints: {
    1: 'You need to print two things — one is text, the other is a number. Which block is which?',
    2: 'Use the 🖨️ print text block first (for "The answer is") then the 🔢 print number block (for 42).',
    3: 'Stack "🖨️ print The answer is" above "🔢 print 42". Make sure the text matches exactly.',
  },
  lesson: {
    concept: 'Output',
    explanation:
      'Real programs often mix text labels with number results — like a calculator that says ' +
      '"Answer: 42" instead of just "42". Combining text and numbers in output is one of the ' +
      'most common things programs do.',
    starterQuestions: [
      'Can you think of a real program that shows both words and numbers?',
      'Why is it helpful to label a number with words? (e.g. "Score: 100" vs just "100")',
      'What two blocks will you need to solve this, and what order should they go in?',
    ],
    ahaMoment:
      'Programs mix text labels and numbers all the time — combining them makes output meaningful and easy to read.',
  },
}
