// A small 2D simulator for the Drive tab.
// Scene units: 1 unit = 10 cm (the rover is ~2 units long). +x = forward at heading 0, +z = right.
// heading increases when the rover turns left (counter-clockwise seen from above).
//
// Wheels and motors: see drivetrain.ts (4WD skid steer, four TT motors).
//
// The autopilots copy the logic and numbers of the Arduino sketches in src/sketches:
// obstacle_avoider.ino, line_follower.ino and bluetooth_remote.ino.

import { BODY, contactImpulse, drivetrainStep, newSide, type Body } from './drivetrain'

export type DriveMode = 'manual' | 'obstacle' | 'line'
/** what drives the rover: the Drive tab's modes, or a block program (Missions tab) */
export type SimMode = DriveMode | 'program'

// ---------------- the world: room size, boxes, tape lines, goal zones ----------------
export interface Box {
  x: number
  z: number
  w: number
  d: number
  h: number
  /** walls are not drawn as boxes */
  wall?: boolean
}
/** a strip of black tape: a polyline (scene units), open or closed */
export interface Tape {
  points: [number, number][]
  closed?: boolean
}
/** a coloured rectangle on the floor that a mission checks (centre, size) */
export interface Zone {
  id: string
  x: number
  z: number
  w: number
  d: number
  color: string
  label?: string
}
export interface World {
  /** floor size (scene units); walls go round it */
  w: number
  d: number
  boxes: Box[]
  tapes: Tape[]
  zones: Zone[]
  /** where a program starts: x, z, heading */
  start: [number, number, number]
}

/** The live world. The arrays are changed in place by setWorld, so imports stay valid. */
export const ARENA = { w: 30, d: 20 } // 3 m × 2 m room
const WALL = 0.3
export const BOXES: Box[] = []
export const TAPES: Tape[] = []
export const ZONES: Zone[] = []
export const START: [number, number, number] = [-12, -3, 0]
let worldRev = 0
const worldListeners = new Set<() => void>()
export const worldVersion = () => worldRev
export function onWorldChange(cb: () => void) {
  worldListeners.add(cb)
  return () => {
    worldListeners.delete(cb)
  }
}

export function setWorld(w: World) {
  ARENA.w = w.w
  ARENA.d = w.d
  BOXES.length = 0
  BOXES.push(
    ...w.boxes,
    { x: 0, z: -w.d / 2 - WALL / 2, w: w.w + 2 * WALL, d: WALL, h: 0.6, wall: true },
    { x: 0, z: w.d / 2 + WALL / 2, w: w.w + 2 * WALL, d: WALL, h: 0.6, wall: true },
    { x: -w.w / 2 - WALL / 2, z: 0, w: WALL, d: w.d, h: 0.6, wall: true },
    { x: w.w / 2 + WALL / 2, z: 0, w: WALL, d: w.d, h: 0.6, wall: true },
  )
  TAPES.length = 0
  TAPES.push(...w.tapes)
  ZONES.length = 0
  ZONES.push(...w.zones)
  START.splice(0, 3, ...w.start)
  worldRev++
  worldListeners.forEach((cb) => cb())
}

const ROOM_BOXES: Box[] = [
  // inside the track loop
  { x: 0, z: 0, w: 2.4, d: 1.2, h: 1.2 },
  { x: -4.2, z: 1.0, w: 1.0, d: 1.0, h: 1.6 },
  { x: 4.2, z: -1.2, w: 1.3, d: 1.3, h: 1.0 },
  // around the outside
  { x: -12.6, z: -7.2, w: 1.6, d: 1.6, h: 1.4 },
  { x: 12.8, z: 6.8, w: 1.4, d: 2.2, h: 1.0 },
  { x: 12.4, z: -7.6, w: 2.2, d: 1.0, h: 1.2 },
  { x: -12.6, z: 7.4, w: 1.2, d: 1.2, h: 2.0 },
  { x: 0.5, z: 8.4, w: 3.2, d: 0.8, h: 0.9 },
  { x: -1.5, z: -8.6, w: 2.0, d: 0.8, h: 1.1 },
  { x: -6.5, z: -8.2, w: 1.0, d: 1.0, h: 1.3 },
  { x: 7, z: 8.6, w: 1.0, d: 0.8, h: 1.5 },
]

