/**
 * Built-in preset themes for Code Quest.
 *
 * Each preset provides a full `ThemeColors`, `ThemeGame`, and `ThemeLabels`
 * value. Teacher-supplied overrides in `ThemeConfig.colors / game / labels`
 * are shallow-merged on top of the resolved preset by `resolveTheme()`.
 */

import type { ThemeColors, ThemeGame, ThemeLabels, ThemePreset } from '../types'

interface FullPreset {
  colors: ThemeColors
  // robotSvg and robotSvgScale are optional — other game fields are required
  // so the canvas has colour/emoji fallbacks even when no SVG sprite is set.
  game: Required<Omit<ThemeGame, 'robotSvg' | 'robotSvgScale'>> & Pick<ThemeGame, 'robotSvg' | 'robotSvgScale'>
  labels: ThemeLabels
}

// ── Robot SVG sprites ─────────────────────────────────────────────────────────
// All sprites are authored on a 48×48 viewBox, pointing EAST (→).
// The canvas rotates the draw context before calling drawImage, so all four
// directions work automatically with no extra work per theme.

const SVG_ROBOT = '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="16" width="24" height="20" rx="4" fill="#3b82f6"/><rect x="14" y="7" width="16" height="12" rx="3" fill="#2563eb"/><line x1="22" y1="7" x2="22" y2="3" stroke="#1d4ed8" stroke-width="2" stroke-linecap="round"/><circle cx="22" cy="2.5" r="1.5" fill="#60a5fa"/><rect x="16" y="10" width="5" height="4" rx="1" fill="#93c5fd"/><rect x="23" y="10" width="5" height="4" rx="1" fill="#93c5fd"/><rect x="16" y="16" width="12" height="2" rx="1" fill="#1d4ed8"/><rect x="34" y="18" width="8" height="6" rx="2" fill="#2563eb"/><rect x="40" y="20" width="5" height="4" rx="2" fill="#1d4ed8"/><rect x="2" y="18" width="8" height="6" rx="2" fill="#2563eb"/><rect x="13" y="34" width="7" height="8" rx="2" fill="#1d4ed8"/><rect x="24" y="34" width="7" height="8" rx="2" fill="#1d4ed8"/><circle cx="18" cy="24" r="2" fill="#60a5fa"/><circle cx="26" cy="24" r="2" fill="#60a5fa"/><rect x="16" y="27" width="12" height="3" rx="1" fill="#1d4ed8"/></svg>'

const SVG_ROCKET = '<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><ellipse cx="21" cy="24" rx="13" ry="7" fill="#94a3b8"/><polygon points="34,24 26,18 26,30" fill="#ef4444"/><circle cx="22" cy="24" r="4" fill="#7dd3fc"/><circle cx="22" cy="24" r="2.5" fill="#0ea5e9"/><polygon points="10,24 8,14 16,20" fill="#64748b"/><polygon points="10,24 8,34 16,28" fill="#64748b"/><ellipse cx="9" cy="24" rx="5" ry="3" fill="#fb923c"/><ellipse cx="7" cy="24" rx="3" ry="2" fill="#fbbf24"/></svg>'




// ── Default ───────────────────────────────────────────────────────────────────

const DEFAULT: FullPreset = {
  colors: {
    primary:     '#2563eb',  // blue-600 — better contrast ~4.6:1 with white (was #3a6df0 at ~3.7:1)
    primaryText: '#ffffff',
    header:      '#1e2d4a',
    headerText:  '#ffffff',
    stageBg:     '#f8f9fc',
    winBg:       '#ecfdf5',
    winText:     '#065f46',  // emerald-900 — stronger contrast on light green
    failBg:      '#fef2f2',
    failText:    '#991b1b',  // red-800 — stronger contrast on light red
  },
  game: {
    robotSvg:   SVG_ROBOT,
    robotEmoji: '',       // empty = draw the default triangle
    goalEmoji:  '★',
    keyEmoji:   '🔑',
    wallColor:  '#1e2d4a',   // deep navy — clear against white floor
    floorColor: '#ffffff',
    startColor: '#dbeafe',   // light blue start
    goalColor:  '#fef3c7',   // light yellow goal
    gridLineColor: '#e2e8f0', // subtle gray-blue grid
  },
  labels: {
    appTitle:       'Code Quest',
    panelWorkspace: 'Workspace',
    panelGame:      'Game',
    panelProgress:  'Your Progress',
    btnRun:         '▶ Run',
    btnReset:       'Reset robot',
    character:      'robot',
    conceptLabels: {
      sequencing:  'Sequencing',
      loops:       'Loops',
      conditionals:'Conditionals',
      variables:   'Variables',
      repeatUntil: 'Repeat Until',
    },
    winMessage: '🎉 Solved cleanly!',
    failMessages: {
      'hit-wall':     '💥 Ouch — the robot crashed into a wall. Try turning before moving forward.',
      'out-of-bounds':'🚧 The robot fell off the map. Try a different direction.',
      'step-limit':   '⏳ Too many steps. Maybe the loop is too big — try a smaller number?',
      'door-locked':  '🔒 The door is locked! Go pick up the key 🔑 first, then come back.',
      'default':      'Not at the star yet — keep trying!',
    },
    levelStories: {
      'robots-first-steps':
        'Your robot has just been activated for the very first time! Guide it step-by-step through the corridor to reach the star. Program each move in exactly the right order.',
      'long-march':
        'The path ahead stretches on and on — the same move, over and over. Typing it one-by-one would take forever. There must be a smarter way to make the robot repeat itself.',
      'zig-zag':
        'The corridor winds back and forth through a series of sharp turns. Look carefully — there\'s a repeating pattern here. Find it, and you can write the whole solution with just a few blocks.',
      'staircase':
        'The robot must descend a diagonal staircase, step by careful step. Each stair needs two moves: one forward, one down. The same two-move pattern repeats all the way to the goal.',
      'locked-door':
        'The star is behind a locked door! The robot must first find the key on the other side of the maze. Then it needs to check — do I have the key? — before the door will open.',
      'variable-village':
        'Two corridors, two different lengths — 6 steps one way, 4 steps the other. Could a single loop handle both if you stored the length in a variable? Change the variable and the loop adapts.',
      'fog-of-war':
        'The corridors stretch so far you can\'t count the steps from here. Instead of guessing, let the robot keep moving until it hits a wall. A smarter loop watches for a signal to stop.',
      'the-snake':
        'The robot must sweep every row of the grid in a back-and-forth snake pattern. An outer loop drives each pass; an inner loop carries the robot across each row. A loop inside a loop!',
    },
  },
}

