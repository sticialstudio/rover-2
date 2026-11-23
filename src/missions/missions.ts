// Missions: a world to drive in, the blocks allowed, a goal the simulator checks while the program
// runs, and stars for doing it well. Progress and each mission's program are saved in this browser.

import { create } from 'zustand'
import { ZONES, resetSim, setWorld, sim, type World } from '../sim/sim'
import { MISSIONS } from './pack'
import { editor } from '../blocks/editor'
import { compileProgram } from '../blocks/runner'
import { checkVersion, motors as linkMotors, stop as linkStop, useLink } from '../link/link'
import type { LessonPage } from './lessons'

export interface RunResult {
  passed: boolean
  reason: string
  /** simulated seconds */
  time: number
  bumps: number
  blocks: number
  /** ultrasonic reading at the end */
  cm: number
  /** where the rover ended, and how far it drove (scene units: 1 = 10 cm) */
  x: number
  z: number
  odometer: number
  /** a mission's own measure (e.g. arrival time) */
  score?: number
}

/** What a mission's check sees, every simulation step. */
export interface CheckState {
  time: number
  bumps: number
  cm: number
  /** the rover has (nearly) stopped moving, for this long (s) */
  stoppedFor: number
  /** the program has finished (no more blocks to run) */
  programDone: boolean
  /** is the rover's centre inside this zone? */
  inZone: (id: string) => boolean
  /** zones the rover has been in, and the order it first entered them */
  entered: Set<string>
  order: string[]
}
export type Check = { pass: string; score?: number } | { fail: string } | null

export interface Mission {
  id: string
  chapter: string
  title: string
  /** the story: what to do and why */
  brief: string
  /** the goal in one line */
  goal: string
  /** a fresh world for each run (sensor missions move things about, so timing alone can't win) */
  world: () => World
  /** block types in the toolbox, or 'all' */
  toolbox: string[] | 'all'
  hints: string[]
  /** simulated seconds before "time's up" (Infinity: no limit) */
  timeLimit: number
  /** makes the check for one run (it can keep its own state); null: no goal (sandbox) */
  check: (() => (s: CheckState) => Check) | null
  /** star 1 is passing; each star is only earned with the ones before it */
  stars: { text: string; test: (r: RunResult) => boolean }[]
  /** a lesson: guided pages before the goal (lessons have no number in the list) */
  lesson?: LessonPage[]
}

const START_ONLY = { blocks: { languageVersion: 0, blocks: [{ type: 'rover_start', x: 30, y: 30 }] } }

export { MISSIONS }
export const MISSION_BY_ID: Record<string, Mission> = Object.fromEntries(MISSIONS.map((m) => [m.id, m]))
/** chapters in order, with their missions */
export const CHAPTERS = MISSIONS.reduce<{ title: string; missions: Mission[] }[]>((list, m) => {
  const last = list[list.length - 1]
  if (last?.title === m.chapter) last.missions.push(m)
  else list.push({ title: m.chapter, missions: [m] })
  return list
}, [])

// ---------------------------------------------------------------- saved progress
const KEY = 'rover-missions-v1'
interface Saved {
  stars: Record<string, number>
  programs: Record<string, object>
}
function readSaved(): Saved {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { stars: {}, programs: {}, ...JSON.parse(raw) }
  } catch {
    /* storage unavailable */
  }
  return { stars: {}, programs: {} }
}
const saved = readSaved()
function writeSaved() {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved))
  } catch {
    /* storage unavailable */
  }
}
/** Forget every star and saved program (a fresh start, e.g. for the next student on this computer). */
export function resetProgress() {
  saved.stars = {}
  saved.programs = {}
  writeSaved()
  editor.api?.load(START_ONLY)
  useMissions.setState({ stars: {}, result: null, earned: 0, status: 'idle' })
}
export function savedProgram(id: string): object {
  return saved.programs[id] ?? START_ONLY
}
export function saveProgram(id: string, json: object) {
  saved.programs[id] = json
  writeSaved()
}

