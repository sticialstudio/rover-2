import { create } from 'zustand'
import { STEPS } from './data/steps'
import { WIRE_GROUPS } from './data/wiring'
import { PROGRAMS } from './data/programs'
import { ROOM, resetSim, setWorld, type DriveMode } from './sim/sim'
import { enterMissions, useMissions } from './missions/missions'

export interface ModelInfo {
  pieces: Record<string, number>
  sizeMm: [number, number, number]
}

export type Mode = 'explore' | 'assemble' | 'wire' | 'code' | 'missions' | 'drive'
export type DriveCam = 'chase' | 'free' | 'top'
/** drive the simulated rover, or the real one (the 3D twin mirrors the commands) */
export type DriveSource = 'sim' | 'real'

interface State {
  mode: Mode
  selected: string | null
  hovered: string | null
  explode: number
  autoRotate: boolean
  isolate: boolean
  resetTick: number
  model: ModelInfo | null
  /** assembly */
  step: number
  /** performance.now() when the current step (or its replay) started */
  stepStamp: number
  ghost: boolean
  /** wiring */
  wireGroup: number
  /** wire under the pointer (list or 3D) */
  wire: string | null
  /** wire clicked to keep it highlighted */
  wirePinned: string | null
  /** fade the wooden frame so the wires show */
  xray: boolean
  /** code */
  program: number
  /** flowchart node under the pointer (or the node owning the hovered code line) */
  codeNode: string | null
  /** part to glow for that node */
  codePart: string | null
  /** drive */
  driveMode: DriveMode
  driveCam: DriveCam
  driveSource: DriveSource

  setMode: (m: Mode) => void
  select: (id: string | null) => void
  hover: (id: string | null) => void
  setExplode: (v: number) => void
  toggleExplode: () => void
  toggleAutoRotate: () => void
  stopAutoRotate: () => void
  toggleIsolate: () => void
  resetView: () => void
  setModel: (m: ModelInfo) => void
  setStep: (i: number) => void
  nextStep: () => void
  prevStep: () => void
  replay: () => void
  toggleGhost: () => void
  setWireGroup: (i: number) => void
  hoverWire: (id: string | null) => void
  pinWire: (id: string | null) => void
  toggleXray: () => void
  setProgram: (i: number) => void
  setCodeNode: (id: string | null, part?: string | null) => void
  setDriveMode: (m: DriveMode) => void
  setDriveCam: (c: DriveCam) => void
  setDriveSource: (s: DriveSource) => void
}

const clampStep = (i: number) => Math.min(STEPS.length - 1, Math.max(0, i))

export const useStore = create<State>((set, get) => ({
  mode: 'explore',
  selected: null,
  hovered: null,
  explode: 0,
  autoRotate: true,
  isolate: true,
  resetTick: 0,
  model: null,
  step: 0,
  stepStamp: 0,
  ghost: false,
  wireGroup: 0,
  wire: null,
  wirePinned: null,
  xray: true,
  program: 0,
  codeNode: null,
  codePart: null,
  driveMode: 'manual',
  driveCam: 'chase',
  driveSource: 'sim',

  setMode: (mode) => {
    const prev = get().mode
    if (prev === mode) return
    // the Missions tab has its own worlds; the Drive tab gets its room back
    if (prev === 'missions') {
      useMissions.getState().stop()
      setWorld(ROOM)
      resetSim(get().driveMode)
    }
    if (mode === 'missions') enterMissions()
    set((s) =>
      s.mode === mode
        ? {}
        : {
            mode,
            selected: null,
            hovered: null,
            wire: null,
            wirePinned: null,
            codeNode: null,
            codePart: null,
            explode: 0,
            autoRotate: mode === 'explore' ? s.autoRotate : mode === 'code',
            stepStamp: performance.now(),
            // missions: see the whole room from above
            driveCam: mode === 'missions' ? 'top' : s.driveCam,
          },
    )
  },
  select: (id) => set({ selected: id }),
  hover: (id) => set({ hovered: id }),
  setExplode: (v) => set({ explode: Math.min(1, Math.max(0, v)) }),
  toggleExplode: () => set((s) => ({ explode: s.explode > 0.5 ? 0 : 1 })),
  toggleAutoRotate: () => set((s) => ({ autoRotate: !s.autoRotate })),
  stopAutoRotate: () => set({ autoRotate: false }),
  toggleIsolate: () => set((s) => ({ isolate: !s.isolate })),
  resetView: () => set((s) => ({ resetTick: s.resetTick + 1, selected: null })),
  setModel: (model) => set({ model }),
  setStep: (i) => {
    const step = clampStep(i)
    if (step !== get().step) set({ step, stepStamp: performance.now(), hovered: null })
  },
  nextStep: () => get().setStep(get().step + 1),
  prevStep: () => get().setStep(get().step - 1),
  replay: () => set({ stepStamp: performance.now() }),
  toggleGhost: () => set((s) => ({ ghost: !s.ghost })),
  setWireGroup: (i) => {
    const g = Math.min(WIRE_GROUPS.length - 1, Math.max(0, i))
    if (g !== get().wireGroup) set({ wireGroup: g, wire: null, wirePinned: null, hovered: null })
  },
  hoverWire: (id) => set({ wire: id }),
  pinWire: (id) => set({ wirePinned: id }),
  toggleXray: () => set((s) => ({ xray: !s.xray })),
  setProgram: (i) => {
    const p = Math.min(PROGRAMS.length - 1, Math.max(0, i))
    if (p !== get().program) set({ program: p, codeNode: null, codePart: null })
  },
  setCodeNode: (id, part = null) => set({ codeNode: id, codePart: id ? part : null }),
  setDriveMode: (driveMode) => {
    resetSim(driveMode)
    set({ driveMode, codeNode: null })
  },
  setDriveCam: (driveCam) => set({ driveCam }),
  setDriveSource: (driveSource) => {
    // the real rover takes the same letters as the "You drive" mode, so the twin runs that
    if (driveSource === 'real') {
      resetSim('manual', false)
      set({ driveSource, driveMode: 'manual', codeNode: null })
    } else set({ driveSource })
  },
}))