/** The black tape loop: a wavy oval, tightest curve ~31 cm radius. */
export const TAPE_WIDTH = 0.22 // 2.2 cm, fits between the IR sensors
export function trackPoint(t: number): [number, number] {
  return [9.5 * Math.cos(t), 5.5 * Math.sin(t) + 1.0 * Math.sin(3 * t)]
}
export const TRACK: [number, number][] = Array.from({ length: 720 }, (_, i) => trackPoint((i / 720) * Math.PI * 2))

/** The Drive tab's room: boxes round a wavy tape loop. */
export const ROOM: World = { w: 30, d: 20, boxes: ROOM_BOXES, tapes: [{ points: TRACK, closed: true }], zones: [], start: [-12, -3, 0] }
setWorld(ROOM)

/** Distance from a point to the nearest tape (scene units). */
export function distToTrack(x: number, z: number) {
  let best = Infinity
  for (const tape of TAPES) {
    const pts = tape.points
    const n = tape.closed ? pts.length : pts.length - 1
    for (let i = 0; i < n; i++) {
      const [ax, az] = pts[i]
      const [bx, bz] = pts[(i + 1) % pts.length]
      const dx = bx - ax
      const dz = bz - az
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)))
      const ex = ax + dx * t - x
      const ez = az + dz * t - z
      const d = ex * ex + ez * ez
      if (d < best) best = d
    }
  }
  return Math.sqrt(best)
}

// ---------------- rover geometry (filled in from the 3D model) ----------------
export const GEOM = {
  /** ultrasonic sensor: distance ahead of the rover centre, and height above the floor */
  usAhead: 0.75,
  usHeight: 0.65,
  /** IR sensors: ahead of the centre, and sideways (+ = right) */
  irAhead: 0.95,
  irLeft: -0.15,
  irRight: 0.15,
  /** wheel track width (left to right) */
  track: 1.6,
  /** half length and half width of the body, wheels included (collisions) */
  halfLen: 1.0,
  halfWid: 0.85,
  /** wheel radius and front-to-back wheel spacing */
  wheelR: 0.325,
  wheelbase: 1.3,
}

/** Copy the measured geometry (scene units) into the physics model (metres). */
export function syncBody() {
  BODY.wheelRadius = GEOM.wheelR / 10
  BODY.track = GEOM.track / 10
  BODY.wheelbase = GEOM.wheelbase / 10
  BODY.length = (GEOM.halfLen * 2) / 10
  BODY.width = (GEOM.halfWid * 2) / 10
}

const SUBSTEPS = 4 // physics runs 4x per program step (~1 kHz) to keep the tyre model stable

// ---------------- state ----------------
export interface Params {
  SAFE_CM: number
  SPEED: number
  TURN: number
  LINE_HIGH: boolean
  /** bluetooth speed digit 0-9 */
  digit: number
}
export const DEFAULT_PARAMS: Record<DriveMode, Params> = {
  manual: { SAFE_CM: 25, SPEED: 170, TURN: 170, LINE_HIGH: true, digit: 7 },
  obstacle: { SAFE_CM: 25, SPEED: 170, TURN: 170, LINE_HIGH: true, digit: 7 },
  line: { SAFE_CM: 25, SPEED: 130, TURN: 170, LINE_HIGH: true, digit: 7 },
}

export interface Action {
  left: number
  right: number
  ms: number
  node: string | null
}

export const sim = {
  mode: 'manual' as SimMode,
  running: true,
  params: { ...DEFAULT_PARAMS.manual },
  x: -12,
  z: 0,
  heading: 0,
  /** motor commands (PWM, -255..255) */
  pwmL: 0,
  pwmR: 0,
  /** drivetrain state: speed, yaw rate, and each side's wheels (see drivetrain.ts) */
  body: { v: 0, w: 0, left: newSide(), right: newSide() } as Body,
  /** sensors */
  cm: 999,
  hit: null as [number, number] | null,
  irL: false,
  irR: false,
  /** program */
  queue: [] as Action[],
  actionLeft: 0,
  node: null as string | null,
  /** manual: pressed directions and last letter sent */
  keys: { up: false, down: false, left: false, right: false },
  letter: 'S',
  bumps: 0,
  /** seconds spent touching something */
  contact: 0,
  /** incremented on reset, so the camera can snap */
  resets: 0,
  time: 0,
  /** distance driven (units) */
  odometer: 0,
  /** block program (Missions tab): yields one action at a time, like the sketches' loop() */
  program: null as Iterator<Action> | null,
  /** the program reached its end (the rover coasts to a stop) */
  programDone: false,
  programError: null as string | null,
  /** run faster than real time (Missions tab) */
  speedUp: 1,
  /** called after every step (mission checks) */
  onStep: null as ((dt: number) => void) | null,
  /** live runs: after the simulated sensors are read, put the real rover's readings in their place */
  sensorOverride: null as (() => void) | null,
  /** what the simulated sensors read this step, before any override (the pretend rover reports these) */
  raw: { cm: 999, irL: false, irR: false },
}

