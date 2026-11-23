// The lessons: short guided pages that teach a sensor before the missions that need it. Each page
// can show a picture of blocks (drawn by Blockly), offer "Show me" to load a whole program, and list
// "your turn" tasks that tick themselves off as the student builds.
// In the text, **double stars** make a word bold (a block's or a category's name).

import { hole, indexAfter, slot, uses, type BlockJson } from './program'

export interface LessonTask {
  text: string
  /** done yet? Looks at the blocks under "when started". */
  done: (main: BlockJson[]) => boolean
}

export interface LessonPage {
  title: string
  text: string[]
  /** a picture of these blocks (Blockly's JSON for the top block) */
  picture?: BlockJson
  /** the picture is a whole program: "Show me" puts it in the editor */
  showMe?: boolean
  tasks?: LessonTask[]
  /** readings to look at while on this page */
  watch?: ('distance' | 'ir')[]
}

// ---------------------------------------------------------------- blocks, as Blockly JSON
const n = (v: number) => ({ shadow: { type: 'math_number', fields: { NUM: v } } })
const blk = (type: string, rest: Partial<BlockJson> = {}): BlockJson => ({ type, ...rest })
/** blocks clipped one under the other, as a slot's contents */
const chain = (...bs: BlockJson[]) => (bs.length ? { block: bs.reduceRight((next, b) => ({ ...b, next: { block: next } })) } : {})
const start = (...bs: BlockJson[]) => blk('rover_start', { inputs: { DO: chain(...bs) } })
const forever = (...bs: BlockJson[]) => blk('rover_forever', { inputs: { DO: chain(...bs) } })
const drive = (speed: number) => blk('rover_drive', { fields: { DIR: 'fwd' }, inputs: { SPEED: n(speed) } })
const spin = (dir: 'left' | 'right', speed: number) => blk('rover_spin', { fields: { DIR: dir }, inputs: { SPEED: n(speed) } })
const motors = (l: number, r: number) => blk('rover_motors', { inputs: { LEFT: n(l), RIGHT: n(r) } })
const stop = () => blk('rover_stop')
const distance = () => blk('rover_distance')
const less = (a: BlockJson, v: number) => blk('logic_compare', { fields: { OP: 'LT' }, inputs: { A: { block: a }, B: n(v) } })
const line = (side: 'left' | 'right') => blk('rover_line', { fields: { SIDE: side } })
const or = (a: BlockJson, b: BlockJson) => blk('logic_operation', { fields: { OP: 'OR' }, inputs: { A: { block: a }, B: { block: b } } })
const waitUntil = (cond: BlockJson) => blk('rover_wait_until', { inputs: { COND: { block: cond } } })
const ifElse = (cond: BlockJson, yes: BlockJson[], no: BlockJson[]) =>
  blk('controls_if', { extraState: { hasElse: true }, inputs: { IF0: { block: cond }, DO0: chain(...yes), ELSE: chain(...no) } })
const ifElseIf = (c0: BlockJson, d0: BlockJson[], c1: BlockJson, d1: BlockJson[], no: BlockJson[]) =>
  blk('controls_if', {
    extraState: { elseIfCount: 1, hasElse: true },
    inputs: { IF0: { block: c0 }, DO0: chain(...d0), IF1: { block: c1 }, DO1: chain(...d1), ELSE: chain(...no) },
  })

// ---------------------------------------------------------------- checks for "your turn"
const isDriveForward = (b: BlockJson) => b.type === 'rover_drive' && b.fields?.DIR !== 'back'
const isWaitFor = (sensor: string) => (b: BlockJson) => b.type === 'rover_wait_until' && uses(hole(b, 'COND'), sensor)
const isStop = (b: BlockJson) => b.type === 'rover_stop'
/** drive forward, wait until <a question about this sensor>, stop: in that order */
function driveWaitStop(sensor: string, question: string): LessonTask[] {
  const waitAt = (m: BlockJson[]) => indexAfter(m, m.findIndex(isDriveForward), isWaitFor(sensor))
  return [
    { text: 'Put **drive forward at speed** under **when started**.', done: (m) => m.some(isDriveForward) },
    { text: `Under it, **wait until** with ${question}.`, done: (m) => waitAt(m) >= 0 },
    { text: 'Last, **stop**.', done: (m) => indexAfter(m, waitAt(m), isStop) >= 0 },
  ]
}