// ---------------------------------------------------------------- running a mission
export type RunStatus = 'idle' | 'running' | 'passed' | 'failed'

interface MissionsState {
  id: string
  status: RunStatus
  result: RunResult | null
  /** stars earned in the last run */
  earned: number
  /** best stars per mission */
  stars: Record<string, number>
  speed: 1 | 2 | 4
  showCode: boolean
  /** the program is driving the real rover (sensors from the rover, motors sent to it) */
  live: boolean
  /** what happened in the last live run */
  liveNote: string | null
  select: (id: string) => void
  run: () => void
  runLive: () => Promise<void>
  stop: () => void
  reset: () => void
  setSpeed: (s: 1 | 2 | 4) => void
  toggleCode: () => void
}

const mission = () => MISSION_BY_ID[useMissions.getState().id] ?? MISSIONS[0]

/** Put the current mission's world in the simulator, the rover on its start, nothing running. */
function prepare() {
  setWorld(mission().world())
  resetSim('program')
  sim.onStep = null
  sim.sensorOverride = null
}

function finish(passed: boolean, reason: string, blocks: number, score?: number) {
  const m = mission()
  sim.onStep = null
  if (!passed) {
    sim.program = null
    sim.pwmL = sim.pwmR = 0
  }
  const result: RunResult = {
    passed,
    reason,
    time: Math.round(sim.time * 10) / 10,
    bumps: sim.bumps,
    blocks,
    cm: sim.cm,
    x: sim.x,
    z: sim.z,
    odometer: sim.odometer,
    score,
  }
  let earned = 0
  for (const s of m.stars) {
    if (!s.test(result)) break
    earned++
  }
  if (!passed) earned = 0
  const best = Math.max(earned, saved.stars[m.id] ?? 0)
  saved.stars[m.id] = best
  writeSaved()
  useMissions.setState({ status: passed ? 'passed' : 'failed', result, earned, stars: { ...saved.stars } })
  editor.api?.highlight(null)
}

