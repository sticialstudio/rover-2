import { useEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { PART_BY_ID, PARTS } from '../data/parts'
import { chapterOf, STEPS, SUBASSEMBLIES, UNDER_DECK, type Side } from '../data/steps'
import { WIRE_BY_ID, WIRE_GROUPS } from '../data/wiring'
import { WIRE_ROUTES } from '../data/wireRoutes'
import { PROGRAMS } from '../data/programs'
import { sim } from '../sim/sim'
import { useStore } from '../store'

export const MODEL_URL = `${import.meta.env.BASE_URL}models/rover.glb`
/** Longest side of the rover in scene units. */
const TARGET_SIZE = 2

interface MatState {
  mat: THREE.MeshStandardMaterial
  opacity: number
  transparent: boolean
  depthWrite: boolean
  emissive: THREE.Color
  emissiveIntensity: number
}

export interface Piece {
  /** Blender object name */
  name: string
  partId: string
  obj: THREE.Object3D
  mats: MatState[]
  base: THREE.Vector3
  /** world-space box when assembled */
  box: THREE.Box3
  centerWorld: THREE.Vector3
  /** exploded-view displacement at explode = 1 (world, and in the piece's parent space) */
  offsetWorld: THREE.Vector3
  offsetLocal: THREE.Vector3
  /** assembly: step index, order inside the step, and where it flies in from (parent space) */
  step: number
  order: number
  approachLocal: THREE.Vector3
  /** assembly: where it comes from to slide into place (world, unit) and how far */
  approachDir: THREE.Vector3
  approachDist: number
  /** set every frame: may the pointer pick this piece? */
  pickable: boolean
  /** wires only: the two ends (world, assembled), device end first, shield end second */
  ends?: [THREE.Vector3, THREE.Vector3]
  /** wheels only: axle centre and direction in the parent's space, rest orientation, which side */
  wheel?: { pivot: THREE.Vector3; axis: THREE.Vector3; rest: THREE.Quaternion; left: boolean }
  /** wires only: the pieces each end is plugged into; the cable stretches between them when exploded */
  cable?: Cable
  /** wires laid in stages (assembly): steps before `step` that lay part of the wire, each with the stretch
   *  drawn from then on (0..1 from the device end). At `step` the whole wire is drawn. */
  stages: { step: number; lo: number; hi: number }[]
  /** assembly: the sub-assemblies this piece is built in (steps.ts SUBASSEMBLIES); each one is drawn moved
   *  aside by its offset until the step that puts it in place */
  subs: { group: string; world: THREE.Vector3; local: THREE.Vector3 }[]
  /** connector housings: the wire end they sit on (0 = device end, 1 = board end) */
  plugOf?: { wire: Piece; end: 0 | 1 }
  /** housings: their pose at rest, so they can ride on the loose end of a half-laid wire */
  tip?: { origin: THREE.Vector3; at: THREE.Vector3; dir: THREE.Vector3; quat: THREE.Quaternion }
}

interface Cable {
  from: Piece
  to: Piece
  meshes: { mesh: THREE.Mesh; orig: Float32Array; w: Float32Array; a: THREE.Vector3; b: THREE.Vector3 }[]
  /** explode amount the geometry was last bent for */
  applied: number
  /** shader uniforms: only the stretch lo..hi (0..1, from the device end) of the wire is drawn */
  reveal: { lo: { value: number }; hi: { value: number } }
  /** the wire's centre line (world, assembled), sampled evenly from the device end */
  spine?: THREE.Vector3[]
}

/** How far along its wire each vertex is (0 = device end, 1 = board end), walking over the tube's surface,
 *  so loops and wires that double back still count in order. */
function wireParam(meshes: THREE.Mesh[], start: THREE.Vector3): Float32Array[] | undefined {
  const ids = new Map<string, number>()
  const pts: THREE.Vector3[] = []
  const welds = meshes.map((mesh) => {
    const pos = mesh.geometry.getAttribute('position')
    const weld = new Int32Array(pos.count)
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
      const key = `${v.x.toFixed(5)},${v.y.toFixed(5)},${v.z.toFixed(5)}`
      let id = ids.get(key)
      if (id === undefined) {
        id = pts.length
        ids.set(key, id)
        pts.push(v)
      }
      weld[i] = id
    }
    return weld
  })
  const n = pts.length
  if (n < 3) return undefined
  const adj: number[][] = Array.from({ length: n }, () => [])
  meshes.forEach((mesh, mi) => {
    const index = mesh.geometry.index
    const count = index ? index.count : welds[mi].length
    const at = (k: number) => welds[mi][index ? index.getX(k) : k]
    for (let k = 0; k + 2 < count; k += 3) {
      const t = [at(k), at(k + 1), at(k + 2)]
      for (let e = 0; e < 3; e++) if (t[e] !== t[(e + 1) % 3]) adj[t[e]].push(t[(e + 1) % 3])
    }
  })
  // start from the rim at the device end
  const dist = new Float64Array(n).fill(Infinity)
  let dmin = Infinity
  for (const p of pts) dmin = Math.min(dmin, p.distanceTo(start))
  // Dijkstra with a binary heap of [distance, vertex]
  const heap: [number, number][] = []
  const push = (d: number, v: number) => {
    heap.push([d, v])
    let i = heap.length - 1
    while (i > 0) {
      const up = (i - 1) >> 1
      if (heap[up][0] <= heap[i][0]) break
      ;[heap[up], heap[i]] = [heap[i], heap[up]]
      i = up
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i], heap[m]]
        i = m
      }
    }
    return top
  }
  pts.forEach((p, i) => {
    if (p.distanceTo(start) <= dmin * 1.3 + 1e-5) {
      dist[i] = 0
      push(0, i)
    }
  })
  while (heap.length) {
    const [d, v] = pop()
    if (d > dist[v]) continue
    for (const u of adj[v]) {
      const nd = d + pts[v].distanceTo(pts[u])
      if (nd < dist[u]) {
        dist[u] = nd
        push(nd, u)
      }
    }
  }
  let max = 0
  for (const d of dist) if (d < Infinity) max = Math.max(max, d)
  if (!max) return undefined
  return welds.map((weld) => Float32Array.from(weld, (id) => (dist[id] < Infinity ? dist[id] / max : 1)))
}

const SPINE_N = 64
/** how far back along the wire (0..1) to look for its direction at an end */
const TIP_BACK = 0.04

