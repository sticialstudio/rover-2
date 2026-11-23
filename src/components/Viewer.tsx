import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  CameraControls,
  ContactShadows,
  Environment,
  Grid,
  Lightformer,
  useProgress,
} from '@react-three/drei'
import * as THREE from 'three'
import { offsetAt, RoverModel, type PreparedPart } from './RoverModel'
import { useStore } from '../store'
import { chapterOf, STEPS } from '../data/steps'
import { WIRE_GROUPS } from '../data/wiring'
import { ARENA, sim } from '../sim/sim'
import { DriveScene } from './DriveScene'

const HOME_POS: [number, number, number] = [3.6, 2.3, 3.3]
const HOME_TARGET: [number, number, number] = [0, 0.3, 0]
const CODE_POS = HOME_POS.map((v, i) => HOME_TARGET[i] + (v - HOME_TARGET[i]) * 0.8) as [number, number, number]

/** DOM overlay (outside the Canvas) shown until the model has loaded. */
export function Loader() {
  const { progress, active } = useProgress()
  const ready = useStore((s) => s.model !== null)
  if (ready && !active) return null
  return (
    <div className="loader">
      <div className="loader-bar">
        <span style={{ width: `${progress}%` }} />
      </div>
      <p>Loading rover… {progress.toFixed(0)}%</p>
    </div>
  )
}

/** Box of the pieces a step shows: the new pieces, or everything for overview steps. */
function stepBox(parts: PreparedPart[], stepIdx: number) {
  const step = STEPS[stepIdx]
  const box = new THREE.Box3()
  for (const p of parts.flatMap((x) => x.pieces)) {
    if (step.layout === 'exploded') box.union(p.box.clone().translate(p.offsetWorld))
    else if (step.layout === 'complete') box.union(p.box)
    else if (step.cover) {
      // a chapter's cover: everything the chapter builds
      const c = chapterOf(stepIdx)
      const first = p.stages[0]?.step ?? p.step
      if (first > stepIdx && first <= c.end) box.union(p.box.clone().translate(offsetAt(p, first)))
    }
    else if (step.place && p.step <= stepIdx && p.subs.some((x) => x.group === step.place)) {
      // a sub-assembly moving into place: where it starts and where it ends up
      box.union(p.box.clone().translate(offsetAt(p, stepIdx, 0)))
      box.union(p.box.clone().translate(offsetAt(p, stepIdx)))
    } else if (p.step === stepIdx || p.stages.some((x) => x.step === stepIdx)) box.union(p.box.clone().translate(offsetAt(p, stepIdx)))
  }
  // a step that adds nothing (a check): look at what it is about
  if (box.isEmpty() && step.focus)
    for (const p of parts.flatMap((x) => x.pieces)) if (step.focus.includes(p.name)) box.union(p.box.clone().translate(offsetAt(p, stepIdx)))
  return box
}

/** Box of a wiring group: its wires, header pins and the parts it connects. */
function wireBox(parts: PreparedPart[], groupIdx: number) {
  const g = WIRE_GROUPS[groupIdx]
  const names = new Set([...g.wires.map((w) => w.piece), ...(g.pieces ?? [])])
  const box = new THREE.Box3()
  for (const part of parts) {
    for (const p of part.pieces) if (g.parts.includes(part.id) || names.has(p.name)) box.union(p.box)
  }
  return box
}

