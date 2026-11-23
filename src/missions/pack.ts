// The mission pack: 17 missions and 3 lessons in 5 chapters, plus the sandbox.
// Units are scene units (1 = 10 cm). Heading 0 faces +x; forward is (cos h, -sin h), so +pi/2 faces -z
// ("up" in the top view) and the rover's left is -z when it faces +x.

import { GEOM, ROOM, TAPE_WIDTH, TRACK, distToTrack, sim, trackPoint, type Box, type World, type Zone } from '../sim/sim'
import type { Check, CheckState, Mission } from './missions'
import { LESSON_DECIDE, LESSON_IR, LESSON_ULTRASONIC } from './lessons'

// ---------------------------------------------------------------- helpers
const GREEN = '#2f9e6e'
const YELLOW = '#d99a1e'
const BLUE = '#3b7fc4'
const RED = '#d8392b'
const PURPLE = '#7a5bb3'

const room = (w: number, d: number, extra: Partial<World>): World => ({ w, d, boxes: [], tapes: [], zones: [], start: [0, 0, 0], ...extra })
const box = (x: number, z: number, w: number, d: number, h = 1.2): Box => ({ x, z, w, d, h })
const zone = (id: string, x: number, z: number, w: number, d: number, color: string, label?: string): Zone => ({ id, x, z, w, d, color, label })
const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** Start on a tape at point i, facing along it, with the IR sensors either side of the line. */
function onLine(points: [number, number][], i: number): [number, number, number] {
  const [x0, z0] = points[i]
  const [x1, z1] = points[i + 1]
  const h = Math.atan2(-(z1 - z0), x1 - x0)
  return [x0 - Math.cos(h) * GEOM.irAhead, z0 + Math.sin(h) * GEOM.irAhead, h]
}
function circle(r: number, n = 240): [number, number][] {
  return Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * Math.PI * 2), r * Math.sin((i / n) * Math.PI * 2)])
}
/** a gentle S-shaped line from x = -12 to x = 10 */
const sLine = (amp = 2.6): [number, number][] =>
  Array.from({ length: 221 }, (_, i) => {
    const x = -12 + i * 0.1
    return [x, amp * Math.sin(((x + 12) / 22) * Math.PI * 2)]
  })
/** a short crossbar across a line at point i (both sensors see it at once) */
function crossbar(points: [number, number][], i: number, half = 1.3): [number, number][] {
  const [x0, z0] = points[i - 1]
  const [x1, z1] = points[i + 1]
  const len = Math.hypot(x1 - x0, z1 - z0)
  const nx = -(z1 - z0) / len
  const nz = (x1 - x0) / len
  const [x, z] = points[i]
  return [
    [x - nx * half, z - nz * half],
    [x + nx * half, z + nz * half],
  ]
}

/** the rover has come to rest after moving off */
const settled = (s: CheckState) => s.time > 0.3 && s.stoppedFor > 0.4
const noBumps = (s: CheckState): Check => (s.bumps ? { fail: 'The rover bumped into something.' } : null)
/** stop 10–25 cm in front of the wall, without touching it */
const stopAtWall: Mission['check'] = () => (s) => {
  if (s.bumps) return { fail: 'The rover hit the wall.' }
  if (settled(s) && s.cm >= 10 && s.cm <= 25) return { pass: `Stopped ${s.cm} cm from the wall.` }
  if (s.programDone && s.stoppedFor > 0.6)
    return { fail: s.time < 0.5 ? 'The rover did not move.' : `Stopped ${s.cm >= 999 ? 'far' : s.cm + ' cm'} from the wall: aim for 10–25 cm.` }
  return null
}
/** where the line crosses the floor in the IR lesson */
const STOP_LINE = 4

// toolboxes grow chapter by chapter
const T1 = ['rover_start', 'rover_drive_for', 'rover_spin_for', 'rover_drive', 'rover_spin', 'rover_stop', 'rover_wait']
const T1R = [...T1, 'controls_repeat_ext']
const T2 = [...T1R, 'rover_motors', 'rover_timer', 'rover_wait_until', 'logic_compare', 'math_number', 'controls_if']
const T3 = [...T2, 'rover_distance', 'rover_forever', 'controls_whileUntil', 'logic_operation', 'logic_negate', 'math_arithmetic', 'variables']
const T4 = [...T3, 'rover_line']