export function startPose(mode: SimMode): [number, number, number] {
  if (mode === 'program') return [START[0], START[1], START[2]]
  if (mode === 'line') {
    // on the bottom straight, facing along the tape (anticlockwise seen from above = decreasing t here)
    const t0 = -Math.PI / 2 - 0.12
    const [x, z] = trackPoint(t0)
    const [x2, z2] = trackPoint(t0 + 0.01)
    // direction of increasing t; heading measured with forward = (cos h, -sin h)
    const h = Math.atan2(-(z2 - z), x2 - x)
    // put the centre behind the point so the IR sensors sit on it
    return [x - Math.cos(h) * GEOM.irAhead, z + Math.sin(h) * GEOM.irAhead, h]
  }
  return [-12, -3, 0]
}

export function resetSim(mode: SimMode = sim.mode, keepParams = false, start?: [number, number, number]) {
  const [x, z, h] = start ?? startPose(mode)
  sim.mode = mode
  if (!keepParams) sim.params = { ...DEFAULT_PARAMS[mode === 'program' ? 'manual' : mode] }
  sim.program = null
  sim.programDone = false
  sim.programError = null
  sim.body = { v: 0, w: 0, left: newSide(), right: newSide() }
  Object.assign(sim, { x, z, heading: h, pwmL: 0, pwmR: 0, queue: [], actionLeft: 0, node: null, letter: 'S', bumps: 0, contact: 0, time: 0, odometer: 0 })
  sim.resets++
  readSensors()
}

// ---------------- sensors ----------------
function rayBox(ox: number, oz: number, dx: number, dz: number, b: Box) {
  const minX = b.x - b.w / 2
  const maxX = b.x + b.w / 2
  const minZ = b.z - b.d / 2
  const maxZ = b.z + b.d / 2
  let t0 = 0
  let t1 = Infinity
  for (const [o, d, lo, hi] of [
    [ox, dx, minX, maxX],
    [oz, dz, minZ, maxZ],
  ]) {
    if (Math.abs(d) < 1e-9) {
      if (o < lo || o > hi) return Infinity
    } else {
      let a = (lo - o) / d
      let c = (hi - o) / d
      if (a > c) [a, c] = [c, a]
      t0 = Math.max(t0, a)
      t1 = Math.min(t1, c)
      if (t0 > t1) return Infinity
    }
  }
  return t0
}

// The datasheet says 15 degrees, but in practice an HC-SR04 notices things up to ~15 degrees either side.
const BEAM = (15 * Math.PI) / 180
function readSensors() {
  const fx = Math.cos(sim.heading)
  const fz = -Math.sin(sim.heading)
  // ultrasonic: five rays across the beam, nearest echo wins
  const ox = sim.x + fx * GEOM.usAhead
  const oz = sim.z + fz * GEOM.usAhead
  let best = Infinity
  let hit: [number, number] | null = null
  for (const a of [-BEAM, -BEAM / 2, 0, BEAM / 2, BEAM]) {
    const h = sim.heading + a
    const dx = Math.cos(h)
    const dz = -Math.sin(h)
    for (const b of BOXES) {
      const t = rayBox(ox, oz, dx, dz, b)
      if (t < best) {
        best = t
        hit = [ox + dx * t, oz + dz * t]
      }
    }
  }
  const cm = best * 10
  sim.cm = cm > 400 ? 999 : Math.round(cm)
  sim.hit = sim.cm === 999 ? null : hit
  // IR: dark if the tape is under the sensor
  const rx = -fz // right vector = forward rotated -90 degrees
  const rz = fx
  const at = (side: number): [number, number] => [sim.x + fx * GEOM.irAhead + rx * side, sim.z + fz * GEOM.irAhead + rz * side]
  sim.irL = distToTrack(...at(GEOM.irLeft)) < TAPE_WIDTH / 2
  sim.irR = distToTrack(...at(GEOM.irRight)) < TAPE_WIDTH / 2
}