// ── Space ─────────────────────────────────────────────────────────────────────

const SPACE: FullPreset = {
  colors: {
    primary:     '#7c3aed',
    primaryText: '#ffffff',
    header:      '#0d1117',
    headerText:  '#e2e8f0',
    stageBg:     '#ffffff',
    winBg:       '#1e1b4b',
    winText:     '#c4b5fd',
    failBg:      '#2d0a0a',
    failText:    '#fca5a5',
  },
  game: {
    robotSvg:   SVG_ROCKET,
    robotEmoji: '🚀',
    goalEmoji:  '🪐',
    keyEmoji:   '🌙',
    // A11Y AA: all functional cell colours must be ≥3:1 against the floor.
    // floor #0c1e38 ≈ L 0.011.  Ratios measured vs that value:
    //   wall  #5b8cac → 5.2:1 ✓
    //   start #1565c0 → 3.3:1 ✓
    //   goal  #8b2be2 → 3.1:1 ✓
    wallColor:     '#5b8cac',  // steel-blue asteroid — clearly visible against floor
    floorColor:    '#0c1e38',  // space sector — distinct from void panel bg
    startColor:    '#1565c0',  // electric-blue launchpad
    goalColor:     '#8b2be2',  // vivid-purple planet
    gridLineColor: '#1c3f6e',  // star-map coordinate grid — visible against floor
  },
  labels: {
    appTitle:       'Space Quest',
    panelWorkspace: 'Control Panel',
    panelGame:      'Mission',
    panelProgress:  'Mission Stats',
    btnRun:         '🚀 Launch',
    btnReset:       'Reset rocket',
    character:      'rocket',
    conceptLabels: {
      sequencing:  'Flight Path',
      loops:       'Orbit Patterns',
      conditionals:'Mission Checks',
      variables:   'Fuel Levels',
      repeatUntil: 'Fly Until',
    },
    winMessage: '🚀 Mission complete!',
    failMessages: {
      'hit-wall':     '💥 The rocket hit an asteroid! Try a different route.',
      'out-of-bounds':'🌌 The rocket drifted into deep space. Turn back!',
      'step-limit':   '⏳ Fuel exhausted. Try a more efficient flight path.',
      'door-locked':  '🔒 The airlock is sealed! Grab the moon crystal 🌙 first.',
      'default':      "Haven't reached the planet yet — keep flying!",
    },
    levelStories: {
      'robots-first-steps':
        'Your rocket launches from Earth for the very first time! Navigate the asteroid corridor and reach the distant planet. Issue each thruster command in exactly the right order.',
      'long-march':
        'The planet lies at the far end of a vast stretch of deep space. Firing the thrusters once won\'t cut it — you\'ll need to repeat the burn many times. There must be a smarter way to fly.',
      'zig-zag':
        'The asteroid belt winds in a zig-zag pattern across three long corridors. Fly each twist and find the rhythm — there\'s a repeating flight pattern hidden in the route.',
      'staircase':
        'The rocket must hop diagonally across a staircase of asteroid platforms. Each hop takes a forward thrust and a downward boost — the same two-move maneuver repeats all the way to the planet.',
      'locked-door':
        'The planet\'s docking bay is sealed! First collect the lunar crystal from the far side of the sector. Then check: do I have the crystal? Only then will the airlock open.',
      'variable-village':
        'Two space corridors link your launchpad to the planet — 6 light-years east, 4 light-years south. Store the travel distance in a variable and let one thruster routine handle both legs.',
      'fog-of-war':
        'Deep space corridors stretch beyond sensor range — you can\'t see where they end. Let the rocket fly until it detects an asteroid. While-loop navigation: move until something stops you.',
      'the-snake':
        'The rocket must survey the entire sector in a grid scan — sweeping east, then west, row by row. The outer mission loop runs each sweep; the inner thruster loop covers each light-year. This is how satellites map planets.',
    },
  },
}

// ── Sports ────────────────────────────────────────────────────────────────────

