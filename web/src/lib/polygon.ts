import type { Vec2, Zone, ZoneType } from '../data/types'

export function pointInPolygon(x: number, z: number, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

const PRIORITY: ZoneType[] = ['closed', 'aisle', 'booth', 'standing', 'picnic']

export function zoneAt(zones: Zone[], x: number, z: number): Zone | null {
  for (const type of PRIORITY) {
    const hit = zones.find((zone) => zone.type === type && pointInPolygon(x, z, zone.poly))
    if (hit) return hit
  }
  return null
}

export function bounds(poly: Vec2[]): { x0: number; x1: number; z0: number; z1: number } {
  const xs = poly.map((p) => p[0])
  const zs = poly.map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }
}