export function irPoints(): [[number, number], [number, number]] {
  const fx = Math.cos(sim.heading)
  const fz = -Math.sin(sim.heading)
  const at = (side: number): [number, number] => [sim.x + fx * GEOM.irAhead - fz * side, sim.z + fz * GEOM.irAhead + fx * side]
  return [at(GEOM.irLeft), at(GEOM.irRight)]
}
export function usOrigin(): [number, number] {
  return [sim.x + Math.cos(sim.heading) * GEOM.usAhead, sim.z - Math.sin(sim.heading) * GEOM.usAhead]
}

// ---------------- the programs ----------------
const LOOP_MS = 1000 / 240 // one simulation step: the real loop() is even faster

/** obstacle_avoider.ino loop() */
function obstacleLoop(): Action[] {
  const { SAFE_CM, SPEED } = sim.params
  if (sim.cm > SAFE_CM) return [{ left: SPEED, right: SPEED, ms: 40, node: 'fwd' }] // drive + delay(40)
  return [
    { left: 0, right: 0, ms: 200, node: 'stop' },
    { left: -SPEED, right: -SPEED, ms: 400, node: 'reverse' },
    { left: SPEED, right: -SPEED, ms: 350 + 40, node: 'turn' },
  ]
}

/** line_follower.ino loop() */
function lineLoop(): Action[] {
  const { SPEED, TURN, LINE_HIGH } = sim.params
  // the module reads HIGH over the dark tape; LINE says which level means "on the line"
  const left = sim.irL === LINE_HIGH
  const right = sim.irR === LINE_HIGH
  if (!left && !right) return [{ left: SPEED, right: SPEED, ms: LOOP_MS, node: 'straight' }]
  if (left && !right) return [{ left: -60, right: TURN, ms: LOOP_MS, node: 'left' }]
  if (!left && right) return [{ left: TURN, right: -60, ms: LOOP_MS, node: 'right' }]
  return [{ left: 0, right: 0, ms: LOOP_MS, node: 'end' }]
}

/** bluetooth_remote.ino: the letter the phone app would send for the pressed keys */
export function letterFor(k: typeof sim.keys) {
  const fwd = k.up && !k.down
  const back = k.down && !k.up
  const l = k.left && !k.right
  const r = k.right && !k.left
  if (fwd) return l ? 'G' : r ? 'I' : 'F'
  if (back) return l ? 'H' : r ? 'J' : 'B'
  if (l) return 'L'
  if (r) return 'R'
  return 'S'
}
function manualDrive() {
  const c = letterFor(sim.keys)
  sim.letter = c
  const s = Math.round(90 + (sim.params.digit * (255 - 90)) / 9) // map(c - '0', 0, 9, 90, 255)
  const table: Record<string, [number, number]> = {
    F: [s, s],
    B: [-s, -s],
    L: [-s, s],
    R: [s, -s],
    G: [Math.trunc(s / 3), s],
    I: [s, Math.trunc(s / 3)],
    H: [-Math.trunc(s / 3), -s],
    J: [-s, -Math.trunc(s / 3)],
    S: [0, 0],
  }
  ;[sim.pwmL, sim.pwmR] = table[c]
  sim.node = c === 'S' ? 'got' : 'cmd'
}

// ---------------- physics step ----------------
export function stepSim(dt: number) {
  if (!sim.running) return
  sim.time += dt
  readSensors()
  sim.raw.cm = sim.cm
  sim.raw.irL = sim.irL
  sim.raw.irR = sim.irR
  sim.sensorOverride?.()

  if (sim.mode === 'manual') manualDrive()
  else if (sim.mode === 'program') runProgram(dt)
  else {
    sim.actionLeft -= dt * 1000
    while (sim.actionLeft <= 0) {
      if (!sim.queue.length) sim.queue = sim.mode === 'obstacle' ? obstacleLoop() : lineLoop()
      const a = sim.queue.shift()!
      sim.pwmL = a.left
      sim.pwmR = a.right
      sim.node = a.node
      sim.actionLeft += a.ms
    }
  }

  const h = dt / SUBSTEPS
  let touching = false
  for (let i = 0; i < SUBSTEPS; i++) {
    const b = sim.body
    drivetrainStep(b, sim.pwmL, sim.pwmR, h)
    sim.heading += b.w * h
    sim.x += Math.cos(sim.heading) * b.v * 10 * h // m/s -> scene units
    sim.z -= Math.sin(sim.heading) * b.v * 10 * h
    sim.odometer += Math.abs(b.v * 10 * h)

    // keep out of boxes and walls (rotated rectangle vs box)
    for (const box of BOXES) touching = pushOut(box) || touching
  }
  if (touching && !wasTouching) sim.bumps++
  if (touching) sim.contact += dt
  wasTouching = touching
  sim.onStep?.(dt)
}

