import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import type { OsmPath, Terrain, Vec2 } from '../data/types'
import { discOf, inDisc } from '../lib/diorama'
import { pointInPolygon } from '../lib/polygon'
import { terraceHeight } from '../lib/terrace'
import { heightAt } from '../lib/terrainSample'
import { sceneColors } from './colors'

const STEP = 0.8
const LIFT = 0.05
const ACROSS = [1, 0.5, 0, -0.5, -1]

function tone(p: OsmPath): string {
  if (p.kind === 'service') return sceneColors.road
  if (p.kind === 'cycleway') return sceneColors.cycleway
  if (p.surface === 'paving_stones') return sceneColors.paving
  return sceneColors.path
}

function resample(pts: Vec2[]): Vec2[] {
  const out: Vec2[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1]
    const [x1, z1] = pts[i]
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / STEP))
    for (let k = 1; k <= n; k++) out.push([x0 + ((x1 - x0) * k) / n, z0 + ((z1 - z0) * k) / n])
  }
  return out
}

const REACH = 0.3

function surface(terrain: Terrain, x: number, z: number) {
  let y = heightAt(terrain, x, z)
  for (const [dx, dz] of [[REACH, 0], [-REACH, 0], [0, REACH], [0, -REACH]]) y = Math.max(y, heightAt(terrain, x + dx, z + dz))
  return y + LIFT
}

function usableAt(terrain: Terrain, water: Vec2[] | null) {
  const disc = discOf(terrain)
  return (x: number, z: number) =>
    inDisc(disc, x, z, 1) &&
    !(terrain.terrace && terraceHeight(terrain.terrace, x, z) !== null) &&
    !(water && pointInPolygon(x, z, water))
}

export type Route = {
  kind: string
  half: number
  pts: [number, number, number][]
  cum: number[]
  len: number
}

export function walkRoutes(paths: OsmPath[], terrain: Terrain, water: Vec2[] | null): Route[] {
  const usable = usableAt(terrain, water)
  const out: Route[] = []
  for (const p of paths) {
    let run: [number, number, number][] = []
    const flush = () => {
      if (run.length > 1) {
        const cum = [0]
        for (let i = 1; i < run.length; i++) cum.push(cum[i - 1] + Math.hypot(run[i][0] - run[i - 1][0], run[i][2] - run[i - 1][2]))
        out.push({ kind: p.kind, half: p.width / 2, pts: run, cum, len: cum[cum.length - 1] })
      }
      run = []
    }
    for (const [x, z] of resample(p.pts)) {
      if (usable(x, z)) run.push([x, surface(terrain, x, z), z])
      else flush()
    }
    flush()
  }
  return out
}

function build(paths: OsmPath[], terrain: Terrain, water: Vec2[] | null) {
  const pos: number[] = []
  const col: number[] = []
  const index: number[] = []
  const c = new Color()
  const edge = new Color()
  const usable = usableAt(terrain, water)
  for (const p of paths) {
    const pts = resample(p.pts)
    c.set(tone(p))
    edge.copy(c).multiplyScalar(0.92)
    const half = p.width / 2
    let prev = -1
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i]
      if (!usable(x, z)) {
        prev = -1
        continue
      }
      const [ax, az] = pts[Math.max(0, i - 1)]
      const [bx, bz] = pts[Math.min(pts.length - 1, i + 1)]
      const len = Math.hypot(bx - ax, bz - az) || 1
      const nx = -(bz - az) / len
      const nz = (bx - ax) / len
      const base = pos.length / 3
      for (const k of ACROSS) {
        const vx = x + nx * half * k
        const vz = z + nz * half * k
        pos.push(vx, surface(terrain, vx, vz), vz)
        const e = Math.abs(k) === 1 ? edge : c
        col.push(e.r, e.g, e.b)
      }
      if (prev >= 0) {
        for (let k = 0; k < ACROSS.length - 1; k++) {
          const a = prev + k
          const b = base + k
          index.push(a, a + 1, b, a + 1, b + 1, b)
        }
      }
      prev = base
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

export function Paths({ paths, terrain, water }: { paths: OsmPath[]; terrain: Terrain; water: Vec2[] | null }) {
  const geometry = useMemo(() => build(paths, terrain, water), [paths, terrain, water])
  useEffect(() => () => geometry.dispose(), [geometry])
  if (paths.length === 0) return null
  return (
    <mesh geometry={geometry} receiveShadow raycast={() => null}>
      <meshLambertMaterial vertexColors side={2} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-2} />
    </mesh>
  )
}