export const useMissions = create<MissionsState>((set, get) => ({
  id: 'first-drive',
  status: 'idle',
  result: null,
  earned: 0,
  stars: { ...saved.stars },
  speed: 1,
  showCode: false,
  live: false,
  liveNote: null,

  select: (id) => {
    if (!MISSION_BY_ID[id]) return
    const api = editor.api
    if (api) saveProgram(get().id, api.save())
    set({ id, status: 'idle', result: null, earned: 0 })
    prepare()
    if (api) {
      api.setToolbox(MISSION_BY_ID[id].toolbox)
      api.load(savedProgram(id))
    }
  },

  run: () => {
    const api = editor.api
    if (!api) return
    if (get().live) get().stop()
    const m = mission()
    saveProgram(m.id, api.save())
    prepare()
    const blocks = api.count()
    try {
      sim.program = compileProgram(api.js())
    } catch (e) {
      set({
        status: 'failed',
        result: { passed: false, reason: `The program could not start: ${e instanceof Error ? e.message : e}`, time: 0, bumps: 0, blocks, cm: sim.cm, x: sim.x, z: sim.z, odometer: 0 },
      })
      return
    }
    sim.running = true
    set({ status: 'running', result: null, earned: 0 })

    let stoppedFor = 0
    const zoneOf = (id: string) => ZONES.find((z) => z.id === id)
    const check = m.check?.()
    const state: CheckState = {
      entered: new Set(),
      order: [],
      time: 0,
      bumps: 0,
      cm: 999,
      stoppedFor: 0,
      programDone: false,
      inZone: (id) => {
        const z = zoneOf(id)
        return !!z && Math.abs(sim.x - z.x) <= z.w / 2 && Math.abs(sim.z - z.z) <= z.d / 2
      },
    }
    sim.onStep = (dt) => {
      const still = Math.abs(sim.body.v) < 0.004 && Math.abs(sim.body.w) < 0.05
      stoppedFor = still ? stoppedFor + dt : 0
      if (sim.programError) return finish(false, sim.programError, blocks)
      if (!check) return
      Object.assign(state, { time: sim.time, bumps: sim.bumps, cm: sim.cm, stoppedFor, programDone: sim.programDone })
      for (const z of ZONES)
        if (!state.entered.has(z.id) && state.inZone(z.id)) {
          state.entered.add(z.id)
          state.order.push(z.id)
        }
      const r = check(state)
      if (r && 'pass' in r) return finish(true, r.pass, blocks, r.score)
      if (r && 'fail' in r) return finish(false, r.fail, blocks)
      if (sim.time > m.timeLimit) finish(false, 'Time’s up!', blocks)
    }
  },

  stop: () => {
    if (get().live) linkStop()
    sim.onStep = null
    sim.sensorOverride = null
    sim.program = null
    sim.programDone = false
    sim.pwmL = sim.pwmR = 0
    editor.api?.highlight(null)
    set({ status: 'idle', live: false })
  },

  runLive: async () => {
    const api = editor.api
    if (!api || useLink.getState().status !== 'connected') return
    get().stop()
    set({ liveNote: 'Checking the rover’s sketch…' })
    if (!(await checkVersion())) {
      set({ liveNote: 'The rover did not answer. Upload the latest rover_link.ino (Code tab, “Web control”) and connect again.' })
      return
    }
    saveProgram(get().id, api.save())
    prepare()
    try {
      sim.program = compileProgram(api.js())
    } catch (e) {
      set({ liveNote: `The program could not start: ${e instanceof Error ? e.message : e}` })
      return
    }
    // real time only, and the real rover's sensors in place of the simulated ones
    sim.speedUp = 1
    sim.running = true
    sim.sensorOverride = () => {
      const t = useLink.getState().telemetry
      if (!t) return
      sim.cm = t.cm
      sim.irL = t.irL
      sim.irR = t.irR
    }
    const end = (note: string) => {
      get().stop()
      set({ liveNote: note })
    }
    sim.onStep = () => {
      const link = useLink.getState()
      if (link.status !== 'connected') return end('The link to the rover dropped. The rover stops by itself after 1 second.')
      if (!link.telemetry || performance.now() - link.telemetry.at > 1500) return end('No sensor readings from the rover for over a second, so the program stopped.')
      if (sim.programError) return end(sim.programError)
      // the program's motor speeds go to the real rover
      linkMotors(sim.pwmL, sim.pwmR)
      if (sim.programDone && !sim.pwmL && !sim.pwmR) return end(`Program finished after ${sim.time.toFixed(1)} s.`)
    }
    set({ status: 'running', live: true, result: null, earned: 0, speed: 1, liveNote: 'Running on the real rover. Press Stop at any time.' })
  },

  reset: () => {
    get().stop()
    prepare()
    set({ result: null, earned: 0 })
  },

  setSpeed: (speed) => {
    if (get().live) return // live runs are real time
    sim.speedUp = speed
    set({ speed })
  },
  toggleCode: () => set((s) => ({ showCode: !s.showCode })),
}))

/** Entering the Missions tab: the current mission's world. Leaving: the Drive tab's room comes back. */
export function enterMissions() {
  prepare()
  sim.speedUp = useMissions.getState().speed
}

// dev only: drive the Missions tab from the browser console
if (import.meta.env.DEV) {
  /** forget some missions' stars and programs (e.g. after testing them), keeping everything else */
  const forget = (...ids: string[]) => {
    for (const id of ids) {
      delete saved.stars[id]
      delete saved.programs[id]
    }
    writeSaved()
    useMissions.setState({ stars: { ...saved.stars } })
  }
  Object.assign(window, { __missions: useMissions, __editor: editor, __resetProgress: resetProgress, __forget: forget })
}