function Controls({ parts }: { parts: PreparedPart[] | null }) {
  const ref = useRef<CameraControls>(null)
  const mode = useStore((s) => s.mode)
  const step = useStore((s) => s.step)
  const wireGroup = useStore((s) => s.wireGroup)
  const selected = useStore((s) => s.selected)
  const resetTick = useStore((s) => s.resetTick)
  const explode = useStore((s) => s.explode)
  const driveCam = useStore((s) => s.driveCam)
  const dragging = useRef(false)
  const last = useRef({ x: sim.x, z: sim.z, resets: sim.resets })
  const { camera, size } = useThree()

  // Drive: place the camera for the chosen view (and after every reset).
  const placeDriveCam = useCallback(
    (smooth: boolean) => {
      const c = ref.current
      if (!c) return
      last.current = { x: sim.x, z: sim.z, resets: sim.resets }
      const st = useStore.getState()
      if (st.driveCam === 'top') {
        const cam = camera as THREE.PerspectiveCamera
        const vFov = THREE.MathUtils.degToRad(cam.fov)
        const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (size.width / size.height))
        const dist = Math.max(ARENA.d / 2 / Math.tan(vFov / 2), ARENA.w / 2 / Math.tan(hFov / 2)) * 1.08
        c.setLookAt(0, dist, 0.01, 0, 0, 0, smooth)
        return
      }
      const fx = Math.cos(sim.heading)
      const fz = -Math.sin(sim.heading)
      c.setLookAt(sim.x - fx * 7, 4.6, sim.z - fz * 7, sim.x + fx * 1.5, 0.3, sim.z + fz * 1.5, smooth)
    },
    [camera, size.width, size.height],
  )

  useEffect(() => {
    if (mode === 'drive' || mode === 'missions') placeDriveCam(true)
  }, [mode, driveCam, resetTick, placeDriveCam])

  // First frame: start at home, or behind the rover when the page opens on the Drive tab.
  useEffect(() => {
    const m0 = useStore.getState().mode
    if (m0 === 'drive' || m0 === 'missions') placeDriveCam(false)
    else ref.current?.setLookAt(...HOME_POS, ...HOME_TARGET, false)
    if (import.meta.env.DEV) Object.assign(window, { __cc: ref.current })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Explore: home view on reset / when coming back from the guide.
  useEffect(() => {
    if (mode === 'explore') ref.current?.setLookAt(...HOME_POS, ...HOME_TARGET, true)
    // code view: the 3D is a small inset, so sit closer
    if (mode === 'code') ref.current?.setLookAt(...CODE_POS, ...HOME_TARGET, true)
  }, [resetTick, mode])

  // Assemble / wire: frame the step (or wiring group) from its preferred direction.
  useEffect(() => {
    const c = ref.current
    if (!c || !parts || (mode !== 'assemble' && mode !== 'wire')) return
    const box = mode === 'assemble' ? stepBox(parts, step) : wireBox(parts, wireGroup)
    const view = mode === 'assemble' ? STEPS[step].view : WIRE_GROUPS[wireGroup].view
    if (box.isEmpty()) return
    const center = box.getCenter(new THREE.Vector3())
    const radius = Math.max(0.55, box.getBoundingSphere(new THREE.Sphere()).radius)
    const cam = camera as THREE.PerspectiveCamera
    const vFov = THREE.MathUtils.degToRad(cam.fov)
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (size.width / size.height))
    const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 1.3
    const dir = new THREE.Vector3(...view).normalize()
    const pos = center.clone().addScaledVector(dir, dist)
    // stay above the floor, except in "turn it over" steps that look from underneath
    if (!(mode === 'assemble' && STEPS[step].flip)) pos.y = Math.max(pos.y, 0.15)
    c.setLookAt(pos.x, pos.y, pos.z, center.x, center.y, center.z, true)
  }, [mode, step, wireGroup, parts, resetTick, camera, size.width, size.height])

  // Frame the selected part (wait for the explode animation to settle first).
  useEffect(() => {
    const c = ref.current
    if (!c || !parts || !selected || mode !== 'explore') return
    const part = parts.find((p) => p.id === selected)
    if (!part) return
    const id = setTimeout(() => {
      const box = new THREE.Box3().setFromObject(part.node)
      const size = box.getSize(new THREE.Vector3()).length()
      box.expandByScalar(Math.max(0.3, size * 0.6))
      c.fitToBox(box, true, { cover: false })
    }, 350)
    return () => clearTimeout(id)
  }, [selected, parts, explode, mode])

  // Pull the camera back (and aim higher) while the rover is exploded so every part stays in view.
  useEffect(() => {
    const c = ref.current
    if (!c || selected || mode !== 'explore') return
    const id = setTimeout(() => {
      const home = Math.hypot(HOME_POS[0] - HOME_TARGET[0], HOME_POS[1] - HOME_TARGET[1], HOME_POS[2] - HOME_TARGET[2])
      c.moveTo(0, HOME_TARGET[1] + 0.45 * explode, 0, true)
      c.dollyTo(home * (1 + 0.55 * explode), true)
    }, 60)
    return () => clearTimeout(id)
  }, [explode, selected, mode])

  useFrame((_, delta) => {
    const c = ref.current
    if (!c) return
    const st = useStore.getState()
    if (st.mode === 'drive' || st.mode === 'missions') {
      if (sim.resets !== last.current.resets) return placeDriveCam(false)
      if (st.driveCam === 'top') return
      // follow the rover: move the target (and camera) by how far it drove
      const dx = sim.x - last.current.x
      const dz = sim.z - last.current.z
      last.current.x = sim.x
      last.current.z = sim.z
      if (dx || dz) {
        const t = c.getTarget(new THREE.Vector3(), true)
        c.moveTo(t.x + dx, t.y, t.z + dz, false)
      }
      // chase: swing round behind the rover
      if (st.driveCam === 'chase' && !dragging.current) {
        let az = Math.atan2(-Math.cos(sim.heading), Math.sin(sim.heading))
        const cur = c.azimuthAngle
        az += Math.round((cur - az) / (Math.PI * 2)) * Math.PI * 2
        c.rotateAzimuthTo(cur + (az - cur) * Math.min(1, delta * 2.5), false)
      }
      return
    }
    if (st.autoRotate && !dragging.current) c.rotate(delta * 0.18, 0, false)
  })

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={0.6}
      maxDistance={mode === 'drive' || mode === 'missions' ? 45 : 8}
      // building: turn the rover over to see under the plates; driving: stay above the floor
      maxPolarAngle={mode === 'assemble' || mode === 'explore' ? Math.PI * 0.97 : Math.PI / 2.05}
      smoothTime={0.35}
      onStart={() => {
        dragging.current = true
        useStore.getState().stopAutoRotate()
      }}
      onEnd={() => (dragging.current = false)}
    />
  )
}