/** Block programs: take the next action whenever the current one (a wait, or one loop pass) is over. */
function runProgram(dt: number) {
  sim.actionLeft -= dt * 1000
  let guard = 0
  while (sim.actionLeft <= 0) {
    if (!sim.program) {
      // finished: like the Arduino after setup(), the motors keep their last setting (a "stop" block
      // stops them). After an error, or before a run, they are off.
      if (sim.programError || !sim.programDone) sim.pwmL = sim.pwmR = 0
      sim.actionLeft = LOOP_MS
      return
    }
    let r: IteratorResult<Action>
    try {
      r = sim.program.next()
    } catch (e) {
      sim.programError = e instanceof Error ? e.message : String(e)
      sim.program = null
      continue
    }
    if (r.done) {
      sim.program = null
      sim.programDone = true
      continue
    }
    const a = r.value
    sim.pwmL = Math.max(-255, Math.min(255, a.left))
    sim.pwmR = Math.max(-255, Math.min(255, a.right))
    sim.node = a.node
    sim.actionLeft += Math.max(a.ms, LOOP_MS)
    if (++guard > 5000) {
      sim.programError = 'The program never waits. Put a wait block inside the loop.'
      sim.program = null
    }
  }
}

let wasTouching = false

/** The rover corner (or box corner) that touches: the rover corner deepest inside the box, else the box corner inside the rover. */
function contactPoint(b: Box, fx: number, fz: number): [number, number] {
  const rx = -fz
  const rz = fx
  const corners = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ].map(([a, c]) => {
    const x = sim.x + fx * GEOM.halfLen * a + rx * GEOM.halfWid * c
    const z = sim.z + fz * GEOM.halfLen * a + rz * GEOM.halfWid * c
    return { x, z, depth: Math.min(b.w / 2 - Math.abs(x - b.x), b.d / 2 - Math.abs(z - b.z)) }
  })
  const bestDepth = Math.max(...corners.map((k) => k.depth))
  if (bestDepth > -0.02) {
    // corners touching about equally (a square hit on a flat face) share the contact
    const touching = corners.filter((k) => k.depth > bestDepth - 0.03)
    return [touching.reduce((t, k) => t + k.x, 0) / touching.length, touching.reduce((t, k) => t + k.z, 0) / touching.length]
  }
  // no rover corner inside: a box corner is poking into the rover's side
  let near: [number, number] = [b.x, b.z]
  let nearD = Infinity
  for (const [a, c] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    const x = b.x + (b.w / 2) * a
    const z = b.z + (b.d / 2) * c
    const d = Math.hypot(x - sim.x, z - sim.z)
    if (d < nearD) {
      nearD = d
      near = [x, z]
    }
  }
  return near
}
/** Separating-axis test between the rover rectangle and a box; pushes the rover out. */
function pushOut(b: Box) {
  const fx = Math.cos(sim.heading)
  const fz = -Math.sin(sim.heading)
  const dx = sim.x - b.x
  const dz = sim.z - b.z
  let best = Infinity
  let px = 0
  let pz = 0
  for (const [ax, az] of [
    [1, 0],
    [0, 1],
    [fx, fz],
    [-fz, fx],
  ]) {
    const rover = GEOM.halfLen * Math.abs(fx * ax + fz * az) + GEOM.halfWid * Math.abs(-fz * ax + fx * az)
    const box = (b.w / 2) * Math.abs(ax) + (b.d / 2) * Math.abs(az)
    const dist = dx * ax + dz * az
    const overlap = rover + box - Math.abs(dist)
    if (overlap <= 0) return false
    if (overlap < best) {
      best = overlap
      const sgn = Math.sign(dist) || 1
      px = ax * sgn
      pz = az * sgn
    }
  }
  sim.x += px * best
  sim.z += pz * best
  // The box stops the body moving into it (the wheels keep turning and slip). The contact point is
  // where the rover's outline meets the box: an off-centre hit twists the rover off the corner.
  const [cx, cz] = contactPoint(b, fx, fz)
  contactImpulse(sim.body, sim.heading, (cx - sim.x) / 10, (cz - sim.z) / 10, px, pz)
  return true
}

resetSim('manual')

// dev only: poke at the simulator from the browser console
if (import.meta.env.DEV) Object.assign(window, { __body: BODY, __sim: sim, __distToTrack: distToTrack, __irPoints: irPoints, __stepSim: stepSim, __resetSim: resetSim, __geom: GEOM })
