import type { OutputLevel } from '../types'

/**
 * Output Level 3 — "Hello, World!"
 * Goal: print the classic greeting
 * Expected: ["Hello, World!"]
 *
 * The famous first program. Teaches exact string matching including punctuation.
 */
export const outputLevel3: OutputLevel = {
  type: 'output',
  id: 'output-hello-world',
  name: 'Hello, World!',
  goal: 'Print the classic programmer greeting: Hello, World!',
  concepts: ['print', 'literals'],
  expectedOutput: ['Hello, World!'],
  optimalLines: 1,
  hints: {
    1: 'There is a famous first program every programmer writes. Can you guess what it prints?',
    2: 'Use the 🖨️ print block. Make sure you include the comma and exclamation mark exactly.',
    3: 'Drag "🖨️ print" and type: Hello, World! (with a capital H, comma, space, capital W, and !)',
  },
  lesson: {
    concept: 'Output',
    explanation:
      '"Hello, World!" is the first program almost every programmer writes — it has been a ' +
      'tradition since 1978. It proves your program can run and shows output. ' +
      'Exact spelling matters: computers are very precise about punctuation and capitalisation.',
    starterQuestions: [
      'Why do you think programmers always start by printing "Hello, World!"?',
      'Does it matter if you write "hello, world" instead of "Hello, World!"? Why?',
      'What would happen if your robot got directions that said "Go North" instead of "go north"?',
    ],
    ahaMoment:
      'Computers are exact — one wrong character changes the result. Spelling and punctuation matter in code just like in writing.',
  },
}