/** A wire's centre line: the average of its tube's vertices in each slice of distance along it. */
function wireSpine(meshes: THREE.Mesh[], along: Float32Array[]) {
  const sum = Array.from({ length: SPINE_N + 1 }, () => new THREE.Vector3())
  const count = new Array(SPINE_N + 1).fill(0)
  const v = new THREE.Vector3()
  meshes.forEach((mesh, m) => {
    const pos = mesh.geometry.getAttribute('position')
    for (let i = 0; i < pos.count; i++) {
      const k = Math.round(along[m][i] * SPINE_N)
      sum[k].add(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld))
      count[k]++
    }
  })
  const filled = sum.map((s, k) => (count[k] ? s.divideScalar(count[k]) : null))
  const known = filled.flatMap((s, k) => (s ? [k] : []))
  if (known.length < 2) return undefined
  // fill empty slices from their neighbours
  return filled.map((s, k) => {
    if (s) return s
    const a = [...known].reverse().find((j) => j < k) ?? known[0]
    const b = known.find((j) => j > k) ?? known[known.length - 1]
    return a === b ? filled[a]!.clone() : filled[a]!.clone().lerp(filled[b]!, (k - a) / (b - a))
  })
}

function spineAt(spine: THREE.Vector3[], t: number, out = new THREE.Vector3()) {
  const x = THREE.MathUtils.clamp(t, 0, 1) * SPINE_N
  const i = Math.min(Math.floor(x), SPINE_N - 1)
  return out.copy(spine[i]).lerp(spine[i + 1], x - i)
}

/** Let a wire material draw only a stretch of its wire (uRevealLo <= aRev <= uReveal). */
function addReveal(mat: THREE.Material, reveal: Cable['reveal']) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uReveal = reveal.hi
    shader.uniforms.uRevealLo = reveal.lo
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aRev;\nvarying float vRev;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRev = aRev;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uReveal;\nuniform float uRevealLo;\nvarying float vRev;')
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (vRev > uReveal || vRev < uRevealLo) discard;')
  }
  mat.customProgramCacheKey = () => 'wire-reveal'
  mat.needsUpdate = true
}

/** Parts a wire can plug into. */
const ELECTRONICS = new Set(['arduino_uno', 'motor_shield', 'battery_pack', 'power_switch', 'ultrasonic_sensor', 'ir_sensors', 'bluetooth_module', 'motors'])

/**
 * Bend a cable for explode amount e: each vertex moves with a mix of its two end pieces' offsets,
 * so both connectors stay plugged in and the middle stretches between them.
 */
function bendCable(c: Cable, e: number) {
  if (Math.abs(c.applied - e) < 1e-4) return
  c.applied = e
  for (const m of c.meshes) {
    const attr = m.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    for (let i = 0, n = m.w.length; i < n; i++) {
      const w = m.w[i]
      arr[i * 3] = m.orig[i * 3] + (m.a.x + (m.b.x - m.a.x) * w) * e
      arr[i * 3 + 1] = m.orig[i * 3 + 1] + (m.a.y + (m.b.y - m.a.y) * w) * e
      arr[i * 3 + 2] = m.orig[i * 3 + 2] + (m.a.z + (m.b.z - m.a.z) * w) * e
    }
    attr.needsUpdate = true
    m.mesh.geometry.computeBoundingSphere()
    m.mesh.geometry.computeBoundingBox()
  }
}

/** scene directions a piece can come from (+x front, +y up, +z right) */
const SIDES: Record<Side, [number, number, number]> = {
  above: [0, 1, 0],
  below: [0, -1, 0],
  front: [1, 0, 0],
  back: [-1, 0, 0],
  left: [0, 0, -1],
  right: [0, 0, 1],
}

/**
 * A lock slides through the slot in a tab: along the thin direction of the panel that tab belongs to,
 * which is one of the lock's two long directions. It comes from the outside of the rover.
 */
function lockDirection(lock: Piece, panels: Piece[], center: THREE.Vector3, out: THREE.Vector3) {
  const size = lock.box.getSize(new THREE.Vector3()).toArray()
  const thin = size.indexOf(Math.min(...size))
  const votes = [0, 0, 0]
  const near = lock.box.clone().expandByScalar(0.015)
  for (const q of panels) {
    if (!near.intersectsBox(q.box)) continue
    const qs = q.box.getSize(new THREE.Vector3()).toArray()
    const qThin = qs.indexOf(Math.min(...qs))
    if (qThin !== thin) votes[qThin]++
  }
  let axis = votes.indexOf(Math.max(...votes))
  if (votes[axis] === 0) axis = [0, 1, 2].filter((i) => i !== thin).sort((a, b) => size[b] - size[a])[0]
  const v = [0, 0, 0]
  v[axis] = Math.sign(lock.centerWorld.getComponent(axis) - center.getComponent(axis)) || 1
  return out.fromArray(v)
}

/** Filled in once the model is prepared: the step panel reads the pieces from here (part pictures). */
export const assembly: { parts: PreparedPart[] } = { parts: [] }

export interface PreparedPart {
  id: string
  node: THREE.Object3D
  pieces: Piece[]
  centerWorld: THREE.Vector3
  offsetWorld: THREE.Vector3
}

const PART_RE = /^part:?(.+)$/
const FRAME_IDS = new Set(PARTS.filter((p) => p.category === 'frame' && p.id !== 'locks').map((p) => p.id))
/** pieces that fade in the wiring x-ray view */
const SHELL_IDS = new Set([...PARTS.filter((p) => p.category === 'frame').map((p) => p.id), 'wheels'])

/**
 * The two ends of a tube-shaped wire mesh, world space. A bevelled curve is an open tube: its ends
 * are the two rims, i.e. the loops of edges that belong to only one triangle. Falls back to the
 * farthest-point guess when the mesh has no clear rims.
 */
function wireEnds(obj: THREE.Object3D): [THREE.Vector3, THREE.Vector3] | undefined {
  return tubeRims(obj) ?? farthestEnds(obj)
}

function tubeRims(obj: THREE.Object3D): [THREE.Vector3, THREE.Vector3] | undefined {
  const centres: { c: THREE.Vector3; n: number }[] = []
  obj.traverse((child) => {
    const mesh = child as THREE.Mesh
    if (!mesh.isMesh) return
    const pos = mesh.geometry.getAttribute('position')
    // weld vertices that share a position (normals / UVs split them)
    const ids = new Map<string, number>()
    const weld = new Int32Array(pos.count)
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < pos.count; i++) {
      const key = `${pos.getX(i)},${pos.getY(i)},${pos.getZ(i)}`
      let id = ids.get(key)
      if (id === undefined) {
        id = pts.length
        ids.set(key, id)
        pts.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mesh.matrixWorld))
      }
      weld[i] = id
    }
    const index = mesh.geometry.index
    const tri = (k: number) => weld[index ? index.getX(k) : k]
    const count = index ? index.count : pos.count
    const edges = new Map<number, number>()
    const n = pts.length
    for (let k = 0; k + 2 < count; k += 3) {
      const t = [tri(k), tri(k + 1), tri(k + 2)]
      for (let e = 0; e < 3; e++) {
        const a = t[e]
        const b = t[(e + 1) % 3]
        if (a === b) continue
        const key = Math.min(a, b) * n + Math.max(a, b)
        edges.set(key, (edges.get(key) ?? 0) + 1)
      }
    }
    // group rim vertices into loops (union-find)
    const parent = new Int32Array(n).map((_, i) => i)
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
    const onRim = new Set<number>()
    for (const [key, c] of edges) {
      if (c !== 1) continue
      const a = Math.floor(key / n)
      const b = key % n
      onRim.add(a)
      onRim.add(b)
      parent[find(a)] = find(b)
    }
    const loops = new Map<number, THREE.Vector3[]>()
    for (const v of onRim) {
      const r = find(v)
      if (!loops.has(r)) loops.set(r, [])
      loops.get(r)!.push(pts[v])
    }
    for (const loop of loops.values()) {
      if (loop.length < 3) continue
      centres.push({ c: loop.reduce((s, p) => s.add(p), new THREE.Vector3()).divideScalar(loop.length), n: loop.length })
    }
  })
  if (centres.length < 2) return undefined
  // the two rims farthest apart (stray holes from compression are ignored)
  let best: [THREE.Vector3, THREE.Vector3] | undefined
  let bestD = -1
  for (let i = 0; i < centres.length; i++)
    for (let j = i + 1; j < centres.length; j++) {
      const d = centres[i].c.distanceToSquared(centres[j].c)
      if (d > bestD) {
        bestD = d
        best = [centres[i].c, centres[j].c]
      }
    }
  return best
}