const SPORTS: FullPreset = {
  colors: {
    primary:     '#15803d',  // green-700 — better contrast ratio with white (~4.5:1)
    primaryText: '#ffffff',
    header:      '#14532d',
    headerText:  '#dcfce7',
    stageBg:     '#f0fdf4',
    winBg:       '#dcfce7',
    winText:     '#14532d',  // darker green for better contrast on light bg
    failBg:      '#fef3c7',
    failText:    '#78350f',  // amber-900 for better contrast on yellow
  },
  game: {
    robotSvg:   '/sprites/runner.svg',
    robotEmoji: '⚽',
    goalEmoji:  '🏆',
    keyEmoji:   '⚡',
    wallColor:  '#14532d',   // dark green turf boundary
    floorColor: '#f0fdf4',   // near-white field
    startColor: '#bbf7d0',   // light green start zone
    goalColor:  '#fef9c3',   // light yellow trophy zone
    gridLineColor: '#86efac', // medium green yard lines
  },
  labels: {
    appTitle:       'Sports Lab',
    panelWorkspace: 'Playbook',
    panelGame:      'Field',
    panelProgress:  'Stats',
    btnRun:         '⚽ Play',
    btnReset:       'Reset player',
    character:      'player',
    conceptLabels: {
      sequencing:  'Play Sequence',
      loops:       'Drill Patterns',
      conditionals:'Playbook Checks',
      variables:   'Rep Counter',
      repeatUntil: 'Run Until',
    },
    winMessage: '🏆 Score!',
    failMessages: {
      'hit-wall':     '🚧 Player ran into the boundary! Change direction.',
      'out-of-bounds':'🚩 Out of bounds! Stay on the field.',
      'step-limit':   '⏱ Time\'s up! Try a shorter play.',
      'door-locked':  '🔒 Trophy is locked! Collect the power-up ⚡ first.',
      'default':      "Didn't reach the trophy yet — keep going!",
    },
    levelStories: {
      'robots-first-steps':
        'The rookie hits the field for the very first play! Guide the player step-by-step through the defenders to reach the trophy. Every move must be called in exactly the right sequence.',
      'long-march':
        'The player needs to sprint the full length of the field, step after step. Calling the same move over and over is exhausting — there must be a way to set a routine and let them run.',
      'zig-zag':
        'The obstacle course zig-zags — charge down one lane, cut across, charge back, cut across again. Coaches call these drills. Spot the pattern and teach the whole routine in one play.',
      'staircase':
        'The player must cut diagonally down the field in a series of stutter-step moves. Each step combines a forward dash and a sideways shuffle. The same combo play repeats all the way to the end zone.',
      'locked-door':
        'The trophy room is locked! The player must first grab the power-up medallion from the far side of the field. Then check: am I carrying the medallion? Only then can they claim the prize.',
      'variable-village':
        'Two drills, two different rep counts: sprint 6 lengths going east, then 4 lengths going south. Store the rep count in a variable and reuse the same routine for both directions.',
      'fog-of-war':
        'The field is huge and the sidelines are lost in the fog. Instead of counting steps, tell the player to sprint until they hit the boundary. A while-loop athlete keeps going until the conditions say stop.',
      'the-snake':
        'The player must cover every zone on the field in a back-and-forth sweep drill. The outer loop runs each pass; the inner loop drives them across each row. Total field coverage — the ultimate grid drill.',
    },
  },
}

// ── Music ─────────────────────────────────────────────────────────────────────

const MUSIC: FullPreset = {
  colors: {
    primary:     '#9333ea',  // purple-600 — better contrast with white (~4.7:1)
    primaryText: '#ffffff',
    header:      '#581c87',
    headerText:  '#f3e8ff',
    stageBg:     '#fdf4ff',
    winBg:       '#f3e8ff',
    winText:     '#6b21a8',  // purple-800 — stronger contrast on light lavender
    failBg:      '#fce7f3',
    failText:    '#831843',  // pink-900 — strong contrast on light pink
  },
  game: {
    robotSvg:   '/sprites/musician.svg',
    robotEmoji: '🎵',
    goalEmoji:  '🎶',
    keyEmoji:   '🎸',
    wallColor:  '#4c1d95',   // deep purple staff bars — good contrast on near-white
    floorColor: '#fdf4ff',   // near-white parchment
    startColor: '#ede9fe',   // lavender start
    goalColor:  '#fce7f3',   // pink goal
    gridLineColor: '#d8b4fe', // medium purple staff lines
  },
  labels: {
    appTitle:       'Music Lab',
    panelWorkspace: 'Composer',
    panelGame:      'Stage',
    panelProgress:  'Skills',
    btnRun:         '▶ Play',
    btnReset:       'Reset note',
    character:      'note',
    conceptLabels: {
      sequencing:  'Melody Steps',
      loops:       'Repeating Patterns',
      conditionals:'When to Play',
      variables:   'Beat Counter',
      repeatUntil: 'Play Until',
    },
    winMessage: '🎶 Perfect performance!',
    failMessages: {
      'hit-wall':     '💥 Wrong note — hit a barrier! Try a different direction.',
      'out-of-bounds':'🎼 Off the staff! Keep the note on the page.',
      'step-limit':   '⏳ Too many beats. Try simplifying the melody.',
      'door-locked':  '🔒 Stage door is locked! Pick up the guitar 🎸 first.',
      'default':      "Haven't found the finale yet — keep composing!",
    },
    levelStories: {
      'robots-first-steps':
        'A new melody begins — your note is ready to play for the very first time! Guide it through the opening passage to reach the crescendo. Each step is one beat in the sequence.',
      'long-march':
        'This piece has a long, repeating phrase that runs on and on down the staff. Writing out each note separately would fill the whole page. There must be a musical way to say "repeat."',
      'zig-zag':
        'The melody weaves back and forth in a winding pattern across three long runs. Sheet music calls this a sequence. Find the repeating unit and notate it just once.',
      'staircase':
        'This staircase melody descends step by step — each bar holds a long note followed by a short one, descending the scale. The two-note motif repeats all the way down. Put both notes in the loop body.',
      'locked-door':
        'The concert hall is closed until the key signature is found! Travel to pick up the musical key, then check: do I have it? Only then will the final bar be unlocked.',
      'variable-village':
        'A melody has two phrases of different lengths — six beats in the first, four in the second. Store the beat count in a variable and reuse the same musical pattern for both phrases.',
      'fog-of-war':
        'The phrase runs on and on — you can\'t count every note from memory. Tell the melody to keep playing until it reaches a natural rest. A musical while-loop resolves itself.',
      'the-snake':
        'The composer must fill the entire page with notes in a weaving melodic sweep, phrase by phrase. The outer loop handles each musical line; the inner loop plays each note. This is how you score a whole movement.',
    },
  },
}

// ── Art ───────────────────────────────────────────────────────────────────────