// ---------------------------------------------------------------- the pack
export const MISSIONS: Mission[] = [
  {
    id: 'sandbox',
    chapter: 'Free play',
    title: 'Sandbox',
    brief: 'The Drive tab’s room, with every block. Try anything: there is no goal and no clock.',
    goal: 'Build whatever you like and press Run.',
    world: () => ROOM,
    toolbox: 'all',
    hints: ['Start with a “drive forward for 1 second” block under “when started”.'],
    timeLimit: Infinity,
    check: null,
    stars: [],
  },

  // ======================================================== 1. First moves
  {
    id: 'first-drive',
    chapter: 'First moves',
    title: 'First drive',
    brief: 'Your rover is parked at the start line. Drive it forwards and stop it in the green parking bay.',
    goal: 'Stop with the rover inside the green bay.',
    world: () => room(20, 12, { zones: [zone('bay', 3.5, 0, 2.8, 2.6, GREEN, 'PARK')], start: [-5, 0, 0] }),
    toolbox: ['rover_start', 'rover_drive_for', 'rover_drive', 'rover_stop', 'rover_wait'],
    hints: [
      'Put a “drive forward at speed … for … seconds” block under “when started”.',
      'The bay is about 85 cm ahead. At speed 170 the rover covers roughly 30 cm a second.',
      'Too far or too short? Change the seconds and press Run again.',
    ],
    timeLimit: 20,
    check: () => (s) => {
      if (s.bumps) return { fail: 'The rover bumped into the wall.' }
      if (settled(s) && s.inZone('bay')) return { pass: 'Parked in the bay!' }
      if (s.programDone && s.stoppedFor > 0.6) return { fail: s.time < 0.5 ? 'The rover did not move. Add a drive block.' : 'The rover stopped outside the bay.' }
      return null
    },
    stars: [
      { text: 'Park in the bay', test: (r) => r.passed },
      { text: 'In under 6 seconds', test: (r) => r.time < 6 },
      { text: 'With 2 blocks or fewer (plus “when started”)', test: (r) => r.blocks <= 3 },
    ],
  },
  {
    id: 'reverse-park',
    chapter: 'First moves',
    title: 'Reverse into the garage',
    brief: 'The garage is behind you. Real drivers reverse in: drive backwards and stop inside without touching the walls.',
    goal: 'Reverse into the garage and stop inside.',
    world: () =>
      room(20, 12, {
        boxes: [box(-7.9, 0, 0.4, 3.8, 1), box(-6, -1.9, 3.4, 0.4, 1), box(-6, 1.9, 3.4, 0.4, 1)],
        zones: [zone('garage', -6, 0, 3, 3.2, BLUE, 'GARAGE')],
        start: [-1, 0, 0],
      }),
    toolbox: T1,
    hints: ['Use “drive backward”.', 'The garage is about 50 cm behind the rover.', 'Stop before the back wall: a little short is better than a bump.'],
    timeLimit: 20,
    check: () => (s) => {
      if (s.bumps) return { fail: 'The rover touched the garage.' }
      if (settled(s) && s.inZone('garage')) return { pass: 'Parked in the garage!' }
      if (s.programDone && s.stoppedFor > 0.6) return { fail: 'The rover stopped outside the garage.' }
      return null
    },
    stars: [
      { text: 'Stop inside the garage', test: (r) => r.passed },
      { text: 'In under 5 seconds', test: (r) => r.time < 5 },
      { text: 'Right in the middle (within 6 cm)', test: (r) => Math.hypot(r.x + 6, r.z) < 0.6 },
    ],
  },
  {
    id: 'there-and-back',
    chapter: 'First moves',
    title: 'There and back',
    brief: 'Drive to the yellow flag, turn round on the spot, and come home.',
    goal: 'Touch the flag zone, then stop at home.',
    world: () =>
      room(24, 12, {
        zones: [zone('home', -8, 0, 3, 3, BLUE, 'HOME'), zone('flag', 4, 0, 2.6, 2.6, YELLOW, 'FLAG')],
        start: [-8, 0, 0],
      }),
    toolbox: T1,
    hints: [
      'Three moves: drive, spin, drive.',
      'A spin turns the rover on the spot. Find out how long it takes to turn half a circle.',
      'If the rover comes back crooked, make the spin a little shorter or longer.',
    ],
    timeLimit: 30,
    check: () => (s) => {
      if (s.bumps) return { fail: 'The rover bumped into the wall.' }
      if (settled(s) && s.entered.has('flag') && s.inZone('home')) return { pass: 'Home again!' }
      if (s.programDone && s.stoppedFor > 0.6) return { fail: s.entered.has('flag') ? 'The rover stopped outside home.' : 'The rover never reached the flag.' }
      return null
    },
    stars: [
      { text: 'Flag, then home', test: (r) => r.passed },
      { text: 'In under 12 seconds', test: (r) => r.time < 12 },
      { text: 'With 3 moves (4 blocks)', test: (r) => r.blocks <= 4 },
    ],
  },
  {
    id: 'square',
    chapter: 'First moves',
    title: 'Square dance',
    brief: 'Drive a square round the box: corner 1, 2, 3, then back home. The same two moves, four times over.',
    goal: 'Visit corners 1, 2 and 3 in order, then stop at home.',
    world: () =>
      room(20, 16, {
        boxes: [box(0, 0, 2, 2, 1)],
        zones: [
          zone('home', -3.5, 3.5, 3, 3, BLUE, 'HOME'),
          zone('c1', 3.5, 3.5, 3, 3, YELLOW, '1'),
          zone('c2', 3.5, -3.5, 3, 3, YELLOW, '2'),
          zone('c3', -3.5, -3.5, 3, 3, YELLOW, '3'),
        ],
        start: [-3.5, 3.5, 0],
      }),
    toolbox: T1R,
    hints: [
      'One side of the square: drive forward, then spin left a quarter turn.',
      'Put those two blocks inside “repeat 4 times”.',
      'Find the quarter-turn time first: it is about half your half-turn time.',
    ],
    timeLimit: 40,
    check: () => (s) => {
      if (s.bumps) return { fail: 'The rover bumped into something.' }
      const i1 = s.order.indexOf('c1')
      const i2 = s.order.indexOf('c2')
      const i3 = s.order.indexOf('c3')
      const ok = i1 >= 0 && i2 > i1 && i3 > i2
      if (settled(s) && ok && s.inZone('home')) return { pass: 'A perfect square!' }
      if (s.programDone && s.stoppedFor > 0.6) return { fail: ok ? 'The rover stopped outside home.' : 'Visit corners 1, 2 and 3 in that order.' }
      return null
    },
    stars: [
      { text: 'All corners, then home', test: (r) => r.passed },
      { text: 'In under 20 seconds', test: (r) => r.time < 20 },
      { text: 'With a repeat (5 blocks or fewer)', test: (r) => r.blocks <= 5 },
    ],
  },

  // ======================================================== 2. Speed & timing
  {
    id: 'school-zone',
    chapter: 'Speed & timing',
    title: 'School zone',
    brief: 'Children cross in the yellow zone. Drive fast on the open road, slow down to speed 120 or less in the zone, then speed up to the finish.',
    goal: 'Reach the finish, never faster than speed 120 in the yellow zone.',
    world: () =>
      room(30, 10, {
        zones: [zone('slow', 0, 0, 5, 5, YELLOW, 'SLOW'), zone('finish', 11.5, 0, 3, 4, GREEN, 'FINISH')],
        start: [-12, 0, 0],
      }),
    toolbox: T1,
    hints: ['Three “drive … for … seconds” blocks: fast, slow, fast.', 'Slow down a little before the zone starts: the rover takes a moment to slow.'],
    timeLimit: 40,
    check: () => (s) => {
      if (s.bumps) return { fail: 'The rover bumped into something.' }
      if (s.inZone('slow') && Math.max(Math.abs(sim.pwmL), Math.abs(sim.pwmR)) > 120) return { fail: 'Too fast in the school zone: speed 120 or less there.' }
      if (s.inZone('finish')) return { pass: 'Safe and on time!' }
      if (s.programDone && s.stoppedFor > 0.6) return { fail: 'The rover stopped before the finish.' }
      return null
    },
    stars: [
      { text: 'Reach the finish safely', test: (r) => r.passed },
      { text: 'In under 11 seconds', test: (r) => r.time < 11 },
      { text: 'In under 8.5 seconds', test: (r) => r.time < 8.5 },
    ],
  },
  {
    id: 'on-time',
    chapter: 'Speed & timing',
    title: 'Right on time',
    brief: 'The bus stop is 1.1 m away, and the bus leaves in exactly 5 seconds. Arrive and stop at the stop as close to 5 seconds as you can: not early, not late.',
    goal: 'Stop in the bus stop between 4 and 6 seconds.',
    world: () => room(24, 10, { zones: [zone('stop', 5, 0, 3, 3, PURPLE, 'BUS')], start: [-6, 0, 0] }),
    toolbox: T2,
    hints: ['Slower speed, longer time: try speed 120.', 'Arriving early? Add a short wait before you start.', '“wait until seconds since start > 5” then stop is very precise.'],
    timeLimit: 20,
    check: () => (s) => {
      if (s.bumps) return { fail: 'The rover bumped into something.' }
      if (settled(s)) {
        const arrived = Math.round((s.time - s.stoppedFor) * 10) / 10
        if (s.inZone('stop')) {
          if (arrived >= 4 && arrived <= 6) return { pass: `Arrived at ${arrived} s.`, score: arrived }
          return { fail: `Arrived at ${arrived} s: aim for 5.` }
        }
        if (s.programDone) return { fail: 'The rover stopped outside the bus stop.' }
      }
      return null
    },
    stars: [
      { text: 'Arrive between 4 and 6 s', test: (r) => r.passed },
      { text: 'Between 4.5 and 5.5 s', test: (r) => Math.abs((r.score ?? 0) - 5) <= 0.5001 },
      { text: 'Between 4.8 and 5.2 s', test: (r) => Math.abs((r.score ?? 0) - 5) <= 0.2001 },
    ],
  },
  {
    id: 'slalom',
    chapter: 'Speed & timing',
    title: 'Slalom',
    brief: 'Weave between the three cones: left of the first, right of the second, left of the third, then on to the finish.',
    goal: 'Pass through gates 1, 2 and 3 in order, then reach the finish.',
    world: () =>
      room(32, 14, {
        boxes: [box(-6, 0, 0.8, 0.8, 1), box(1, 0, 0.8, 0.8, 1), box(8, 0, 0.8, 0.8, 1)],
        zones: [
          zone('g1', -6, -3, 3, 3.4, YELLOW, '1'),
          zone('g2', 1, 3, 3, 3.4, YELLOW, '2'),
          zone('g3', 8, -3, 3, 3.4, YELLOW, '3'),
          zone('finish', 14, 0, 3, 6, GREEN, 'FINISH'),
        ],
        start: [-13.5, 0, 0],
      }),
    toolbox: T2,
    hints: [
      'Aim, then drive: spin a little to point at the next gate, then drive straight to it.',
      'Gate 1 is on the rover’s left as it starts: a small spin left first (about 0.25 s).',
      'From gate to gate the turn is bigger: about 0.6–0.7 s at speed 170.',
    ],
    timeLimit: 40,
    check: () => (s) => {
      if (s.bumps) return { fail: 'The rover hit a cone.' }
      const i1 = s.order.indexOf('g1')
      const i2 = s.order.indexOf('g2')
      const i3 = s.order.indexOf('g3')
      if (s.inZone('finish')) return i1 >= 0 && i2 > i1 && i3 > i2 ? { pass: 'Clean slalom!' } : { fail: 'Pass gates 1, 2 and 3 in order before the finish.' }
      if (s.programDone && s.stoppedFor > 0.6) return { fail: 'The rover stopped before the finish.' }
      return null
    },
    stars: [
      { text: 'All gates in order', test: (r) => r.passed },
      { text: 'In under 15 seconds', test: (r) => r.time < 15 },
      { text: 'In under 12 seconds', test: (r) => r.time < 12 },
    ],
  },

  // ======================================================== 3. Ultrasonic eyes
  {
    id: 'learn-ultrasonic',
    chapter: 'Ultrasonic eyes',
    title: 'How far away?',
    brief: 'A short lesson: how the ultrasonic sensor measures distance, and how to use it to stop before a wall.',
    goal: 'Stop 10–25 cm from the wall without touching it.',
    world: () =>
      room(24, 10, {
        boxes: [box(6.5, 0, 1, 6)],
        zones: [zone('stop', 6 - GEOM.usAhead - 1.75, 0, 1.5, 3, YELLOW, 'STOP')],
        start: [-6, 0, 0],
      }),
    toolbox: [...T2, 'rover_distance'],
    hints: [],
    timeLimit: 30,
    check: stopAtWall,
    stars: [{ text: 'Stop 10–25 cm from the wall', test: (r) => r.passed }],
    lesson: LESSON_ULTRASONIC,
  },
  {
    id: 'stop-at-wall',
    chapter: 'Ultrasonic eyes',
    title: 'Stop at the wall',
    brief: 'A wall is somewhere ahead, and it moves every run, so timing won’t work. Use the ultrasonic sensor to stop just in front of it.',
    goal: 'Stop 10–25 cm from the wall without touching it.',
    world: () => {
      const face = 4 + Math.random() * 9
      return room(30, 10, {
        boxes: [box(face + 0.5, 0, 1, 6)],
        zones: [zone('stop', face - GEOM.usAhead - 1.75, 0, 1.5, 3, YELLOW, 'STOP')],
        start: [-11, 0, 0],
      })
    },
    toolbox: T3,
    hints: [
      'Drive forward, then “wait until” something is true, then stop.',
      'Put “distance (cm)” into a compare block: distance < 20.',
      'Fast rovers need room to stop. Try a lower speed, or stop a little earlier.',
    ],
    timeLimit: 30,
    check: stopAtWall,
    stars: [
      { text: 'Stop 10–25 cm from the wall', test: (r) => r.passed },
      { text: 'In under 10 seconds', test: (r) => r.time < 10 },
      { text: 'Right on target: 15–20 cm', test: (r) => r.cm >= 15 && r.cm <= 20 },
    ],
  },
  {
    id: 'corner',
    chapter: 'Ultrasonic eyes',
    title: 'Round the corner',
    brief: 'Drive to the wall (it moves every run), turn left, and drive on to the finish.',
    goal: 'Reach the finish without touching anything.',
    world: () => {
      const wx = rand(-2, 6)
      return room(30, 20, {
        boxes: [box(wx, 4, 0.6, 6)],
        zones: [zone('finish', wx - 3.6, -7.5, 5, 3, GREEN, 'FINISH')],
        start: [-13, 4, 0],
      })
    },
    toolbox: T3,
    hints: ['Drive until the wall is close, stop, spin left a quarter turn, then drive on.', 'Use the quarter-turn time you found in “Square dance”.'],
    timeLimit: 40,
    check: () => (s) => {
      const b = noBumps(s)
      if (b) return b
      if (s.inZone('finish')) return { pass: 'Round the corner!' }
      if (s.programDone && s.stoppedFor > 0.6) return { fail: 'The rover stopped before the finish.' }
      return null
    },
    stars: [
      { text: 'Reach the finish', test: (r) => r.passed },
      { text: 'In under 15 seconds', test: (r) => r.time < 15 },
      { text: 'With 7 blocks or fewer', test: (r) => r.blocks <= 7 },
    ],
  },
  {
    id: 'learn-decide',
    chapter: 'Ultrasonic eyes',
    title: 'Look and decide',
    brief: 'A short lesson: keep checking the sensor while you drive, and turn away from walls.',
    goal: 'Drive around for 20 seconds without touching a wall (at least 1.5 m).',
    world: () => room(16, 12, { start: [-3, 0, 0] }),
    toolbox: T3,
    hints: [],
    timeLimit: 21,
    check: () => (s) => {
      if (s.bumps) return { fail: `Bump after ${s.time.toFixed(1)} s.` }
      if (s.time >= 20) return sim.odometer >= 15 ? { pass: `20 seconds, ${(sim.odometer / 10).toFixed(1)} m, no bumps!` } : { fail: 'Keep moving: drive at least 1.5 m.' }
      return null
    },
    stars: [{ text: '20 seconds, no bumps', test: (r) => r.passed }],
    lesson: LESSON_DECIDE,
  },
  {
    id: 'dont-crash',
    chapter: 'Ultrasonic eyes',
    title: 'Don’t crash',
    brief: 'The room is full of boxes, in new places every run. Drive around for 30 seconds without touching any of them. Standing still doesn’t count!',
    goal: 'Keep moving for 30 seconds without a bump (at least 2 m).',
    world: () => {
      const boxes: Box[] = []
      while (boxes.length < 4) {
        const b = box(rand(-8, 8), rand(-5, 5), rand(1.2, 2), rand(1.2, 2), rand(1, 1.6))
        const clearOfStart = Math.hypot(b.x + 8, b.z) > 4
        const clearOfOthers = boxes.every((o) => Math.abs(o.x - b.x) > 4.5 || Math.abs(o.z - b.z) > 4.5)
        if (clearOfStart && clearOfOthers) boxes.push(b)
      }
      return room(24, 16, { boxes, start: [-8, 0, rand(-0.6, 0.6)] })
    },
    toolbox: T3,
    hints: [
      'Inside “forever”: if something is close, back up and turn; else drive forward.',
      'Look in the Code tab: obstacle_avoider.ino does exactly this.',
      'The sensor only looks straight ahead: turn away early (30–40 cm) so the corners of the rover don’t clip a box.',
    ],
    timeLimit: 31,
    check: () => (s) => {
      if (s.bumps) return { fail: `Bump after ${s.time.toFixed(1)} s.` }
      if (s.time >= 30) return sim.odometer >= 20 ? { pass: `30 seconds, ${(sim.odometer / 10).toFixed(1)} m, no bumps!` } : { fail: 'Keep moving: drive at least 2 m.' }
      return null
    },
    stars: [
      { text: '30 seconds, no bumps', test: (r) => r.passed },
      { text: 'Drive at least 4 m', test: (r) => r.odometer >= 40 },
      { text: 'Drive at least 6 m', test: (r) => r.odometer >= 60 },
    ],
  },
  {
    id: 'zigzag',
    chapter: 'Ultrasonic eyes',
    title: 'Zigzag',
    brief: 'Four walls block the way: turn left at the first, right at the second, left, right, then on to the finish.',
    goal: 'Reach the finish without touching a wall.',
    world: () =>
      room(30, 20, {
        boxes: [box(-5, 7, 0.6, 5), box(-8, -1, 5, 0.6), box(2, 2, 0.6, 5), box(-1, -6, 5, 0.6)],
        zones: [zone('finish', 10, -3, 4, 4, GREEN, 'FINISH')],
        start: [-13, 7, 0],
      }),
    toolbox: T3,
    hints: [
      'Each wall: drive until it is close, stop, turn a quarter. Only the turn direction changes.',
      'Two walls make a pattern (left, right), and the pattern repeats twice.',
      'Use “repeat 2 times” with left-wall-right-wall inside.',
    ],
    timeLimit: 60,
    check: () => (s) => {
      if (s.bumps) return { fail: 'The rover touched a wall.' }
      if (s.inZone('finish')) return { pass: 'Through the zigzag!' }
      if (s.programDone && s.stoppedFor > 0.6) return { fail: 'The rover stopped before the finish.' }
      return null
    },
    stars: [
      { text: 'Reach the finish', test: (r) => r.passed },
      { text: 'In under 30 seconds', test: (r) => r.time < 30 },
      { text: 'With 14 blocks or fewer (use a repeat)', test: (r) => r.blocks <= 14 },
    ],
  },

  // ======================================================== 4. Line sensors
  {
    id: 'learn-ir',
    chapter: 'Line sensors',
    title: 'See the line',
    brief: 'A short lesson: how the IR line sensors see a black line, and how to stop on one.',
    goal: 'Stop with the IR sensors on the wide black stop line.',
    // a stop line as wide as a road's (about 8 cm): four strips of tape side by side
    world: () => room(24, 10, { tapes: [0, 1, 2, 3].map((i) => ({ points: [[STOP_LINE + i * 0.2, -3.5], [STOP_LINE + i * 0.2, 3.5]] as [number, number][] })), start: [-6, 0, 0] }),
    toolbox: [...T2, 'rover_line', 'logic_operation'],
    hints: [],
    timeLimit: 30,
    check: () => (s) => {
      if (s.bumps) return { fail: 'The rover bumped into the wall.' }
      if (!settled(s)) return null
      // where the IR sensors are, from the near edge of the stop line (scene units: 1 = 10 cm)
      const near = STOP_LINE - TAPE_WIDTH / 2
      const far = STOP_LINE + 0.6 + TAPE_WIDTH / 2
      const at = sim.x + Math.cos(sim.heading) * GEOM.irAhead
      if (at >= near - 0.05 && at <= far) return { pass: 'Stopped on the line!' }
      if (s.programDone) return { fail: at < near ? 'The rover stopped before the line.' : `The rover rolled ${Math.max(1, Math.round((at - far) * 10))} cm past the line: drive slower.` }
      return null
    },
    stars: [{ text: 'Stop on the line', test: (r) => r.passed }],
    lesson: LESSON_IR,
  },
  {
    id: 'ring',
    chapter: 'Line sensors',
    title: 'Stay in the ring',
    brief: 'A black ring surrounds you, like a sumo ring. Drive around inside it for 30 seconds. Whenever an IR sensor sees the edge, turn back in.',
    goal: 'Stay inside the ring for 30 seconds and drive at least 2 m.',
    world: () => room(20, 20, { tapes: [{ points: circle(6.5), closed: true }], start: [0, 0, rand(0, Math.PI * 2)] }),
    toolbox: T4,
    hints: ['Inside “forever”: if either IR sensor sees the line, back up and spin; else drive forward.', 'Use “or” to check both sensors at once.'],
    timeLimit: 31,
    check: () => (s) => {
      if (Math.hypot(sim.x, sim.z) > 6.6) return { fail: `Out of the ring after ${s.time.toFixed(1)} s.` }
      if (s.time >= 30) return sim.odometer >= 20 ? { pass: `30 seconds in the ring, ${(sim.odometer / 10).toFixed(1)} m.` } : { fail: 'Keep moving: drive at least 2 m.' }
      return null
    },
    stars: [
      { text: '30 seconds in the ring', test: (r) => r.passed },
      { text: 'Drive at least 4 m', test: (r) => r.odometer >= 40 },
      { text: 'Drive at least 6 m', test: (r) => r.odometer >= 60 },
    ],
  },
  {
    id: 'follow-line',
    chapter: 'Line sensors',
    title: 'Follow the line',
    brief: 'A black line winds across the floor and ends at a T. Use the two IR sensors to follow it, and stop on the T.',
    goal: 'Follow the line and stop in the finish box.',
    world: () => {
      const pts = sLine()
      const end = pts[pts.length - 1]
      return room(30, 14, {
        tapes: [{ points: pts }, { points: [[end[0], end[1] - 1.4], [end[0], end[1] + 1.4]] }],
        zones: [zone('finish', end[0] - 0.4, end[1], 3.2, 3.6, GREEN, 'FINISH')],
        start: onLine(pts, 10),
      })
    },
    toolbox: T4,
    hints: [
      'Inside “forever”: if the left sensor sees the line, turn left; if the right one does, turn right; else drive forward.',
      'Turn by slowing one side: set motors left -60 right 170 turns left.',
      'At the T both sensors see the line at once: that is the moment to stop.',
    ],
    timeLimit: 90,
    check: () => (s) => {
      if (s.bumps) return { fail: 'The rover bumped into the wall.' }
      if (settled(s) && s.inZone('finish')) return { pass: 'Stopped on the T!' }
      if (s.programDone && s.stoppedFor > 0.6 && !s.inZone('finish')) return { fail: 'The rover stopped before the finish.' }
      return null
    },
    stars: [
      { text: 'Reach the finish and stop', test: (r) => r.passed },
      { text: 'In under 30 seconds', test: (r) => r.time < 30 },
      { text: 'In under 20 seconds', test: (r) => r.time < 20 },
    ],
  },
  {
    id: 'lap',
    chapter: 'Line sensors',
    title: 'One full lap',
    brief: 'The Drive tab’s track: a wavy loop with tight bends. Follow it all the way round, once.',
    goal: 'Complete one lap without losing the line.',
    world: () => {
      // the same start as the Drive tab's line follower
      const t0 = -Math.PI / 2 - 0.12
      const [x, z] = trackPoint(t0)
      const [x2, z2] = trackPoint(t0 + 0.01)
      const h = Math.atan2(-(z2 - z), x2 - x)
      return room(30, 20, { tapes: [{ points: TRACK, closed: true }], start: [x - Math.cos(h) * GEOM.irAhead, z + Math.sin(h) * GEOM.irAhead, h] })
    },
    toolbox: T4,
    hints: ['Your “Follow the line” program is a good start.', 'Tight bends need a sharper turn: try -80 / 190.', 'Too fast and the rover flies off the bends: slow down a little.'],
    timeLimit: 120,
    check: () => {
      // count the angle the rover sweeps round the centre of the loop
      let last = Math.atan2(sim.z, sim.x)
      let swept = 0
      return (s) => {
        if (s.bumps) return { fail: 'The rover bumped into something.' }
        const a = Math.atan2(sim.z, sim.x)
        let d = a - last
        if (d > Math.PI) d -= Math.PI * 2
        if (d < -Math.PI) d += Math.PI * 2
        swept += d
        last = a
        if (distToTrack(sim.x, sim.z) > 2.5) return { fail: 'The rover lost the line.' }
        if (Math.abs(swept) >= Math.PI * 2) return { pass: 'One full lap!' }
        if (s.programDone && s.stoppedFor > 0.6) return { fail: 'The rover stopped before the lap was done.' }
        return null
      }
    },
    stars: [
      { text: 'One full lap', test: (r) => r.passed },
      { text: 'In under 35 seconds', test: (r) => r.time < 35 },
      { text: 'In under 22 seconds', test: (r) => r.time < 22 },
    ],
  },
  {
    id: 'line-and-wall',
    chapter: 'Line sensors',
    title: 'Something on the line',
    brief: 'Follow the line, but a box has been left on it (somewhere new every run). Stop before you hit it.',
    goal: 'Follow the line and stop 10–25 cm before the box.',
    world: () => {
      const pts: [number, number][] = Array.from({ length: 241 }, (_, i) => {
        const x = -12 + i * 0.1
        return [x, 1.2 * Math.sin(((x + 12) / 24) * Math.PI * 2)]
      })
      const bx = rand(1, 9)
      return room(30, 12, { tapes: [{ points: pts }], boxes: [box(bx, 1.2 * Math.sin(((bx + 12) / 24) * Math.PI * 2), 1, 3)], start: onLine(pts, 10) })
    },
    toolbox: T4,
    hints: ['Your line follower, plus one more check that comes first: is the box close?', 'If distance < 20: stop. Else: follow the line.'],
    timeLimit: 60,
    check: () => (s) => {
      if (s.bumps) return { fail: 'The rover hit the box.' }
      if (settled(s) && s.cm >= 10 && s.cm <= 25) return { pass: `Stopped ${s.cm} cm before the box.` }
      if (distToTrack(sim.x, sim.z) > 2.5) return { fail: 'The rover lost the line.' }
      if (s.programDone && s.stoppedFor > 0.6) return { fail: 'The rover stopped in the wrong place.' }
      return null
    },
    stars: [
      { text: 'Stop 10–25 cm before the box', test: (r) => r.passed },
      { text: 'In under 20 seconds', test: (r) => r.time < 20 },
      { text: 'Right on target: 15–20 cm', test: (r) => r.cm >= 15 && r.cm <= 20 },
    ],
  },

  // ======================================================== 5. Put it together
  {
    id: 'delivery',
    chapter: 'Put it together',
    title: 'Delivery run',
    brief: 'Follow the line and deliver to both stations: at each crossbar stop for 2 seconds, then carry on. Stop at the final T.',
    goal: 'Stop 2 s at stations A and B, then stop on the T.',
    world: () => {
      const pts = sLine(2.2)
      const end = pts[pts.length - 1]
      const a = pts[75]
      const b = pts[150]
      return room(30, 14, {
        tapes: [{ points: pts }, { points: crossbar(pts, 75) }, { points: crossbar(pts, 150) }, { points: [[end[0], end[1] - 1.4], [end[0], end[1] + 1.4]] }],
        zones: [
          zone('A', a[0] - 0.6, a[1], 3, 3, BLUE, 'A'),
          zone('B', b[0] - 0.6, b[1], 3, 3, BLUE, 'B'),
          zone('finish', end[0] - 0.4, end[1], 3.2, 3.6, GREEN, 'FINISH'),
        ],
        start: onLine(pts, 10),
      })
    },
    toolbox: 'all',
    hints: [
      'When both sensors see the line: stop, wait 2 seconds, then drive forward for a moment to get past the bar.',
      'Otherwise: follow the line as before.',
      'At the final T the same blocks run, and the rover stops there: that counts.',
    ],
    timeLimit: 120,
    check: () => {
      const done = { A: false, B: false }
      const was = { A: false, B: false }
      return (s) => {
        if (s.bumps) return { fail: 'The rover bumped into something.' }
        for (const k of ['A', 'B'] as const) {
          const inside = s.inZone(k)
          // a 2-second wait: the rover is fully at rest for a little less than that
          if (inside && s.stoppedFor >= 1.5) done[k] = true
          if (was[k] && !inside && !done[k]) return { fail: `The rover didn’t stop for 2 seconds at station ${k}.` }
          was[k] = inside
        }
        if (distToTrack(sim.x, sim.z) > 2.5) return { fail: 'The rover lost the line.' }
        if (done.A && done.B && settled(s) && s.inZone('finish')) return { pass: 'Both parcels delivered!' }
        if (s.programDone && s.stoppedFor > 0.6) return { fail: 'The rover stopped too early.' }
        return null
      }
    },
    stars: [
      { text: 'Both stations, then the T', test: (r) => r.passed },
      { text: 'In under 30 seconds', test: (r) => r.time < 30 },
      { text: 'In under 20 seconds', test: (r) => r.time < 20 },
    ],
  },
  {
    id: 'find-the-box',
    chapter: 'Put it together',
    title: 'Find the box',
    brief: 'A box is hidden somewhere around you, in a new place every run. Spin round to find it with the ultrasonic sensor, drive to it, and stop just in front.',
    goal: 'Stop 10–25 cm in front of the box.',
    world: () => {
      const a = rand(0, Math.PI * 2)
      const r = rand(8.5, 11)
      return room(30, 30, { boxes: [box(Math.cos(a) * r, Math.sin(a) * r, 1.6, 1.6, 1.2)], start: [0, 0, rand(0, Math.PI * 2)] })
    },
    toolbox: 'all',
    hints: [
      'Spin slowly until the distance is less than 130 cm (the walls are further away than that).',
      'Then stop, and drive forward until the distance is less than 20.',
      'Spinning fast overshoots the box. Speed 110 is plenty.',
    ],
    timeLimit: 60,
    check: () => (s) => {
      if (s.bumps) return { fail: 'The rover bumped into something.' }
      if (settled(s) && s.cm >= 10 && s.cm <= 25) return { pass: `Found it: ${s.cm} cm away.` }
      if (s.programDone && s.stoppedFor > 0.6) return { fail: s.cm < 130 ? `Stopped ${s.cm} cm away: aim for 10–25 cm.` : 'The rover stopped without finding the box.' }
      return null
    },
    stars: [
      { text: 'Stop 10–25 cm from the box', test: (r) => r.passed },
      { text: 'In under 20 seconds', test: (r) => r.time < 20 },
      { text: 'Right on target: 15–20 cm', test: (r) => r.cm >= 15 && r.cm <= 20 },
    ],
  },
]

/** the colour names, for anyone writing new missions */
export const ZONE_COLOURS = { GREEN, YELLOW, BLUE, RED, PURPLE }