function farthestEnds(obj: THREE.Object3D): [THREE.Vector3, THREE.Vector3] | undefined {
  const pts: THREE.Vector3[] = []
  obj.traverse((c) => {
    const mesh = c as THREE.Mesh
    const pos = mesh.isMesh ? mesh.geometry.getAttribute('position') : null
    if (!pos) return
    const stride = Math.max(1, Math.floor(pos.count / 1500))
    for (let i = 0; i < pos.count; i += stride) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld))
  })
  if (pts.length < 2) return undefined
  const centroid = pts.reduce((a, b) => a.add(b), new THREE.Vector3()).divideScalar(pts.length)
  const far = (from: THREE.Vector3) => pts.reduce((best, q) => (q.distanceToSquared(from) > best.distanceToSquared(from) ? q : best))
  const a = far(centroid)
  return [a.clone(), far(a).clone()]
}

// prepare() re-parents and mutates the cached glTF scene, so it must run once per scene
// (StrictMode calls useMemo twice in dev).
const prepared = new WeakMap<THREE.Group, ReturnType<typeof prepareOnce>>()
function prepare(gltfScene: THREE.Group) {
  let r = prepared.get(gltfScene)
  if (!r) {
    r = prepareOnce(gltfScene)
    prepared.set(gltfScene, r)
  }
  return r
}

function cloneMaterials(obj: THREE.Object3D): MatState[] {
  const cache = new Map<THREE.Material, THREE.MeshStandardMaterial>()
  const mats: MatState[] = []
  obj.traverse((c) => {
    const mesh = c as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    const swap = (mat: THREE.Material) => {
      let clone = cache.get(mat)
      if (!clone) {
        clone = (mat as THREE.MeshStandardMaterial).clone()
        cache.set(mat, clone)
        mats.push({
          mat: clone,
          opacity: clone.opacity,
          transparent: clone.transparent,
          depthWrite: clone.depthWrite,
          emissive: clone.emissive ? clone.emissive.clone() : new THREE.Color(0, 0, 0),
          emissiveIntensity: clone.emissiveIntensity ?? 1,
        })
      }
      return clone
    }
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material)
  })
  return mats
}