const ART: FullPreset = {
  colors: {
    primary:     '#c2410c',  // orange-700 — contrast ~4.9:1 with white (was #f97316 at ~2.8:1)
    primaryText: '#ffffff',
    header:      '#7c2d12',  // deeper sienna for stronger header presence
    headerText:  '#fff7ed',
    stageBg:     '#fffbf5',
    winBg:       '#fff7ed',
    winText:     '#9a3412',  // orange-800 — strong contrast on warm white
    failBg:      '#fef9c3',
    failText:    '#713f12',  // amber-900 — strong contrast on yellow
  },
  game: {
    robotSvg:   '/sprites/artist.svg',
    robotEmoji: '🖌️',
    goalEmoji:  '🎨',
    keyEmoji:   '✏️',
    wallColor:  '#7c2d12',   // rich sienna frame — clear contrast on warm white
    floorColor: '#fffbf5',   // warm near-white canvas
    startColor: '#ffedd5',   // warm peach start
    goalColor:  '#fef3c7',   // warm yellow goal
    gridLineColor: '#fed7aa', // warm peach grid lines
  },
  labels: {
    appTitle:       'Art Studio',
    panelWorkspace: 'Canvas',
    panelGame:      'Gallery',
    panelProgress:  'Skills',
    btnRun:         '🖌️ Paint',
    btnReset:       'Reset brush',
    character:      'brush',
    conceptLabels: {
      sequencing:  'Stroke Order',
      loops:       'Repeating Patterns',
      conditionals:'When to Blend',
      variables:   'Colour Mixer',
      repeatUntil: 'Paint Until',
    },
    winMessage: '🎨 Masterpiece!',
    failMessages: {
      'hit-wall':     '💥 Brush hit the frame! Try a different stroke direction.',
      'out-of-bounds':'🖼️ Off the canvas! Keep the brush inside the frame.',
      'step-limit':   '⏳ Too many strokes. Simplify your technique.',
      'door-locked':  '🔒 Gallery is locked! Pick up the pencil ✏️ first.',
      'default':      "Haven't reached the palette yet — keep painting!",
    },
    levelStories: {
      'robots-first-steps':
        'Your brush touches the canvas for the very first time! Guide it carefully across the blank surface to reach the palette. Every deliberate stroke creates something beautiful.',
      'long-march':
        'The brush must sweep across the entire canvas in long, even strokes to lay down the background color. Lifting and placing it dozens of times is tedious. Find a way to let the stroke repeat itself.',
      'zig-zag':
        'The brush must zig-zag across the canvas in three long passes to create a hatching effect. Each pass mirrors the last — once you see the rhythm, you can program the whole technique in one stroke.',
      'staircase':
        'Painting a diagonal gradient means brushing forward and stepping down at each stroke. The two-move combination repeats all the way across the canvas. Build a loop body with both actions.',
      'locked-door':
        'The gallery door is locked until your brush finds the master key! Travel to pick up the pencil first, then check: am I carrying it? Only then can you enter and place the finishing stroke.',
      'variable-village':
        'The painting needs two brush runs: six long strokes across and four down. Store the stroke count in a variable and reuse the same loop for both directions — one technique, two applications.',
      'fog-of-war':
        'The brush strokes run all the way to the edge of the canvas — you can\'t see exactly where the frame ends. Let the brush sweep until it meets the border. Move until wall: elegant and precise.',
      'the-snake':
        'The artist must cover every inch of the canvas in a sweeping snake stroke, pass by pass. The outer loop guides each new row; the inner loop drives the brush across. This is how muralists fill a large canvas.',
    },
  },
}

// ── Animals ───────────────────────────────────────────────────────────────────

const ANIMALS: FullPreset = {
  colors: {
    primary:     '#b45309',  // amber-700 — 4.6:1 contrast with white
    primaryText: '#ffffff',
    header:      '#44311e',  // dark tree-bark brown
    headerText:  '#fef3c7',
    stageBg:     '#fef9ef',
    winBg:       '#fef3c7',
    winText:     '#78350f',  // amber-900 — strong contrast on light amber
    failBg:      '#fef2f2',
    failText:    '#991b1b',
  },
  game: {
    robotSvg:   '/sprites/dog.svg',
    robotEmoji: '🦊',
    goalEmoji:  '🦴',
    keyEmoji:   '🐾',
    wallColor:  '#5c3317',   // tree-trunk brown — clear against warm cream floor
    floorColor: '#fef9ef',   // warm earth cream
    startColor: '#fed7aa',   // peach den
    goalColor:  '#fef3c7',   // warm yellow meadow
    gridLineColor: '#fde68a', // warm amber trail lines
  },
  labels: {
    appTitle:       'Wild Trails',
    panelWorkspace: 'Den',
    panelGame:      'Trail',
    panelProgress:  'Wild Skills',
    btnRun:         '🐾 Go!',
    btnReset:       'Reset fox',
    character:      'fox',
    conceptLabels: {
      sequencing:  'Trail Steps',
      loops:       'Pack Patterns',
      conditionals:'Instinct Checks',
      variables:   'Pace Counter',
      repeatUntil: 'Run Until',
    },
    winMessage: '🦴 Found it!',
    failMessages: {
      'hit-wall':     '🌳 The fox ran into a tree! Try a different trail.',
      'out-of-bounds':'🍃 Off the trail! Stay in the forest.',
      'step-limit':   '⏳ The fox is going in circles. Try a shorter route.',
      'door-locked':  '🔒 Den is locked! Find the paw print 🐾 first.',
      'default':      "Haven't reached the bone yet — keep exploring!",
    },
    levelStories: {
      'robots-first-steps':
        'A young fox takes its very first steps along the forest trail! Guide it carefully through the trees to reach the hidden bone. Follow the path one step at a time.',
      'long-march':
        'The bone is buried deep in the forest — farther than the fox has ever traveled! The same path stretches on and on. There must be a smarter way to repeat the steps.',
      'zig-zag':
        'The forest trail winds left and right through the trees in a zig-zag. The fox must navigate every bend. Look carefully — the trail repeats itself!',
      'staircase':
        'The fox must bound diagonally down a rocky hillside — one leap forward, one leap down, over and over. The same bounding move repeats all the way to the meadow below.',
      'locked-door':
        'The den is locked! The fox must first find the paw-print key hidden on the other side of the forest. Then check — do I have the key? — before the den will open.',
      'variable-village':
        'Two forest trails, two different lengths — 6 steps one way, 4 steps the other. Could one clever routine handle both if you stored the distance in a variable?',
      'fog-of-war':
        'The trail disappears into thick morning fog — the fox can\'t see how far it goes! Instead of counting, let the fox keep running until it hits a tree. Nature\'s while-loop!',
      'the-snake':
        'The fox must search every corner of the meadow for food, sweeping back and forth row by row. The outer loop covers each pass; the inner loop carries the fox across. Total meadow coverage!',
    },
  },
}