const TURNS = ['rover_spin', 'rover_spin_for', 'rover_motors']
const DRIVES = ['rover_drive', 'rover_drive_for', 'rover_motors']
const foreverIn = (m: BlockJson[]) => m.find((b) => b.type === 'rover_forever')
const distanceIf = (m: BlockJson[]) => slot(foreverIn(m), 'DO').find((b) => b.type === 'controls_if' && uses(hole(b, 'IF0'), 'rover_distance'))

// ---------------------------------------------------------------- the ultrasonic sensor
export const LESSON_ULTRASONIC: LessonPage[] = [
  {
    title: 'Eyes that use sound',
    watch: ['distance'],
    text: [
      'The ultrasonic sensor is the pair of round “eyes” on the front of the rover.',
      'One eye sends out a very short, very high beep, too high for people to hear. The other eye listens for the echo that bounces back off a wall or a box.',
      'The further away the wall is, the longer the echo takes to come back. The Arduino times it and works out the distance in centimetres.',
      'In the 3D view, the green wedge in front of the rover is the beep, and the red dot is where it bounces back. **Distance**, in the readings below, is what the sensor measures right now.',
    ],
  },
  {
    title: 'The distance block',
    picture: distance(),
    watch: ['distance'],
    text: [
      'In blocks, the sensor is the green **distance (cm)** block, in **Sensors**.',
      'It is a number: what the sensor measures at that moment, like 85 or 12. With nothing in front of it within 4 m, it says 999.',
      'Its round ends mean it fits inside another block, not under one. On its own it does nothing: you use the number to make a decision.',
    ],
  },
  {
    title: 'Ask a yes-or-no question',
    picture: less(distance(), 20),
    text: [
      'A decision needs a yes-or-no question, like: **is the distance less than 20?**',
      'The compare block in **Logic** asks it. Put **distance (cm)** in its left side, choose **<**, and type 20 on the right.',
      'The answer is **true** while the wall is closer than 20 cm, and **false** while it is further away.',
    ],
  },
  {
    title: 'Drive until the wall is close',
    picture: start(drive(150), waitUntil(less(distance(), 20)), stop()),
    showMe: true,
    text: [
      '**drive forward** switches the motors on, and they keep going.',
      '**wait until** asks its question again and again, many times a second. While the answer is false, the rover keeps driving. As soon as it is true, the program moves on to the next block: **stop**.',
      'Build it yourself, or press **Show me**. Tip: **wait until distance (cm) < 20** is ready-made at the bottom of **Sensors**.',
    ],
    tasks: driveWaitStop('rover_distance', 'the question **distance (cm) < 20**'),
  },
  {
    title: 'Run it',
    watch: ['distance'],
    text: [
      'Press **Run** and watch **Distance** go down as the rover drives in.',
      'A moving rover needs a moment to stop, so it rolls on a little after the sensor says “less than 20”. Stopped too close? Drive slower, or stop at a bigger number.',
      'Next, in **Stop at the wall**, the wall moves every run. Timing can’t win there, but your sensor program will.',
    ],
  },
]