function prepareOnce(gltfScene: THREE.Group) {
  const root = new THREE.Group()
  const model = gltfScene
  root.add(model)
  model.position.set(0, 0, 0)
  model.updateMatrixWorld(true)

  const rawBox = new THREE.Box3().setFromObject(model)
  const rawSize = rawBox.getSize(new THREE.Vector3())
  const rawCenter = rawBox.getCenter(new THREE.Vector3())
  const s = TARGET_SIZE / Math.max(rawSize.x, rawSize.y, rawSize.z)
  model.position.set(-rawCenter.x, -rawBox.min.y, -rawCenter.z)
  root.scale.setScalar(s)
  root.updateMatrixWorld(true)

  const roverCenter = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3())
  const parts: PreparedPart[] = []

  model.traverse((o) => {
    const raw: string = o.userData?.name ?? o.name
    const m = PART_RE.exec(raw)
    if (!m || !PART_BY_ID[m[1]]) return
    const id = m[1]
    o.userData.partId = id
    const pieces: Piece[] = o.children.map((child) => {
      const box = new THREE.Box3().setFromObject(child)
      return {
        name: child.userData?.name ?? child.name,
        partId: id,
        obj: child,
        mats: cloneMaterials(child),
        base: child.position.clone(),
        box,
        centerWorld: box.getCenter(new THREE.Vector3()),
        offsetWorld: new THREE.Vector3(),
        offsetLocal: new THREE.Vector3(),
        step: -1,
        stages: [],
        subs: [],
        order: 0,
        approachLocal: new THREE.Vector3(),
        approachDir: new THREE.Vector3(0, 1, 0),
        approachDist: 0.4,
        pickable: true,
      }
    })
    const centerWorld = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3())
    parts.push({ id, node: o, pieces, centerWorld, offsetWorld: new THREE.Vector3() })
  })

  // --- exploded view offsets (world units) ---
  for (const part of parts) {
    const cfg = PART_BY_ID[part.id].explode
    const dir = part.centerWorld.clone().sub(roverCenter).setY(0)
    if (dir.lengthSq() > 1e-6) dir.normalize()
    part.offsetWorld.copy(dir).multiplyScalar(cfg.out ?? 0).add(new THREE.Vector3(0, cfg.lift ?? 0, 0))
    for (const p of part.pieces) {
      const spread = p.centerWorld.clone().sub(part.centerWorld).multiplyScalar(cfg.spread ?? 0)
      p.offsetWorld.copy(part.offsetWorld).add(spread)
    }
  }
  const framePieces = parts.filter((p) => FRAME_IDS.has(p.id)).flatMap((p) => p.pieces)
  for (const part of parts) {
    if (!PART_BY_ID[part.id].explode.followFrame) continue
    for (const p of part.pieces) {
      let best = framePieces[0]
      let bestD = Infinity
      for (const f of framePieces) {
        const d = f.centerWorld.distanceToSquared(p.centerWorld)
        if (d < bestD) {
          bestD = d
          best = f
        }
      }
      p.offsetWorld.copy(best.offsetWorld).add(p.centerWorld.clone().sub(best.centerWorld).multiplyScalar(0.25))
    }
  }

  // --- wiring: find each wire's two ends; the one nearer the shield is the board end ---
  const shield = parts.find((p) => p.id === 'motor_shield')
  const shieldBox = shield ? new THREE.Box3().setFromObject(shield.node) : null
  const all0 = parts.flatMap((p) => p.pieces)
  const elecPieces = parts.filter((p) => ELECTRONICS.has(p.id)).flatMap((p) => p.pieces)
  const piecesOf = (ids: string[]) => parts.filter((p) => ids.includes(p.id)).flatMap((p) => p.pieces)
  /** the wiring guide says what each wire connects: wire piece name -> its anchor / group */
  const wireInfo = new Map(WIRE_GROUPS.flatMap((g) => g.wires.filter((w) => w.piece).map((w) => [w.piece!, { w, g }] as const)))
  const plugAt = (pt: THREE.Vector3, among = elecPieces) => {
    let best = among[0]
    let bestD = Infinity
    for (const q of among) {
      const d = q.box.distanceToPoint(pt)
      if (d < bestD) {
        bestD = d
        best = q
      }
    }
    return best
  }
  const wiringPieces = parts.find((x) => x.id === 'wiring')?.pieces ?? []
  for (const p of wiringPieces) {
    if (p.name.startsWith('pins')) continue // connector housings, below
    const info = wireInfo.get(p.name)
    // the board end is the shield, unless the guide names another piece (battery -> switch)
    const boardPiece = info?.w.boardPiece ? all0.find((q) => q.name === info.w.boardPiece) : undefined
    const boardBox = boardPiece?.box ?? shieldBox
    const ends = wireEnds(p.obj)
    if (ends && boardBox && boardBox.distanceToPoint(ends[0]) < boardBox.distanceToPoint(ends[1])) ends.reverse()
    p.ends = ends
    if (!ends) continue
    // Device end: the wire's anchor, else the nearest piece of the device(s) its group connects.
    // Board end: the shield. Wires the guide doesn't know just plug into the nearest module.
    const devices = info ? piecesOf(info.g.parts.filter((id) => id !== 'motor_shield')) : []
    const anchor = info?.w.anchor ? all0.find((q) => q.name === info.w.anchor) : undefined
    const from = anchor ?? (devices.length ? plugAt(ends[0], devices) : plugAt(ends[0]))
    const to = boardPiece ?? (info && shield ? shield.pieces[0] : plugAt(ends[1]))
    const meshes: Cable['meshes'] = []
    const v = new THREE.Vector3()
    const tubes: THREE.Mesh[] = []
    p.obj.traverse((c) => {
      const mesh = c as THREE.Mesh
      if (!mesh.isMesh) return
      tubes.push(mesh)
      mesh.geometry = mesh.geometry.clone() // bent per wire, never shared
      // the GLB stores positions as quantized integers; bending needs plain floats
      const q = mesh.geometry.getAttribute('position')
      const n = q.count
      const floats = new Float32Array(n * 3)
      for (let i = 0; i < n; i++) {
        floats[i * 3] = q.getX(i)
        floats[i * 3 + 1] = q.getY(i)
        floats[i * 3 + 2] = q.getZ(i)
      }
      const attr = new THREE.BufferAttribute(floats, 3)
      mesh.geometry.setAttribute('position', attr)
      const w = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(attr, i).applyMatrix4(mesh.matrixWorld)
        const s = v.distanceTo(ends[0]) / (v.distanceTo(ends[0]) + v.distanceTo(ends[1]) || 1)
        w[i] = THREE.MathUtils.smoothstep(s, 0.12, 0.88) // a short stretch at each end stays rigid with its plug
      }
      // world offsets -> this mesh's local space (linear part of the inverse world matrix)
      const toLocal = new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld.clone().invert())
      meshes.push({
        mesh,
        orig: floats.slice(),
        w,
        a: from.offsetWorld.clone().applyMatrix3(toLocal),
        b: to.offsetWorld.clone().applyMatrix3(toLocal),
      })
    })
    const reveal = { lo: { value: 0 }, hi: { value: 1 } }
    // distance along the wire: drives the assembly reveal, and (better than straight-line distance
    // for loopy wires) how much each vertex follows each end when exploded
    const along = wireParam(tubes, ends[0])
    tubes.forEach((mesh, i) => {
      const s = along?.[i]
      if (s) {
        mesh.geometry.setAttribute('aRev', new THREE.BufferAttribute(s, 1))
        meshes[i].w = s.map((x) => THREE.MathUtils.smoothstep(x, 0.12, 0.88))
      } else mesh.geometry.setAttribute('aRev', new THREE.BufferAttribute(new Float32Array(meshes[i].w.length), 1))
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) addReveal(m, reveal)
    })
    p.cable = { from, to, meshes, applied: 0, reveal, spine: along && wireSpine(tubes, along) }
  }
  // Connector housings (pins.*) ride with the plug of the nearest wire end.
  const plugs = wiringPieces.flatMap((p) =>
    p.cable && p.ends
      ? [
          { at: p.ends[0], wire: p, end: 0 as const, plug: p.cable.from },
          { at: p.ends[1], wire: p, end: 1 as const, plug: p.cable.to },
        ]
      : [],
  )
  for (const p of wiringPieces) {
    if (!p.name.startsWith('pins') || !plugs.length) continue
    const best = plugs.reduce((a, b) => (b.at.distanceToSquared(p.centerWorld) < a.at.distanceToSquared(p.centerWorld) ? b : a))
    p.offsetWorld.copy(best.plug.offsetWorld)
    p.plugOf = { wire: best.wire, end: best.end }
    const spine = best.wire.cable?.spine
    if (spine) {
      const t = best.end
      const at = spineAt(spine, t)
      p.tip = {
        origin: p.obj.getWorldPosition(new THREE.Vector3()),
        at,
        dir: at.clone().sub(spineAt(spine, t ? 1 - TIP_BACK : TIP_BACK)).normalize(),
        quat: p.obj.quaternion.clone(),
      }
    }
  }

  // --- assembly: which step adds each piece ---
  const all = parts.flatMap((p) => p.pieces)
  const byName = new Map(all.map((p) => [p.name, p]))
  STEPS.forEach((step, i) =>
    step.pieces?.forEach((n) => {
      const p = byName.get(n)
      if (!p) console.warn(`[steps] "${step.id}" lists unknown piece "${n}"`)
      else if (p.step >= 0) console.warn(`[steps] piece "${n}" is in more than one step`)
      else p.step = i
    }),
  )
  STEPS.forEach((step, i) =>
    step.parts?.forEach((id) => {
      const part = parts.find((p) => p.id === id)
      if (!part) console.warn(`[steps] "${step.id}" lists unknown part "${id}"`)
      part?.pieces.forEach((p) => {
        if (p.step < 0) p.step = i
      })
    }),
  )
  // Wires: laid all the way, or only a stretch (`from` / `upTo` an opening, or the stretch under the deck)
  // that later steps extend; each stage keeps what earlier ones laid.
  STEPS.forEach((step, i) =>
    step.wires?.forEach((g) =>
      g.pieces.forEach((n) => {
        const p = byName.get(n)
        if (!p) return console.warn(`[steps] "${step.id}" lists unknown wire "${n}"`)
        if (!g.from && !g.upTo) {
          if (p.step >= 0) console.warn(`[steps] wire "${n}" is finished in more than one step`)
          else p.step = i
          return
        }
        const route = WIRE_ROUTES[n]
        if (!route) return console.warn(`[steps] wire "${n}" has no route in wireRoutes.ts`)
        const span = (where: string): [number, number] | undefined => {
          if (where === UNDER_DECK) {
            if (!route.under) console.warn(`[steps] wire "${n}" does not run under the deck`)
            return route.under
          }
          const hole = route.through.find((t) => t.opening === where)
          if (!hole) console.warn(`[steps] wire "${n}" does not pass through "${where}"`)
          return hole && [hole.at, hole.at]
        }
        // run a little past an opening, so the loose end pokes out of it; under the deck, stop where it rises
        const lo = g.from ? Math.max(0, ((span(g.from)?.[0] ?? 0) - 14) / route.length) : 0
        const past = g.upTo === UNDER_DECK ? 0 : 18
        const hi = g.upTo ? Math.min(1, ((span(g.upTo)?.[1] ?? route.length) + past) / route.length) : 1
        const prev = p.stages[p.stages.length - 1]
        p.stages.push(prev ? { step: i, lo: Math.min(lo, prev.lo), hi: Math.max(hi, prev.hi) } : { step: i, lo, hi })
      }),
    ),
  )
  for (const p of all) {
    if (p.stages.length && p.step < 0) console.warn(`[steps] wire "${p.name}" is started but never finished`)
    if (p.step >= 0 && p.stages.some((x) => x.step >= p.step)) console.warn(`[steps] wire "${p.name}" is finished before it is started`)
    // a housing comes with its end of the wire
    if (p.plugOf && p.step < 0) {
      const w = p.plugOf.wire
      // the pin is on its wire from the start; on a half-laid wire it rides on the loose end
      p.step = w.stages[0]?.step ?? w.step
    }
  }
  // Pieces that first appear in a sub-assembly step ride with it until it is put in place.
  STEPS.forEach((s) =>
    s.sub?.forEach((g) => {
      if (!SUBASSEMBLIES[g]) console.warn(`[steps] "${s.id}" builds unknown sub-assembly "${g}"`)
      else if (!(g in PLACE)) console.warn(`[steps] sub-assembly "${g}" is never put in place`)
    }),
  )
  for (const p of all) {
    const first = p.stages[0]?.step ?? p.step
    p.subs = (STEPS[first]?.sub ?? [])
      .filter((g) => SUBASSEMBLIES[g])
      .map((g) => ({ group: g, world: new THREE.Vector3(...SUBASSEMBLIES[g]), local: new THREE.Vector3() }))
  }
  const missing = all.filter((p) => p.step < 0)
  if (missing.length) console.warn('[steps] pieces not in any step:', missing.map((p) => p.name))

  // Order pieces inside a step from the bottom up, and give each a fly-in direction.
  const up = new THREE.Vector3(0, 1, 0)
  STEPS.forEach((_, i) => {
    const inStep = all.filter((p) => p.step === i).sort((a, b) => a.box.min.y - b.box.min.y || a.centerWorld.x - b.centerWorld.x)
    inStep.forEach((p, k) => (p.order = k))
  })

  // How each piece goes in: a step can say (`from`, `approach`); locks slide through the tab they lock;
  // wheels push on along the axle; everything else drops in from above.
  const panels = all.filter((p) => FRAME_IDS.has(p.partId))
  for (const p of all) {
    const def = STEPS[p.stages[0]?.step ?? p.step]
    const named = def?.approach?.[p.name] ?? (p.partId === 'locks' || p.partId === 'wheels' ? undefined : def?.from)
    if (named) p.approachDir.fromArray(SIDES[named])
    else if (p.partId === 'locks') {
      lockDirection(p, panels, roverCenter, p.approachDir)
      p.approachDist = 0.22
    } else if (p.partId === 'wheels') p.approachDir.set(0, 0, Math.sign(p.centerWorld.z - roverCenter.z) || 1)
    else p.approachDir.copy(up)
  }

  // world -> parent-local (parents only carry the uniform root scale, no rotation)
  for (const p of all) {
    const parentScale = p.obj.parent!.getWorldScale(new THREE.Vector3()).x
    p.offsetLocal.copy(p.offsetWorld).divideScalar(parentScale)
    p.approachLocal.copy(p.approachDir).multiplyScalar(p.approachDist / parentScale)
    for (const sub of p.subs) sub.local.copy(sub.world).divideScalar(parentScale)
  }

  for (const g of WIRE_GROUPS) {
    for (const w of g.wires) {
      if (w.piece && !byName.has(w.piece)) console.warn(`[wiring] unknown wire piece "${w.piece}"`)
      if (w.anchor && !byName.has(w.anchor)) console.warn(`[wiring] unknown anchor piece "${w.anchor}"`)
    }
    for (const n of g.pieces ?? []) if (!byName.has(n)) console.warn(`[wiring] unknown piece "${n}"`)
  }

  // --- wheels: record each axle while the rover is still at the origin, facing +x ---
  for (const p of parts.find((x) => x.id === 'wheels')?.pieces ?? []) {
    const toParent = p.obj.parent!.matrixWorld.clone().invert()
    p.wheel = {
      pivot: p.centerWorld.clone().applyMatrix4(toParent),
      axis: new THREE.Vector3(0, 0, 1).transformDirection(toParent),
      rest: p.obj.quaternion.clone(),
      left: p.centerWorld.z < 0,
    }
  }

  const pieces = Object.fromEntries(parts.map((p) => [p.id, p.pieces.length]))
  return { root, parts, info: { pieces, sizeMm: [rawSize.x, rawSize.z, rawSize.y] as [number, number, number] } }
}