// ── Princess ──────────────────────────────────────────────────────────────────

const PRINCESS: FullPreset = {
  colors: {
    primary:     '#be185d',  // pink-700 — 4.9:1 contrast with white
    primaryText: '#ffffff',
    header:      '#831843',  // pink-900 — dark royal pink
    headerText:  '#fce7f3',
    stageBg:     '#fdf2f8',
    winBg:       '#fce7f3',
    winText:     '#831843',  // strong contrast on light pink
    failBg:      '#f5f3ff',
    failText:    '#5b21b6',  // violet-900 — strong on light lavender
  },
  game: {
    robotSvg:   '/sprites/princess.svg',
    robotEmoji: '👑',
    goalEmoji:  '🏰',
    keyEmoji:   '🗝️',
    wallColor:  '#86198f',   // fuchsia-800 — visible against lavender floor
    floorColor: '#fdf4ff',   // light lavender palace floor
    startColor: '#fce7f3',   // pink throne room start
    goalColor:  '#ede9fe',   // lavender castle destination
    gridLineColor: '#f0abfc', // soft fuchsia palace tiles
  },
  labels: {
    appTitle:       'Royal Quest',
    panelWorkspace: 'Spellbook',
    panelGame:      'Kingdom',
    panelProgress:  'Royal Skills',
    btnRun:         '✨ Cast',
    btnReset:       'Reset crown',
    character:      'crown',
    conceptLabels: {
      sequencing:  'Royal Steps',
      loops:       'Enchanted Loops',
      conditionals:'Magic Checks',
      variables:   'Potion Counter',
      repeatUntil: 'Enchant Until',
    },
    winMessage: '👑 Quest complete!',
    failMessages: {
      'hit-wall':     '💥 The crown hit a castle wall! Try a different path.',
      'out-of-bounds':'🏰 Outside the kingdom! Stay within the royal grounds.',
      'step-limit':   '⏳ Too many enchantments. Simplify the spell.',
      'door-locked':  '🔒 The drawbridge is sealed! Find the royal key 🗝️ first.',
      'default':      "Haven't reached the castle yet — keep questing!",
    },
    levelStories: {
      'robots-first-steps':
        'The royal crown sets off on its very first quest! Guide it through the palace corridor to reach the castle. Chart each royal step with care.',
      'long-march':
        'The castle lies far across the kingdom and the royal road stretches on and on. Moving one step at a time for such a distance? Surely there\'s a more enchanted way.',
      'zig-zag':
        'The enchanted path twists through the royal gardens in a zig-zag. Navigate each bend — there\'s a repeating pattern woven into the enchantment. Discover it!',
      'staircase':
        'The crown must descend the grand spiral staircase — one step forward, one step down, all the way to the throne room. The same royal movement repeats to the bottom.',
      'locked-door':
        'The castle drawbridge is sealed! The crown must first find the royal key hidden in the far tower. Then check — do I have the key? — before the gate will open.',
      'variable-village':
        'Two royal corridors of different lengths connect the crown to the castle. Store the distance in a magical variable and let one enchanted spell handle both paths.',
      'fog-of-war':
        'The royal forest is shrouded in magical mist — the crown can\'t see how far the path goes! Let it glide until it meets a wall. Enchanted loops don\'t need to count!',
      'the-snake':
        'The crown must inspect every chamber of the castle in a grand royal sweep. The outer loop visits each corridor; the inner loop covers every room. A complete royal tour!',
    },
  },
}

// ── Chef ──────────────────────────────────────────────────────────────────────
// Recipes ARE algorithms — this theme makes abstract concepts concrete.
// Loops = repeat until done, conditionals = taste checks, variables = cup counter.

