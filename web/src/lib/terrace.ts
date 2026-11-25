import type { Terrace, Terrain, Venue } from '../data/types'
import { pointInPolygon } from './polygon'

const RISER = 0.4 
const DEPTH = 1 
const WALK = 2.5 
const HALF = 68
const LAG = 1.5

function ringHeights(t: Terrain, x: number, z: number, r0: number, r1: number): number[] {
  const out: number[] = []
  for (let j = 0; j < t.nz; j++) {
    for (let i = 0; i < t.nx; i++) {
      const k = j * t.nx + i
      if (t.src[k] !== 0) continue
      const d = Math.hypot(t.x0 + i * t.cell - x, t.z0 + j * t.cell - z)
      if (d >= r0 && d < r1) out.push(t.h[k])
    }
  }
  return out.sort((a, b) => a - b)
}

export function terraceOf(venue: Venue, t: Terrain): Terrace | null {
  const stage = venue.fixedStage
  if (venue.seating !== 'terrace' || !stage) return null
  const r = stage.shape === 'circle' ? (stage.r ?? stage.w / 2) : Math.max(stage.w, stage.d) / 2
  const inner = ringHeights(t, stage.x, stage.z, r + 0.5, r + 1.8)
  const outer = ringHeights(t, stage.x, stage.z, r + 14, r + 19)
  if (!inner.length || !outer.length) return null
  const floor = inner[Math.floor(inner.length / 2)]
  const top = outer[Math.floor(outer.length * 0.9)]
  if (top - floor < RISER) return null
  const n = Math.max(1, Math.round((top - floor) / RISER))
  return {
    x: stage.x,
    z: stage.z,
    mid: (stage.azimuth * Math.PI) / 180,
    half: (HALF * Math.PI) / 180,
    rIn: r + 2,
    depth: DEPTH,
    n,
    rise: (top - floor) / n,
    walk: WALK,
    floor,
    top,
  }
}

export function terraceOuter(tr: Terrace): number {
  return tr.rIn + tr.n * tr.depth + tr.walk
}

export function inArc(tr: Terrace, x: number, z: number): boolean {
  const a = Math.atan2(x - tr.x, -(z - tr.z))
  let d = a - tr.mid
  d = Math.atan2(Math.sin(d), Math.cos(d))
  return Math.abs(d) <= tr.half
}

export function stepAt(tr: Terrace, r: number): number {
  if (r < tr.rIn) return tr.floor
  const k = Math.floor((r - tr.rIn) / tr.depth) + 1
  return k >= tr.n ? tr.top : tr.floor + k * tr.rise
}

export function terraceHeight(tr: Terrace, x: number, z: number): number | null {
  const dx = x - tr.x
  const dz = z - tr.z
  const r2 = dx * dx + dz * dz
  const out = terraceOuter(tr)
  if (r2 < tr.rIn * tr.rIn || r2 >= out * out) return null
  if (!inArc(tr, x, z)) return null
  return stepAt(tr, Math.sqrt(r2))
}

export function tuckedHeight(tr: Terrace, x: number, z: number): number | null {
  const r = Math.hypot(x - tr.x, z - tr.z)
  if (r < tr.rIn || r >= terraceOuter(tr) || !inArc(tr, x, z)) return null
  return stepAt(tr, r - LAG) - 0.03
}

export function pavedWeight(tr: Terrace, venue: Venue, h: number, x: number, z: number): number {
  if (h > tr.top - 0.12) return 0
  if (venue.water && pointInPolygon(x, z, venue.water)) return 0
  const d = Math.hypot(x - tr.x, z - tr.z)
  const reach = terraceOuter(tr)
  return Math.min(1, Math.max(0, (reach - d) / 3))
}
