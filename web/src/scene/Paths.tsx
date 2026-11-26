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

function ground(terrain: Terrain, x: number, z: number, half: number) {
  let y = heightAt(terrain, x, z)
  for (const [dx, dz] of [[half, 0], [-half, 0], [0, half], [0, -half]]) y = Math.max(y, heightAt(terrain, x + dx, z + dz))
  return y + LIFT
}

function build(paths: OsmPath[], terrain: Terrain, water: Vec2[] | null) {
  const disc = discOf(terrain)
  const pos: number[] = []
  const col: number[] = []
  const index: number[] = []
  const c = new Color()
  const edge = new Color()
  const usable = (x: number, z: number) =>
    inDisc(disc, x, z, 1) &&
    !(terrain.terrace && terraceHeight(terrain.terrace, x, z) !== null) &&
    !(water && pointInPolygon(x, z, water))
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
      const y = ground(terrain, x, z, half)
      pos.push(x + nx * half, y, z + nz * half, x, y, z, x - nx * half, y, z - nz * half)
      col.push(edge.r, edge.g, edge.b, c.r, c.g, c.b, edge.r, edge.g, edge.b)
      if (prev >= 0) {
        for (const k of [0, 1]) {
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