const HOVER = new THREE.Color('#ff7a3d')
const SELECT = new THREE.Color('#ff4a2e')
const NEW = new THREE.Color('#ffb03a')
const GLOW = new THREE.Color('#ffd27a')
const spinQ = new THREE.Quaternion()
const tipQ = new THREE.Quaternion()
const tipAt = new THREE.Vector3()
const tipDir = new THREE.Vector3()
const tmpV = new THREE.Vector3()
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3)
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)
/** seconds a wire takes to draw itself along its route */
const GROW = 2.4
/** seconds a sub-assembly takes to move into place */
const MOVE = 1.8
/** the step that puts each sub-assembly in place */
const PLACE: Record<string, number> = Object.fromEntries(STEPS.flatMap((s, i) => (s.place ? [[s.place, i]] : [])))
/** a step that puts a sub-assembly in place moves it first; what it adds comes after */
const stepDelay = (step: number) => (STEPS[step]?.place ? MOVE + 0.4 : 0)

/** Assembly: how far a sub-assembly still is from its place (1 = aside, 0 = in place) at a step. */
function subAmount(group: string, step: number, elapsed: number) {
  const at = PLACE[group] ?? -1
  if (at < 0 || step > at) return 0
  if (step < at) return 1
  return 1 - easeInOut(THREE.MathUtils.clamp((elapsed - 0.3) / MOVE, 0, 1))
}