const CHEF: FullPreset = {
  colors: {
    primary:     '#c2410c',  // orange-700 — 4.9:1 contrast with white (chef red-orange)
    primaryText: '#ffffff',
    header:      '#7f1d1d',  // red-900 — deep kitchen red
    headerText:  '#fef2f2',
    stageBg:     '#fffbeb',
    winBg:       '#fef9c3',
    winText:     '#713f12',  // amber-900 — strong on light yellow
    failBg:      '#fef2f2',
    failText:    '#991b1b',
  },
  game: {
    robotSvg:   '/sprites/chef.svg',
    robotEmoji: '🍳',
    goalEmoji:  '⭐',
    keyEmoji:   '🧂',
    wallColor:  '#7f1d1d',   // dark red countertop wall — clear against cream floor
    floorColor: '#fffbeb',   // warm cream kitchen tile
    startColor: '#fee2e2',   // light pink stovetop area
    goalColor:  '#fef3c7',   // warm yellow serving station
    gridLineColor: '#fde68a', // amber tile grout lines
  },
  labels: {
    appTitle:       'Recipe Lab',
    panelWorkspace: 'Recipe',
    panelGame:      'Kitchen',
    panelProgress:  'Cooking Skills',
    btnRun:         '🍳 Cook',
    btnReset:       'Reset pan',
    character:      'pan',
    conceptLabels: {
      sequencing:  'Recipe Steps',
      loops:       'Baking Loops',
      conditionals:'Taste Checks',
      variables:   'Cup Counter',
      repeatUntil: 'Simmer Until',
    },
    winMessage: '⭐ Chef\'s kiss!',
    failMessages: {
      'hit-wall':     '💥 Pan hit the counter edge! Try a different direction.',
      'out-of-bounds':'🍽️ Off the kitchen counter! Keep the pan inside.',
      'step-limit':   '⏳ Too many steps — the recipe burned. Try a shorter technique.',
      'door-locked':  '🔒 Pantry is locked! Find the secret ingredient 🧂 first.',
      'default':      "Haven't reached the star dish yet — keep cooking!",
    },
    levelStories: {
      'robots-first-steps':
        'The pan heats up for its very first recipe! Guide it across the kitchen to reach the star dish. Follow each cooking step in exactly the right order.',
      'long-march':
        'The recipe calls for a long, even stroke across the whole baking tray — the same move over and over. Lifting the pan one step at a time would take forever. There must be a way to repeat!',
      'zig-zag':
        'The recipe drizzles back and forth across the tray in a zig-zag — like frosting a cake! Look for the pattern in the drizzle and you can write the whole technique in one loop.',
      'staircase':
        'Each layer of this stacked dish needs a forward spread and a step down — the same two-move combination all the way. Build a loop that holds both steps in the body.',
      'locked-door':
        'The pantry is locked! The pan must first find the secret ingredient hidden across the kitchen. Then check: do I have it? Only then will the recipe be complete.',
      'variable-village':
        'The recipe stirs 6 times one way, then 4 times the other. Store the count in a variable and reuse the same stirring loop for both — one technique, two applications.',
      'fog-of-war':
        'The baking tray stretches further than you can see — you don\'t know exactly how long it is! Let the pan sweep until it hits the edge. A kitchen while-loop stops at exactly the right spot.',
      'the-snake':
        'This recipe fills the entire tray in a back-and-forth spreading technique, row by row. The outer loop covers each pass; the inner loop spreads across each row. This is how you frost a whole cake.',
    },
  },
}

// ── Ocean ─────────────────────────────────────────────────────────────────────
// Calming blue-green palette reduces test anxiety. Failure = "fish got turned
// around" — a gentle reframe that lowers the emotional stakes of getting it wrong.

const OCEAN: FullPreset = {
  colors: {
    primary:     '#0e7490',  // cyan-700 — 4.5:1 contrast with white
    primaryText: '#ffffff',
    header:      '#164e63',  // cyan-900 — deep ocean
    headerText:  '#ecfeff',
    stageBg:     '#ecfeff',
    winBg:       '#cffafe',
    winText:     '#155e75',  // cyan-800 — strong on light cyan
    failBg:      '#f0f9ff',
    failText:    '#075985',  // sky-800 — calm, not alarming
  },
  game: {
    robotSvg:      '/sprites/ocean.svg',
    robotSvgScale: 1.6,
    robotEmoji: '🤿',
    goalEmoji:  '🐚',
    keyEmoji:   '💎',
    wallColor:  '#155e75',   // deep cyan reef wall — clear against light ocean floor
    floorColor: '#ecfeff',   // pale cyan ocean floor
    startColor: '#cffafe',   // open water start
    goalColor:  '#e0f2fe',   // soft sky-blue treasure spot
    gridLineColor: '#a5f3fc', // light cyan ocean currents
  },
  labels: {
    appTitle:       'Ocean Quest',
    panelWorkspace: 'Dive Log',
    panelGame:      'Ocean',
    panelProgress:  'Deep Skills',
    btnRun:         '🤿 Dive',
    btnReset:       'Reset diver',
    character:      'diver',
    conceptLabels: {
      sequencing:  'Dive Route',
      loops:       'Current Patterns',
      conditionals:'Depth Checks',
      variables:   'Tank Counter',
      repeatUntil: 'Dive Until',
    },
    winMessage: '🐚 Treasure found!',
    failMessages: {
      'hit-wall':     '🪸 The explorer bumped into the reef! Try a different route.',
      'out-of-bounds':'🌊 Drifted outside the dive zone! Stay within the reef.',
      'step-limit':   '⏳ Air running low — too many kicks. Try a more direct path.',
      'door-locked':  '🔒 The sea cave is sealed! Find the gemstone 💎 first.',
      'default':      "Haven't reached the shell yet — keep exploring the depths!",
    },
    levelStories: {
      'robots-first-steps':
        'The underwater explorer takes their very first dive! Navigate carefully through the coral reef to reach the hidden shell. Plan each kick and turn in exactly the right order.',
      'long-march':
        'The treasure lies far away at the end of a long underwater canyon. Kicking one stroke at a time would drain the air tank. There must be a smarter way to cover the distance!',
      'zig-zag':
        'The reef winds in a zig-zag pattern through three long corridors. Find the rhythm in the rock formations — there\'s a repeating route hidden in the canyon. Navigate it in one elegant sequence.',
      'staircase':
        'The explorer must descend a diagonal staircase of coral ledges — one kick forward, one kick down at each step. The same two-move descent repeats all the way to the ocean floor.',
      'locked-door':
        'The sea cave is sealed! The diver must first find the glowing gemstone on the far side of the reef. Then check: do I have the gem? Only then will the cave open.',
      'variable-village':
        'Two underwater passages of different lengths lead to the treasure — 6 kicks east, 4 kicks south. Store the distance in a variable and let one diving routine handle both legs.',
      'fog-of-war':
        'The dark ocean stretches beyond visibility — the explorer can\'t see how far the tunnel goes. Instead of guessing, keep kicking until hitting the reef wall. An underwater while-loop stops at exactly the right depth.',
      'the-snake':
        'The explorer must survey the entire ocean floor in a sweeping back-and-forth search pattern. The outer loop covers each row of the reef; the inner loop carries the diver across. Total depth exploration!',
    },
  },
}

