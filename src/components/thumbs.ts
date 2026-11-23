import * as THREE from 'three'
import type { Piece } from './RoverModel'

/**
 * Pictures of parts for the step panel (like the parts box in the printed manual): pieces are drawn
 * on their own, in their resting pose, by a small offscreen renderer, and cached as data URLs.
 */

const SIZE = 168
let renderer: THREE.WebGLRenderer | null = null
const cache = new Map<string, string>()

function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(2)
    renderer.setSize(SIZE, SIZE, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
  }
  return renderer
}

/** A plain copy of a piece's materials: full opacity, no highlight, whole wire (no reveal). */
function plainMaterial(m: THREE.Material) {
  const c = (m as THREE.MeshStandardMaterial).clone()
  c.opacity = 1
  c.transparent = false
  c.depthWrite = true
  if ('emissive' in c && c.emissive) c.emissive.set(0, 0, 0)
  return c
}

/** World matrix of a piece in its assembled, resting pose (ignores fly-ins, explode, sub-assembly moves). */
function restMatrix(p: Piece) {
  const quat = p.tip?.quat ?? p.wheel?.rest ?? p.obj.quaternion
  const local = new THREE.Matrix4().compose(p.base, quat, p.obj.scale)
  return p.obj.parent!.matrixWorld.clone().multiply(local)
}

/** Picture of these pieces together, seen from a three-quarter view that shows a flat panel's face. */
export function partPicture(key: string, pieces: Piece[]): string {
  const hit = cache.get(key)
  if (hit) return hit
  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.6))
  const sun = new THREE.DirectionalLight(0xffffff, 2.2)
  scene.add(sun)
  const box = new THREE.Box3()
  for (const p of pieces) {
    const clone = p.obj.clone(true)
    clone.matrixAutoUpdate = false
    clone.matrix.copy(restMatrix(p))
    clone.traverse((c) => {
      // the live piece may be hidden for a moment (its step has only just begun)
      c.visible = true
      const mesh = c as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(plainMaterial) : plainMaterial(mesh.material)
    })
    scene.add(clone)
    clone.updateMatrixWorld(true)
    box.expandByObject(clone)
  }
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  // look at a flat part's face: lean the view towards its thin direction
  const dims = size.toArray()
  const thin = dims.indexOf(Math.min(...dims))
  const dir = new THREE.Vector3(0.75, 0.75, 0.9)
  if (dims[thin] < 0.35 * Math.max(...dims)) dir.setComponent(thin, dir.getComponent(thin) + 1.4)
  dir.normalize()
  const camera = new THREE.PerspectiveCamera(28, 1, 0.001, 100)
  const radius = Math.max(size.length() / 2, 1e-3)
  camera.position.copy(center).addScaledVector(dir, radius / Math.sin(THREE.MathUtils.degToRad(14)) * 1.02)
  camera.lookAt(center)
  sun.position.copy(camera.position).add(new THREE.Vector3(0, radius * 3, 0))
  const r = getRenderer()
  r.setClearColor(0x000000, 0)
  r.render(scene, camera)
  const url = r.domElement.toDataURL('image/png')
  cache.set(key, url)
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose())
  })
  return url
}

/** Pieces that look the same (same size and mesh), so the parts box can say "×4". */
export function sameKind(p: Piece) {
  if (p.cable) {
    // wires: by colour
    let color = ''
    p.obj.traverse((c) => {
      const mesh = c as THREE.Mesh
      if (mesh.isMesh && !color) color = ((mesh.material as THREE.MeshStandardMaterial).color?.getHexString?.() ?? '') as string
    })
    return `wire:${color}`
  }
  // same outer size = same part (a mirrored copy counts too)
  const dims = p.box
    .getSize(new THREE.Vector3())
    .toArray()
    .map((d) => Math.round(d * 400))
    .sort((a, b) => a - b)
  return `${p.partId}:${dims.join('x')}`
}

export interface PartGroup {
  key: string
  count: number
  pieces: Piece[]
}

/** Group pieces into kinds for the parts box, biggest parts first. */
export function groupParts(pieces: Piece[]): PartGroup[] {
  const groups = new Map<string, PartGroup>()
  for (const p of pieces) {
    const k = sameKind(p)
    const g = groups.get(k) ?? { key: k, count: 0, pieces: [] }
    g.count++
    g.pieces.push(p)
    groups.set(k, g)
  }
  const vol = (g: PartGroup) => {
    const s = g.pieces[0].box.getSize(new THREE.Vector3())
    return g.pieces[0].partId === 'locks' ? -1 : s.x * s.y * s.z
  }
  return [...groups.values()].sort((a, b) => vol(b) - vol(a))
}