/** Assembly: where a piece is drawn relative to its place at a step (world units), e.g. for camera framing. */
export function offsetAt(p: Piece, step: number, elapsed = Infinity, out = new THREE.Vector3()) {
  out.set(0, 0, 0)
  for (const sub of p.subs) out.addScaledVector(sub.world, subAmount(sub.group, step, elapsed))
  return out
}

/** Assembly: which stretch of a wire is drawn at a step (0..1 from the device end), or null before it is laid.
 *  In a step that lays more of it, the new part grows out of what was already there. */
function wireState(p: Piece, step: number, elapsed: number): { lo: number; hi: number; fresh: boolean } | null {
  const stages = p.step >= 0 ? [...p.stages, { step: p.step, lo: 0, hi: 1 }] : p.stages
  let k = -1
  while (k + 1 < stages.length && stages[k + 1].step <= step) k++
  if (k < 0) return null
  const cur = stages[k]
  if (cur.step !== step) return { lo: cur.lo, hi: cur.hi, fresh: false }
  const prev = stages[k - 1] ?? { lo: cur.lo, hi: cur.lo }
  const g = easeInOut(THREE.MathUtils.clamp((elapsed - 0.25) / GROW, 0, 1))
  return { lo: prev.lo + (cur.lo - prev.lo) * g, hi: prev.hi + (cur.hi - prev.hi) * g, fresh: true }
}

function applyLook(p: Piece, fade: number, tint: THREE.Color | null, intensity: number) {
  for (const m of p.mats) {
    const wantTransparent = m.transparent || fade < 0.999
    if (m.mat.transparent !== wantTransparent) {
      m.mat.transparent = wantTransparent
      m.mat.needsUpdate = true
    }
    m.mat.opacity = m.opacity * fade
    m.mat.depthWrite = fade < 0.999 ? false : m.depthWrite
    if (!m.mat.emissive) continue
    if (tint && intensity > 0) {
      m.mat.emissive.copy(tint)
      m.mat.emissiveIntensity = intensity
    } else {
      m.mat.emissive.copy(m.emissive)
      m.mat.emissiveIntensity = m.emissiveIntensity
    }
  }
}

/** World-space position of a part's label anchor; updated every frame. */
const ARROW_RED = '#e0261b'
const arrowMat = new THREE.MeshBasicMaterial({ color: ARROW_RED, transparent: true, depthWrite: false })
const shaftGeo = new THREE.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0)
const headGeo = new THREE.ConeGeometry(1, 1, 16).translate(0, -0.5, 0)

/** A red arrow from `from` to `to` (world), head at `to`, like the arrows in the printed manual. */
function Arrow({ from, to, width = 1 }: { from: THREE.Vector3; to: THREE.Vector3; width?: number }) {
  const dir = to.clone().sub(from)
  const len = dir.length()
  const head = Math.min(0.06 * width, len * 0.4)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
  return (
    <group position={from} quaternion={q} renderOrder={10}>
      <mesh geometry={shaftGeo} material={arrowMat} scale={[0.006 * width, len - head, 0.006 * width]} />
      <mesh geometry={headGeo} material={arrowMat} position={[0, len, 0]} scale={[0.02 * width, head, 0.02 * width]} />
    </group>
  )
}

/**
 * Assembly: an arrow for every piece the step adds, showing the way it goes in, and one for a
 * sub-assembly moving into place.
 */
function StepArrows({ parts }: { parts: PreparedPart[] }) {
  const step = useStore((s) => s.step)
  const groupRef = useRef<THREE.Group>(null)
  const arrows = useMemo(() => {
    const def = STEPS[step]
    if (def.layout || def.cover) return []
    const out: { from: THREE.Vector3; to: THREE.Vector3; width: number }[] = []
    const pieces = parts.flatMap((p) => p.pieces)
    const half = new THREE.Vector3()
    for (const p of pieces) {
      if (p.step !== step || p.cable || p.plugOf) continue
      const c = p.centerWorld.clone().add(offsetAt(p, step))
      p.box.getSize(half).multiplyScalar(0.5)
      const d = p.approachDir
      const reach = Math.abs(d.x) * half.x + Math.abs(d.y) * half.y + Math.abs(d.z) * half.z
      const to = c.clone().addScaledVector(d, reach + 0.01)
      out.push({ from: to.clone().addScaledVector(d, p.approachDist * 0.8), to, width: p.partId === 'locks' ? 0.7 : 1 })
    }
    if (def.place) {
      // the sub-assembly: from where it was built to where it goes
      const moving = pieces.filter((p) => p.step < step && p.subs.some((x) => x.group === def.place))
      if (moving.length) {
        const a = new THREE.Box3()
        const b = new THREE.Box3()
        for (const p of moving) {
          a.union(p.box.clone().translate(offsetAt(p, step, 0)))
          b.union(p.box.clone().translate(offsetAt(p, step)))
        }
        const from = a.getCenter(new THREE.Vector3())
        const to = b.getCenter(new THREE.Vector3())
        const shift = to.clone().sub(from)
        // beside the parts, not through them
        const side = new THREE.Vector3().crossVectors(shift, new THREE.Vector3(0, 1, 0))
        if (side.lengthSq() < 1e-6) side.set(0, 0, 1)
        side.normalize().multiplyScalar(a.getSize(new THREE.Vector3()).length() * 0.45)
        out.push({ from: from.add(side), to: to.add(side).addScaledVector(shift.normalize(), -0.05), width: 1.6 })
      }
    }
    return out
  }, [parts, step])

  // fade in after the step starts, so the eye follows the moving parts first
  useFrame(() => {
    const st = useStore.getState()
    const t = (performance.now() - st.stepStamp) / 1000
    arrowMat.opacity = THREE.MathUtils.clamp((t - 0.6) / 0.5, 0, 1) * 0.95
    if (groupRef.current) groupRef.current.visible = arrowMat.opacity > 0.01
  })

  return (
    <group ref={groupRef}>
      {arrows.map((a, i) => (
        <Arrow key={i} {...a} />
      ))}
    </group>
  )
}

