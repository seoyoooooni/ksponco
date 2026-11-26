import type { Terrain, Vec2 } from '../data/types'
import { pointInPolygon } from './polygon'

const SHORE = 4

function shoreDistance(x: number, z: number, poly: Vec2[]): number {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const [x1, z1] = poly[i]
    const [x2, z2] = poly[(i + 1) % poly.length]
    const dx = x2 - x1
    const dz = z2 - z1
    const len = dx * dx + dz * dz || 1
    const u = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / len))
    best = Math.min(best, Math.hypot(x - x1 - u * dx, z - z1 - u * dz))
  }
  return best
}

const memo = new WeakMap<Terrain, WeakMap<Vec2[], number>>()

export function waterLevel(terrain: Terrain, poly: Vec2[]): number {
  const byPoly = memo.get(terrain) ?? new WeakMap<Vec2[], number>()
  memo.set(terrain, byPoly)
  const hit = byPoly.get(poly)
  if (hit !== undefined) return hit
  const scanned: number[] = []
  let top = -Infinity
  for (let j = 0; j < terrain.nz; j++) {
    for (let i = 0; i < terrain.nx; i++) {
      const x = terrain.x0 + i * terrain.cell
      const z = terrain.z0 + j * terrain.cell
      if (!pointInPolygon(x, z, poly)) continue
      const k = j * terrain.nx + i
      top = Math.max(top, terrain.h[k])
      if (terrain.src[k] === 0 && shoreDistance(x, z, poly) > SHORE) scanned.push(terrain.h[k])
    }
  }
  scanned.sort((a, b) => a - b)
  const level = scanned.length >= 20 ? scanned[Math.floor(scanned.length / 2)] + 0.03 : Number.isFinite(top) ? top + 0.05 : 0.05
  byPoly.set(poly, level)
  return level
}

export function underwater(terrain: Terrain, poly: Vec2[], level: number, x: number, z: number, h: number): boolean {
  if (h < level + 0.1) return true
  const i = Math.min(terrain.nx - 1, Math.max(0, Math.round((x - terrain.x0) / terrain.cell)))
  const j = Math.min(terrain.nz - 1, Math.max(0, Math.round((z - terrain.z0) / terrain.cell)))
  return terrain.src[j * terrain.nx + i] !== 0 || shoreDistance(x, z, poly) > SHORE
}