// ---------------------------------------------------------------- deciding again and again
export const LESSON_DECIDE: LessonPage[] = [
  {
    title: 'Again and again',
    picture: forever(),
    text: [
      '**wait until** waits for one thing, once. To drive around a room, the rover has to keep looking and keep deciding for as long as it runs.',
      'The **forever** block, in **Control**, does that. It runs the blocks inside it, then goes back to the top and runs them again, over and over. On the Arduino this is **loop()**.',
    ],
  },
  {
    title: 'If … else',
    picture: ifElse(less(distance(), 40), [spin('left', 170)], [drive(170)]),
    text: [
      '**if** asks a question and picks one of two paths.',
      'When the answer is **true** (a wall is close), it runs the blocks in **do**. When it is **false**, it runs the blocks in **else**.',
      '**if … else** with a distance question is ready-made at the bottom of **Sensors**. The plain **if** in **Control** can get an **else** too: click its gear ⚙ and drag **else** in.',
    ],
  },
  {
    title: 'Turn away from walls',
    picture: start(forever(ifElse(less(distance(), 40), [spin('left', 170)], [drive(170)]))),
    showMe: true,
    text: [
      'Put the **if … else** inside **forever**. Each time round, the rover takes a fresh look: a wall ahead, turn; nothing there, drive on.',
      'Build it yourself, or press **Show me**.',
    ],
    tasks: [
      { text: 'A **forever** under **when started**.', done: (m) => !!foreverIn(m) },
      { text: 'Inside it, an **if … else** that asks about **distance (cm)**.', done: (m) => !!distanceIf(m)?.extraState?.hasElse },
      {
        text: 'Turn in its **do** slot, drive forward in **else**.',
        done: (m) => {
          const f = distanceIf(m)
          return !!f && slot(f, 'DO0').some((b) => TURNS.includes(b.type)) && slot(f, 'ELSE').some((b) => DRIVES.includes(b.type))
        },
      },
    ],
  },
  {
    title: 'Run it',
    watch: ['distance'],
    text: [
      'Press **Run**. The rover turns away from every wall it meets.',
      'The sensor only looks straight ahead. If a corner of the rover catches a wall, turn earlier: try 50 instead of 40.',
      'Next, **Don’t crash** uses the same idea in a room full of boxes.',
    ],
  },
]

// ---------------------------------------------------------------- the IR line sensors
export const LESSON_IR: LessonPage[] = [
  {
    title: 'Eyes that look down',
    watch: ['ir'],
    text: [
      'Under the front of the rover are two IR line sensors, one on the left and one on the right.',
      'Each one shines invisible infrared light down at the floor and measures how much bounces back. A light floor sends lots of it back; black tape soaks most of it up. So each sensor can tell: floor, or line?',
      'In the 3D view, the two dots under the front of the rover show what they see: green over the floor, orange over the line. **IR left** and **IR right**, in the readings below, say the same.',
    ],
  },
  {
    title: 'A yes-or-no block',
    picture: line('left'),
    watch: ['ir'],
    text: [
      'In blocks, each sensor is the green **IR sensor sees the line** block, in **Sensors**. Choose **left** or **right** in its menu.',
      'This block is already a yes-or-no question: **true** over the line, **false** over the floor. So it goes straight into **wait until** or **if**, with no compare block.',
    ],
  },
  {
    title: 'Either sensor',
    picture: or(line('left'), line('right')),
    text: [
      'The rover may meet the line a little crooked, so one sensor gets there first.',
      'To react to either one, join two questions with **or**, from **Logic**. The answer is true when the left sensor **or** the right sensor (or both) sees the line.',
    ],
  },
  {
    title: 'Stop on the line',
    picture: start(drive(120), waitUntil(or(line('left'), line('right'))), stop()),
    showMe: true,
    text: [
      'The same pattern as with distance: drive, **wait until** a sensor sees the line, then **stop**.',
      'Drive slowly. Each sensor looks at one small spot, and a fast rover rolls past the line before it stops.',
      'Build it yourself, or press **Show me**. Tip: **wait until … or …** is ready-made at the bottom of **Sensors**.',
    ],
    tasks: driveWaitStop('rover_line', 'an **IR sensor sees the line** question'),
  },
  {
    title: 'Run it, then follow a line',
    picture: start(forever(ifElseIf(line('left'), [motors(-60, 170)], line('right'), [motors(170, -60)], [drive(150)]))),
    watch: ['ir'],
    text: [
      'Press **Run**: the rover stops with its sensors on the line.',
      'Following a line uses the same blocks inside **forever**. The sensors sit either side of the line. If the left one sees it, the line has drifted left, so steer left. If the right one sees it, steer right. Otherwise, drive straight on.',
      'To steer, **set motors** runs the two sides at different speeds. You will build this in **Follow the line**. First, **Stay in the ring** works like “Look and decide”, with an IR question in the **if**.',
    ],
  },
]