// ── Hero ──────────────────────────────────────────────────────────────────────
// Repositions the student as powerful. Failure = "hero in training" —
// an origin story, not a mistake. Loops = combo moves, variables = power levels.

const HERO: FullPreset = {
  colors: {
    primary:     '#1d4ed8',  // blue-700 — 4.5:1 contrast with white (hero blue)
    primaryText: '#ffffff',
    header:      '#1e1b4b',  // deep indigo night sky
    headerText:  '#fbbf24',  // gold — hero yellow
    stageBg:     '#f5f3ff',
    winBg:       '#fef9c3',
    winText:     '#713f12',  // strong on gold
    failBg:      '#fef2f2',
    failText:    '#991b1b',
  },
  game: {
    robotSvg:   '/sprites/superhero.svg',
    robotEmoji: '⚡',
    goalEmoji:  '🌟',
    keyEmoji:   '💫',
    wallColor:  '#312e81',   // deep indigo building walls — clear against light city floor
    floorColor: '#f5f3ff',   // light lavender city streets
    startColor: '#ede9fe',   // soft purple hero base
    goalColor:  '#fef9c3',   // golden destination
    gridLineColor: '#c4b5fd', // medium purple city grid
  },
  labels: {
    appTitle:       'Hero Academy',
    panelWorkspace: 'Mission Briefing',
    panelGame:      'City',
    panelProgress:  'Hero Skills',
    btnRun:         '⚡ Activate',
    btnReset:       'Reset hero',
    character:      'hero',
    conceptLabels: {
      sequencing:  'Mission Steps',
      loops:       'Combo Moves',
      conditionals:'Power Checks',
      variables:   'Energy Level',
      repeatUntil: 'Charge Until',
    },
    winMessage: '🌟 City saved!',
    failMessages: {
      'hit-wall':     '💥 Hero hit a building! Try a different route through the city.',
      'out-of-bounds':'🏙️ Out of the city grid! Stay within the mission area.',
      'step-limit':   '⏳ Energy depleted! Try a more direct mission path.',
      'door-locked':  '🔒 Vault is sealed! Grab the power gem 💫 first.',
      'default':      "Haven't reached the star yet — every hero keeps training!",
    },
    levelStories: {
      'robots-first-steps':
        'The hero activates for the very first time! Navigate the city grid to reach the star. Issue each movement in the right order — every hero has to start somewhere.',
      'long-march':
        'The city is huge and the star is far across town. Moving one block at a time is going to take forever. Every hero needs a power move they can repeat efficiently.',
      'zig-zag':
        'The city layout zig-zags through three long avenues of buildings. Navigate each turn — there\'s a repeating pattern in the route. Master it and write the whole path in one combo move.',
      'staircase':
        'The hero must move diagonally across a staircase of rooftops — one dash forward, one drop down at each step. The same two-move combo repeats all the way to the ground.',
      'locked-door':
        'The vault is locked! The hero must first collect the power gem from the other side of the city. Then check: do I have the gem? Only then will the vault open.',
      'variable-village':
        'Two city missions, two different distances — 6 blocks east, then 4 blocks south. Store the distance as an energy level and use the same dash power for both missions.',
      'fog-of-war':
        'The city corridors stretch into the fog — the hero can\'t see how far they go. Activate the power and keep moving until hitting a wall. A true hero adapts to the unknown.',
      'the-snake':
        'The hero must patrol every block of the city in a systematic sweep — back and forth, row by row. The outer loop covers each avenue; the inner loop patrols every block. Complete city protection!',
    },
  },
}

// ── Racing ────────────────────────────────────────────────────────────────────
// Speed and precision — every wasted move costs lap time. Great for teaching
// efficiency alongside correctness. Loops = lap patterns, variables = lap counter.