export function RoverModel({ onReady }: { onReady: (parts: PreparedPart[]) => void }) {
  const { scene } = useGLTF(MODEL_URL)
  const { root, parts, info } = useMemo(() => prepare(scene), [scene])
  const byId = useMemo(() => Object.fromEntries(parts.map((p) => [p.id, p])), [parts])
  const setModel = useStore((s) => s.setModel)
  const t = useRef(0)
  const labelRef = useRef<THREE.Group>(null)
  const mode = useStore((s) => s.mode)
  const labelPart = useStore((s) => (s.mode === 'wire' ? null : (s.hovered ?? (s.mode === 'explore' ? s.selected : null))))
  const activeWire = useStore((s) => (s.mode === 'wire' ? (s.wire ?? s.wirePinned) : null))
  /** Blender name of a wire piece -> wire id */
  const wireOfPiece = useMemo(
    () => new Map(WIRE_GROUPS.flatMap((g) => g.wires.filter((w) => w.piece).map((w) => [w.piece!, w.id] as const))),
    [],
  )
  const pieceByName = useMemo(() => new Map(parts.flatMap((p) => p.pieces).map((p) => [p.name, p])), [parts])

  useEffect(() => {
    assembly.parts = parts
    setModel(info)
    onReady(parts)
    if (import.meta.env.DEV) {
      // dev: which pieces each wire is plugged into
      Object.assign(window, {
        __cables: () =>
          parts
            .flatMap((p) => p.pieces)
            .filter((p) => p.cable)
            .map((p) => {
              // nearest three pieces to each end, distance in mm (1 unit = 100 mm)
              const near = (pt: THREE.Vector3) =>
                parts
                  .filter((x) => ELECTRONICS.has(x.id))
                  .flatMap((x) => x.pieces)
                  .map((q) => [q.name, Math.round(q.box.distanceToPoint(pt) * 100)] as const)
                  .sort((a, b) => a[1] - b[1])
                  .slice(0, 3)
                  .map(([n, d]) => `${n} ${d}mm`)
                  .join(', ')
              const mm = (v: THREE.Vector3) => `(${Math.round(v.x * 100)},${Math.round(v.y * 100)},${Math.round(v.z * 100)})`
              return `${p.name}: ${p.cable!.from.name} -> ${p.cable!.to.name} | A${mm(p.ends![0])} [${near(p.ends![0])}]  B${mm(p.ends![1])} [${near(p.ends![1])}]`
            }),
      })
    }
  }, [info, parts, setModel, onReady])

  useFrame((_, delta) => {
    const st = useStore.getState()
    const stepDef = STEPS[st.step]
    const explodeTarget = st.mode === 'explore' ? st.explode : st.mode === 'assemble' && stepDef.layout === 'exploded' ? 1 : 0
    const group = WIRE_GROUPS[st.wireGroup]
    const active = st.wire ?? st.wirePinned
    const pulse = (Math.sin(performance.now() / 260) + 1) / 2
    // Drive and Missions tabs: the whole rover follows the simulator
    if (st.mode === 'drive' || st.mode === 'missions') {
      root.position.set(sim.x, 0, sim.z)
      root.rotation.y = sim.heading
    } else if (root.position.lengthSq() > 0 || root.rotation.y !== 0) {
      root.position.set(0, 0, 0)
      root.rotation.y = 0
    }
    t.current = THREE.MathUtils.damp(t.current, explodeTarget, 6, delta)
    const e = t.current
    const now = performance.now()
    const elapsed = (now - st.stepStamp) / 1000
    const assembling = st.mode === 'assemble' && !stepDef.layout
    // in a step that puts a sub-assembly in place, wires and new pieces wait until it is there
    const later = elapsed - stepDelay(st.step)
    const coverEnd = stepDef.cover ? chapterOf(st.step).end : -1
    const alone = assembling && stepDef.flip && stepDef.sub?.length ? stepDef.sub[0] : null

    for (const part of parts) {
      const cfg = PART_BY_ID[part.id].explode
      const wireFade = cfg.fade ? Math.max(0, 1 - e * 1.6) : 1
      const isSel = part.id === st.selected
      const isHov = part.id === st.hovered
      let anyVisible = false

      for (const p of part.pieces) {
        p.obj.position.copy(p.base).addScaledVector(p.offsetLocal, e)
        if (p.tip) p.obj.quaternion.copy(p.tip.quat)
        if (assembling) for (const sub of p.subs) p.obj.position.addScaledVector(sub.local, subAmount(sub.group, st.step, elapsed))
        if (p.cable) {
          bendCable(p.cable, e)
          p.cable.reveal.lo.value = 0
          p.cable.reveal.hi.value = 1
        }
        let fade = wireFade
        let tint: THREE.Color | null = null
        let intensity = 0

        if (st.mode === 'explore') {
          if (st.isolate && st.selected !== null && !isSel) fade = Math.min(fade, 0.07)
          if (isSel) {
            tint = SELECT
            intensity = (Math.sin(now / 300) + 1) * 0.03
          } else if (isHov) {
            tint = HOVER
            intensity = 0.14
          }
          p.pickable = fade > 0.5
        } else if (st.mode === 'drive' || st.mode === 'missions') {
          fade = 1
          p.pickable = false
        } else if (st.mode === 'code') {
          const prog = PROGRAMS[st.program]
          if (prog.parts.includes(part.id)) fade = 1
          else if (part.id === 'wiring') fade = 0.5
          else if (SHELL_IDS.has(part.id) || part.id === 'locks') fade = 0.12
          else fade = 0.3
          if (st.codePart === part.id) {
            tint = GLOW
            intensity = 0.35 + pulse * 0.4
          }
          p.pickable = false
        } else if (st.mode === 'wire') {
          const wireId = wireOfPiece.get(p.name)
          if (wireId) {
            const inGroup = WIRE_BY_ID[wireId].group === st.wireGroup
            if (active) fade = wireId === active ? 1 : inGroup ? 0.35 : 0.06
            else fade = inGroup ? 1 : 0.1
            if (wireId === active) {
              tint = GLOW
              intensity = 0.45 + pulse * 0.45
            } else if (inGroup && !active) {
              tint = GLOW
              intensity = 0.1 + pulse * 0.2
            }
            p.pickable = true
          } else {
            if (part.id === 'wiring') {
              const hit = group.pieces?.includes(p.name)
              fade = hit || !st.xray ? 1 : 0.25
              if (hit) {
                tint = GLOW
                intensity = 0.15 + pulse * 0.2
              }
            } else if (group.parts.includes(part.id)) {
              fade = 1
              if (active && WIRE_BY_ID[active].wire.anchor === p.name) {
                tint = GLOW
                intensity = 0.2 + pulse * 0.25
              }
            }
            else if (SHELL_IDS.has(part.id) || part.id === 'locks') fade = st.xray ? 0.06 : 1
            else fade = st.xray ? 0.25 : 1
            p.pickable = false
          }
        } else if (stepDef.layout) {
          if (isHov) {
            tint = HOVER
            intensity = 0.14
          }
          p.pickable = fade > 0.5
        } else if (p.cable || p.plugOf) {
          // wires draw themselves along their route; housings come with their end of the wire
          const wire = p.cable ? p : p.plugOf!.wire
          const ws = wireState(wire, st.step, later)
          const shown = p.cable ? ws !== null : st.step >= p.step
          if (!ws || !shown) {
            fade = st.ghost ? 0.035 : 0
            p.pickable = false
          } else {
            let k = 1
            if (p.cable) {
              p.cable.reveal.lo.value = ws.lo
              p.cable.reveal.hi.value = ws.hi
              fade = ws.hi - ws.lo > 0.002 ? 1 : 0
            } else {
              if (st.step === p.step) fade = k = THREE.MathUtils.clamp((later - 0.15) / 0.4, 0, 1)
              // a pin on the loose end of a half-laid wire rides along with that end
              const end = p.plugOf!.end
              const t = end ? ws.hi : ws.lo
              const spine = wire.cable?.spine
              if (p.tip && spine && (end ? t < 0.999 : t > 0.001)) {
                const at = spineAt(spine, t, tipAt)
                tipDir.copy(at).sub(spineAt(spine, end ? t - TIP_BACK : t + TIP_BACK, tmpV)).normalize()
                tipQ.setFromUnitVectors(p.tip.dir, tipDir)
                // rotate the housing about its wire end, then move that end to the loose end
                p.obj.parent!.worldToLocal(tmpV.copy(p.tip.origin).sub(p.tip.at).applyQuaternion(tipQ).add(at))
                p.obj.position.add(tmpV.sub(p.base))
                p.obj.quaternion.premultiply(tipQ)
              }
            }
            const fresh = p.cable ? ws.fresh : st.step === p.step
            const glow = fresh ? Math.max(0, 1 - Math.max(0, later - GROW - 0.4) / 1.8) : 0
            tint = isHov ? HOVER : glow > 0 ? NEW : null
            intensity = isHov ? 0.14 : 0.22 * k * glow
            p.pickable = fade > 0.5
          }
        } else if (p.step < st.step) {
          if (stepDef.seeThrough?.includes(p.name)) fade = 0.28
          if (isHov) {
            tint = HOVER
            intensity = 0.14
          }
          p.pickable = fade > 0.5
        } else if (p.step === st.step) {
          const local = THREE.MathUtils.clamp((later - 0.2 - Math.min(p.order, 12) * 0.09) / 0.8, 0, 1)
          const k = easeOut(local)
          p.obj.position.addScaledVector(p.approachLocal, 1 - k)
          fade = Math.min(fade, k)
          // freshly added pieces glow briefly, then settle
          const glow = Math.max(0, 1 - Math.max(0, later - 1.6) / 1.8)
          tint = isHov ? HOVER : NEW
          intensity = isHov ? 0.14 : 0.16 * k * glow
          p.pickable = k > 0.5
        } else {
          // a chapter's cover: what the chapter builds shows faintly, in place
          fade = stepDef.cover && p.step <= coverEnd ? 0.16 : st.ghost ? 0.035 : 0
          p.pickable = false
        }

        // Drive tab: turn each wheel about its axle by its side's wheel angle.
        // Rolling forwards turns the top of the tyre towards +x, i.e. a negative turn about +z.
        if (p.wheel) {
          const angle = st.mode === 'drive' || st.mode === 'missions' ? -(p.wheel.left ? sim.body.left.angle : sim.body.right.angle) : 0
          spinQ.setFromAxisAngle(p.wheel.axis, angle)
          p.obj.quaternion.copy(spinQ).multiply(p.wheel.rest)
          if (angle !== 0) p.obj.position.sub(p.wheel.pivot).applyQuaternion(spinQ).add(p.wheel.pivot)
        }

        // turning a sub-assembly over: it is on its own on the table, so only it shows
        if (alone && !p.subs.some((x) => x.group === alone)) fade = 0
        p.obj.visible = fade > 0.01
        anyVisible ||= p.obj.visible
        // a half-laid wire would still cast its whole shadow
        if (p.cable) for (const m of p.cable.meshes) m.mesh.castShadow = p.cable.reveal.hi.value > 0.999 && p.cable.reveal.lo.value < 0.001
        applyLook(p, fade, tint, intensity)
      }
      part.node.visible = anyVisible
    }

    if (labelRef.current && labelPart && byId[labelPart]) {
      const lp = byId[labelPart]
      labelRef.current.position.copy(lp.centerWorld).addScaledVector(lp.offsetWorld, e)
    }
  })

  const pieceOf = (o: THREE.Object3D | null): Piece | null => {
    while (o && o.parent) {
      const id = o.parent.userData.partId
      if (id) return byId[id]?.pieces.find((p) => p.obj === o) ?? null
      o = o.parent
    }
    return null
  }

  const onOver = (ev: ThreeEvent<PointerEvent>) => {
    const p = pieceOf(ev.object)
    if (!p || !p.pickable) return
    ev.stopPropagation()
    const s = useStore.getState()
    if (s.mode === 'wire') {
      const w = wireOfPiece.get(p.name)
      if (!w) return
      s.hoverWire(w)
    } else s.hover(p.partId)
    document.body.style.cursor = 'pointer'
  }
  const onOut = (ev: ThreeEvent<PointerEvent>) => {
    const p = pieceOf(ev.object)
    if (!p) return
    const s = useStore.getState()
    const w = wireOfPiece.get(p.name)
    if (s.mode === 'wire' && w && s.wire === w) {
      s.hoverWire(null)
      document.body.style.cursor = ''
    } else if (s.hovered === p.partId) {
      s.hover(null)
      document.body.style.cursor = ''
    }
  }
  const onClick = (ev: ThreeEvent<MouseEvent>) => {
    const p = pieceOf(ev.object)
    if (!p || !p.pickable) return
    ev.stopPropagation()
    if (ev.delta > 4) return // was a drag, not a click
    const s = useStore.getState()
    if (s.mode === 'wire') {
      const w = wireOfPiece.get(p.name)
      if (!w) return
      const g = WIRE_BY_ID[w].group
      if (g !== s.wireGroup) s.setWireGroup(g)
      s.pinWire(s.wirePinned === w && g === s.wireGroup ? null : w)
      return
    }
    if (s.mode !== 'explore') return
    s.select(s.selected === p.partId ? null : p.partId)
  }

  const wireInfo = activeWire ? WIRE_BY_ID[activeWire] : null
  const wireEndsNow = wireInfo?.wire.piece ? pieceByName.get(wireInfo.wire.piece)?.ends : undefined

  return (
    <>
      <primitive object={root} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} />
      {mode === 'assemble' && <StepArrows parts={parts} />}
      {labelPart && byId[labelPart] && (
        <group ref={labelRef} key={mode}>
          <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className="part-tag">{PART_BY_ID[labelPart].name}</div>
          </Html>
        </group>
      )}
      {wireInfo && wireEndsNow && (
        <>
          <Html position={(wireInfo.wire.anchor && pieceByName.get(wireInfo.wire.anchor)?.centerWorld) || wireEndsNow[0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className="wire-tag" style={{ ['--c' as string]: wireInfo.wire.color }}>
              <i />
              {wireInfo.wire.device ? `${wireInfo.wire.device} · ` : ''}
              {wireInfo.wire.from}
            </div>
          </Html>
          <Html position={wireEndsNow[1]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className="wire-tag board" style={{ ['--c' as string]: wireInfo.wire.color }}>
              <i />
              {wireInfo.wire.to}
            </div>
          </Html>
        </>
      )}
    </>
  )
}

useGLTF.preload(MODEL_URL)
