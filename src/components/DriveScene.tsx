import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import { ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { ARENA, BOXES, GEOM, TAPE_WIDTH, TAPES, ZONES, irPoints, onWorldChange, sim, stepSim, syncBody, usOrigin, worldVersion } from '../sim/sim'
import type { PreparedPart } from './RoverModel'
import { useStore } from '../store'
import { useLink } from '../link/link'

const PX = 60 // floor texture pixels per unit (6 px per cm)
const STEP = 1 / 240

/** Floor: light tiles with the black tape (redrawn when a mission changes the world). */
function useFloorTexture(rev: number) {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = ARENA.w * PX
    c.height = ARENA.d * PX
    const g = c.getContext('2d')!
    g.fillStyle = '#efe7d8'
    g.fillRect(0, 0, c.width, c.height)
    // 30 cm floor tiles
    g.strokeStyle = 'rgba(120, 95, 60, 0.18)'
    g.lineWidth = 2
    for (let x = 0; x <= ARENA.w; x += 3) {
      g.beginPath()
      g.moveTo(x * PX, 0)
      g.lineTo(x * PX, c.height)
      g.stroke()
    }
    for (let z = 0; z <= ARENA.d; z += 3) {
      g.beginPath()
      g.moveTo(0, z * PX)
      g.lineTo(c.width, z * PX)
      g.stroke()
    }
    // goal zones, under the tape
    for (const zone of ZONES) {
      const x0 = (zone.x - zone.w / 2 + ARENA.w / 2) * PX
      const z0 = (zone.z - zone.d / 2 + ARENA.d / 2) * PX
      g.fillStyle = zone.color + '55'
      g.fillRect(x0, z0, zone.w * PX, zone.d * PX)
      g.strokeStyle = zone.color
      g.lineWidth = 6
      g.setLineDash([18, 12])
      g.strokeRect(x0 + 3, z0 + 3, zone.w * PX - 6, zone.d * PX - 6)
      g.setLineDash([])
      if (zone.label) {
        g.fillStyle = zone.color
        g.font = `700 ${Math.round(Math.min(0.8, zone.d * 0.3) * PX)}px Inter, system-ui, sans-serif`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(zone.label, (zone.x + ARENA.w / 2) * PX, (zone.z + ARENA.d / 2) * PX)
      }
    }
    // tape
    g.strokeStyle = '#1b1714'
    g.lineWidth = TAPE_WIDTH * PX
    g.lineJoin = 'round'
    g.lineCap = 'butt'
    for (const tape of TAPES) {
      g.beginPath()
      tape.points.forEach(([x, z], i) => {
        const px = (x + ARENA.w / 2) * PX
        const pz = (z + ARENA.d / 2) * PX
        if (i === 0) g.moveTo(px, pz)
        else g.lineTo(px, pz)
      })
      if (tape.closed) g.closePath()
      g.stroke()
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev])
}

/** Soft dark square used as a fake shadow under each box. */
function useBlobTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(32, 32, 8, 32, 32, 32)
    grad.addColorStop(0, 'rgba(40,25,10,0.55)')
    grad.addColorStop(1, 'rgba(40,25,10,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    return new THREE.CanvasTexture(c)
  }, [])
}

/** A flat wedge for the ultrasonic beam: unit length along +x, ±15°. */
function useBeamGeometry() {
  return useMemo(() => {
    const t = Math.tan((15 * Math.PI) / 180)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, -t, 1, 0, t], 3))
    g.computeVertexNormals()
    return g
  }, [])
}