/** The floor (grid and contact shadow): hidden while the camera looks up from under it (turn-it-over steps). */
function Floor({ visible, children }: { visible: boolean; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ camera }) => {
    if (ref.current) ref.current.visible = visible && camera.position.y > 0.02
  })
  return <group ref={ref}>{children}</group>
}

export function Viewer({ dark }: { dark: boolean }) {
  const [parts, setParts] = useState<PreparedPart[] | null>(null)
  const onReady = useCallback((p: PreparedPart[]) => setParts(p), [])
  const drive = useStore((s) => s.mode === 'drive' || s.mode === 'missions')

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 35, position: HOME_POS, near: 0.05, far: 100 }}
      gl={{ antialias: true, alpha: true }}
      onPointerMissed={(e) => {
        if (e.button !== 0) return
        const s = useStore.getState()
        if (s.mode === 'wire') s.pinWire(null)
        else s.select(null)
      }}
    >
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 5, 2]} intensity={1.6} />
      <Environment resolution={256}>
        <group rotation={[-Math.PI / 3, 0, 1]}>
          <Lightformer form="circle" intensity={4} rotation-x={Math.PI / 2} position={[0, 5, -9]} scale={2} />
          <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[-5, 1, -1]} scale={2} />
          <Lightformer form="circle" intensity={2} rotation-y={Math.PI / 2} position={[-5, -1, -1]} scale={2} />
          <Lightformer form="circle" intensity={2} rotation-y={-Math.PI / 2} position={[10, 1, 0]} scale={8} />
          <Lightformer form="ring" color="#ffd9b0" intensity={1.5} position={[0, 2, 6]} scale={4} />
        </group>
      </Environment>

      <Suspense fallback={null}>
        <RoverModel onReady={onReady} />
      </Suspense>

      {drive && <DriveScene parts={parts} dark={dark} />}
      <Floor visible={!drive}>
        <ContactShadows position={[0, 0.001, 0]} opacity={dark ? 0.7 : 0.45} scale={6} blur={2.4} far={1.5} resolution={512} />
        <Grid
          position={[0, -0.001, 0]}
          infiniteGrid
          cellSize={0.1}
          sectionSize={0.5}
          cellThickness={0.6}
          sectionThickness={1}
          cellColor={dark ? '#3a3026' : '#d8c9b0'}
          sectionColor={dark ? '#5a4836' : '#c2a77f'}
          fadeDistance={9}
          fadeStrength={1.5}
        />
      </Floor>
      <Controls parts={parts} />
    </Canvas>
  )
}