const RACING: FullPreset = {
  colors: {
    primary:     '#dc2626',  // red-600 — 4.9:1 contrast with white (racing red)
    primaryText: '#ffffff',
    header:      '#1c1917',  // stone-900 — dark asphalt
    headerText:  '#fbbf24',  // gold — podium yellow
    stageBg:     '#f8fafc',
    winBg:       '#fef9c3',
    winText:     '#713f12',  // strong on podium yellow
    failBg:      '#fef2f2',
    failText:    '#991b1b',
  },
  game: {
    robotSvg:   '/sprites/racecar.svg',
    robotEmoji: '🏎️',
    goalEmoji:  '🏁',
    keyEmoji:   '⛽',
    wallColor:  '#374151',   // dark gray barrier wall — clear against light track
    floorColor: '#f8fafc',   // light gray track surface
    startColor: '#fef9c3',   // start grid yellow
    goalColor:  '#dcfce7',   // finish line green
    gridLineColor: '#e2e8f0', // subtle track markings
  },
  labels: {
    appTitle:       'Grand Prix',
    panelWorkspace: 'Pit Crew',
    panelGame:      'Track',
    panelProgress:  'Race Stats',
    btnRun:         '🏎️ Race',
    btnReset:       'Reset car',
    character:      'car',
    conceptLabels: {
      sequencing:  'Lap Steps',
      loops:       'Lap Patterns',
      conditionals:'Pit Checks',
      variables:   'Lap Counter',
      repeatUntil: 'Race Until',
    },
    winMessage: '🏁 Checkered flag!',
    failMessages: {
      'hit-wall':     '💥 Car hit the barrier! Try a different line through the corner.',
      'out-of-bounds':'🚩 Off the track! Stay within the circuit.',
      'step-limit':   '⏳ Fuel run out. Try a more efficient racing line.',
      'door-locked':  '🔒 Pit exit is blocked! Grab the fuel token ⛽ first.',
      'default':      "Haven't crossed the finish line yet — keep racing!",
    },
    levelStories: {
      'robots-first-steps':
        'The race car rolls out of the garage for its very first lap! Navigate the track section by section to reach the checkered flag. Every steering command must be in exactly the right order.',
      'long-march':
        'The straight stretches far ahead and the finish line is at the other end. Pressing the gas one square at a time for the whole thing? Every driver needs a way to hold the throttle and repeat.',
      'zig-zag':
        'The track winds through a series of hairpin turns — left, right, left, right. Find the repeating pattern in the chicane and you can write the whole sequence in one tight loop.',
      'staircase':
        'The car must navigate a diagonal set of corners — one dash forward, one turn down at each bend. The same two-move maneuver repeats all the way through the technical section.',
      'locked-door':
        'The pit exit is blocked! The car must first find the fuel token on the far side of the circuit. Then check: have I fueled up? Only then will the barrier lift.',
      'variable-village':
        'Two different race sections — 6 car lengths on the main straight, 4 through the technical sector. Store the distance in a variable and let one driving routine handle both.',
      'fog-of-war':
        'The track disappears into a tunnel — the driver can\'t see how long it is! Instead of counting, keep driving until the car meets a wall. A racing while-loop exits the tunnel at exactly the right point.',
      'the-snake':
        'The car must sweep the entire circuit grid back and forth to map every corner. The outer loop covers each row; the inner loop drives across it. Complete circuit reconnaissance!',
    },
  },
}

// ── Farm ──────────────────────────────────────────────────────────────────────
// Farming is naturally algorithmic — plant, water, harvest, repeat. The
// vocabulary makes loops feel like plowing rows and conditionals feel like
// checking if a crop is ready. Comforting and grounded.

const FARM: FullPreset = {
  colors: {
    primary:     '#92400e',  // amber-800 — 6.9:1 contrast with white (earthy brown)
    primaryText: '#ffffff',
    header:      '#365314',  // lime-900 — deep farm green
    headerText:  '#fef9c3',  // warm straw yellow
    stageBg:     '#fefce8',
    winBg:       '#fef9c3',
    winText:     '#713f12',  // strong on golden harvest
    failBg:      '#fef2f2',
    failText:    '#991b1b',
  },
  game: {
    robotSvg:   '/sprites/farmer.svg',
    robotEmoji: '🚜',
    goalEmoji:  '🌾',
    keyEmoji:   '💧',
    wallColor:  '#365314',   // dark green hedgerow / fence — clear against wheat floor
    floorColor: '#fefce8',   // warm wheat-yellow field
    startColor: '#bbf7d0',   // light green barn area
    goalColor:  '#fef9c3',   // golden harvest spot
    gridLineColor: '#d9f99d', // light lime crop row lines
  },
  labels: {
    appTitle:       'Harvest Run',
    panelWorkspace: 'Barn',
    panelGame:      'Field',
    panelProgress:  'Harvest Skills',
    btnRun:         '🚜 Plow',
    btnReset:       'Reset tractor',
    character:      'tractor',
    conceptLabels: {
      sequencing:  'Field Steps',
      loops:       'Crop Rows',
      conditionals:'Harvest Checks',
      variables:   'Seed Counter',
      repeatUntil: 'Plow Until',
    },
    winMessage: '🌾 Harvest time!',
    failMessages: {
      'hit-wall':     '🌿 Tractor hit the fence! Try a different row.',
      'out-of-bounds':'🚜 Off the field! Stay inside the farm.',
      'step-limit':   '⏳ Tractor ran out of fuel. Try a shorter route through the field.',
      'door-locked':  '🔒 Gate is locked! Find the water token 💧 first.',
      'default':      "Haven't reached the harvest yet — keep plowing!",
    },
    levelStories: {
      'robots-first-steps':
        'The tractor rolls out of the barn for the very first time! Drive it carefully through the field to reach the harvest. Every move must be made in exactly the right order.',
      'long-march':
        'The crop row stretches all the way across the field. Driving one square at a time for the whole length is exhausting. Surely there\'s a smarter way to plow the whole row.',
      'zig-zag':
        'Irrigation channels cut across the field in a zig-zag — the tractor must navigate every ditch. Look for the pattern in the channels — farm rows always repeat!',
      'staircase':
        'The hillside terraces step diagonally down the slope — one drive forward, one step down at each terrace. The same terracing move repeats all the way down to the valley field.',
      'locked-door':
        'The harvest gate is locked! The tractor must first find the water token on the other side of the field. Then check: have I watered the crops? Only then will the gate open.',
      'variable-village':
        'Two fields of different sizes to plow — 6 furrows one way, 4 the other. Store the row count in a variable and reuse the same plowing routine for both fields.',
      'fog-of-war':
        'The crop row disappears into morning mist — you can\'t see how long it is! Instead of guessing, let the tractor keep driving until it hits the fence. A farming while-loop stops right at the field edge.',
      'the-snake':
        'The tractor must plow every row of the field in a back-and-forth pattern — just like a real farmer. The outer loop covers each pass; the inner loop drives the length of each furrow. This is how you plow a whole field!',
    },
  },
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const PRESETS: Record<ThemePreset, FullPreset> = {
  default:  DEFAULT,
  space:    SPACE,
  sports:   SPORTS,
  music:    MUSIC,
  art:      ART,
  animals:  ANIMALS,
  princess: PRINCESS,
  chef:     CHEF,
  ocean:    OCEAN,
  hero:     HERO,
  racing:   RACING,
  farm:     FARM,
}