export function DriveScene({ parts, dark }: { parts: PreparedPart[] | null; dark: boolean }) {
  const rev = useSyncExternalStore(onWorldChange, worldVersion)
  const floor = useFloorTexture(rev)
  const blob = useBlobTexture()
  const beamGeo = useBeamGeometry()
  const acc = useRef(0)
  const shadowRef = useRef<THREE.Group>(null)
  const beamRef = useRef<THREE.Mesh>(null)
  const beamMat = useRef<THREE.MeshBasicMaterial>(null)
  const hitRef = useRef<THREE.Mesh>(null)
  const irRefs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)]

  // Measure the real rover: sensor positions, wheel track and size.
  // Use the boxes recorded when the model loaded (rover at the origin, facing +x), never the live
  // scene graph: in the Drive tab the whole rover has already been moved and turned.
  useEffect(() => {
    if (!parts) return
    const part = (id: string) => parts.find((p) => p.id === id)
    const us = part('ultrasonic_sensor')
    if (us) {
      const box = new THREE.Box3()
      us.pieces.forEach((p) => box.union(p.box))
      GEOM.usAhead = box.max.x
      GEOM.usHeight = box.getCenter(new THREE.Vector3()).y
    }
    const ir = part('ir_sensors')?.pieces
    if (ir && ir.length >= 2) {
      const sorted = [...ir].sort((a, b) => a.centerWorld.z - b.centerWorld.z) // left (-z) first
      GEOM.irAhead = sorted[0].centerWorld.x
      GEOM.irLeft = sorted[0].centerWorld.z
      GEOM.irRight = sorted[sorted.length - 1].centerWorld.z
    }
    const wheels = part('wheels')?.pieces
    if (wheels?.length) {
      GEOM.track = (wheels.reduce((s, w) => s + Math.abs(w.centerWorld.z), 0) / wheels.length) * 2
      GEOM.wheelbase = (wheels.reduce((s, w) => s + Math.abs(w.centerWorld.x - wheels[0].centerWorld.x), 0) / wheels.length) * 2
      GEOM.wheelR = wheels.reduce((s, w) => s + w.box.getSize(new THREE.Vector3()).y, 0) / wheels.length / 2
    }
    const all = new THREE.Box3()
    parts.forEach((p) => p.pieces.forEach((x) => all.union(x.box)))
    const size = all.getSize(new THREE.Vector3())
    GEOM.halfLen = size.x / 2
    GEOM.halfWid = size.z / 2
    syncBody()
  }, [parts])

  useFrame((_, delta) => {
    // the Missions tab can run faster than real time
    const speed = useStore.getState().mode === 'missions' ? sim.speedUp : 1
    acc.current = Math.min(acc.current + delta * speed, 0.1 * speed)
    while (acc.current >= STEP) {
      stepSim(STEP)
      acc.current -= STEP
    }

    shadowRef.current?.position.set(sim.x, 0.008, sim.z)

    // Real rover: show what its sensors report (the twin's room is imaginary).
    const real = useStore.getState().driveSource === 'real'
    const tl = real ? useLink.getState().telemetry : null
    const fresh = tl && performance.now() - tl.at < 1500 ? tl : null
    const cm = real ? (fresh ? fresh.cm : null) : sim.cm
    const irL = real ? fresh?.irL : sim.irL
    const irR = real ? fresh?.irR : sim.irR

    // ultrasonic beam: as long as the echo distance (or the 4 m range)
    const [ox, oz] = usOrigin()
    const len = cm === null || cm >= 999 ? 40 : Math.max(0.05, cm / 10)
    if (beamRef.current) {
      beamRef.current.visible = cm !== null
      beamRef.current.position.set(ox, GEOM.usHeight, oz)
      beamRef.current.rotation.y = sim.heading
      beamRef.current.scale.set(len, 1, len)
    }
    if (beamMat.current) beamMat.current.color.set(cm !== null && cm < sim.params.SAFE_CM ? '#ff4a2e' : real ? '#3b7fc4' : '#2f9e6e')
    if (hitRef.current) {
      hitRef.current.visible = !real && !!sim.hit
      if (sim.hit) hitRef.current.position.set(sim.hit[0], GEOM.usHeight, sim.hit[1])
    }
    // IR spots on the floor: orange while the sensor is over the tape
    irPoints().forEach(([x, z], i) => {
      const m = irRefs[i].current
      if (!m) return
      m.position.set(x, 0.02, z)
      const dark = i === 0 ? irL : irR
      ;(m.material as THREE.MeshBasicMaterial).color.set(dark === undefined ? '#9a8771' : dark ? '#ff7a1a' : '#58c08a')
    })
  })

  return (
    <group>
      <mesh key={rev} rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ARENA.w, ARENA.d]} />
        <meshStandardMaterial map={floor} roughness={0.9} />
      </mesh>
      {/* the room beyond the walls */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.06, 0]}>
        <planeGeometry args={[120, 120]} />
        <meshBasicMaterial color={dark ? '#1c1712' : '#e2d6c2'} />
      </mesh>

      {BOXES.map((b, i) => (
        <group key={`${rev}-${i}`}>
          <mesh position={[b.x, b.h / 2, b.z]}>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial color={b.wall ? '#b98a52' : i % 2 ? '#c99a62' : '#a8784a'} roughness={0.8} />
          </mesh>
          {!b.wall && (
            <mesh rotation-x={-Math.PI / 2} position={[b.x, 0.012, b.z]}>
              <planeGeometry args={[b.w + 0.9, b.d + 0.9]} />
              <meshBasicMaterial map={blob} transparent depthWrite={false} />
            </mesh>
          )}
        </group>
      ))}

      <mesh ref={beamRef} geometry={beamGeo}>
        <meshBasicMaterial ref={beamMat} transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh ref={hitRef}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshBasicMaterial color="#ff4a2e" />
      </mesh>
      {irRefs.map((r, i) => (
        <mesh key={i} ref={r} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.06, 20]} />
          <meshBasicMaterial />
        </mesh>
      ))}

      <group ref={shadowRef}>
        <ContactShadows opacity={dark ? 0.7 : 0.5} scale={4} blur={2.2} far={1.5} resolution={256} />
      </group>
    </group>
  )
}
