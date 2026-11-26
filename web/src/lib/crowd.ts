import type { Layout, Terrain } from '../data/types'
import { bounds, pointInPolygon, zoneAt } from './polygon'
import { rng } from './rng'
import { terraceHeight } from './terrace'

export const MAX_CROWD_SCALE = 1.5

export type Person = {
  x: number
  z: number
  seated: boolean
  mat: number
  tone: number
  keep: number
  cap: number
}

export type MatSpot = {
  x: number
  z: number
  rot: number
  tone: number
  keep: number
  cap: number
}

export type Crowd = {
  people: Person[]
  mats: MatSpot[]
}

export function isShown(item: { keep: number; cap: number }, scale: number): boolean {
  return item.keep < item.cap * scale
}

export function buildCrowd(layout: Layout, site: Pick<Terrain, 'terrace' | 'water'> | null = null, seed = 11): Crowd {
  const terrace = site?.terrace ?? null
  const water = site?.water ?? null
  const wet = (x: number, z: number) => water !== null && pointInPolygon(x, z, water)
  const r = rng(seed)
  const people: Person[] = []
  const mats: MatSpot[] = []

  for (const zone of layout.zones) {
    if (!zone.density || zone.density <= 0) continue
    const b = bounds(zone.poly)

    if (zone.type === 'standing') {
      const s = 1 / Math.sqrt(zone.density * MAX_CROWD_SCALE)
      for (let z = b.z0 + s / 2; z < b.z1; z += s) {
        for (let x = b.x0 + s / 2; x < b.x1; x += s) {
          const px = x + (r() - 0.5) * s * 0.5
          const pz = z + (r() - 0.5) * s * 0.5
          if (!pointInPolygon(px, pz, zone.poly) || zoneAt(layout.zones, px, pz) !== zone || wet(px, pz)) continue
          people.push({
            x: px,
            z: pz,
            seated: false,
            mat: -1,
            tone: Math.floor(r() * 7),
            keep: r(),
            cap: 1 / MAX_CROWD_SCALE,
          })
        }
      }
    }

    if (zone.type === 'picnic') {
      const { w, d, people: per } = layout.mat
      const sx = w + 0.6
      const sz = d + 0.6
      const cap = Math.min(1, (zone.density * sx * sz) / per)
      const onSteps = (x: number, z: number) => terrace !== null && terraceHeight(terrace, x, z) !== null
      const ground = (layout.performer ? arcSpots(b, layout.performer, sx, sz) : gridSpots(b, sx, sz))
        .map((spot) => ({ ...spot, x: spot.x + (r() - 0.5) * 0.3, z: spot.z + (r() - 0.5) * 0.3, bare: false }))
        .filter((spot) => !onSteps(spot.x, spot.z))
      const steps = terrace ? treadSpots(terrace, sx).map((spot) => ({ ...spot, bare: true })) : []
      const stepCap = terrace ? Math.min(1, (zone.density * sx * terrace.depth) / per) : cap
      for (const spot of [...ground, ...steps]) {
        const mx = spot.x
        const mz = spot.z
        if (zoneAt(layout.zones, mx, mz) !== zone || wet(mx, mz)) continue
        const rot = spot.rot + (spot.bare ? 0 : (r() - 0.5) * 0.12)
        const groupCap = spot.bare ? stepCap : cap
        const tx = Math.cos(rot)
        const tz = -Math.sin(rot)
        const fx = Math.sin(rot)
        const fz = Math.cos(rot)
        const id = mats.length
        const keep = r()
        mats.push({ x: mx, z: mz, rot, tone: Math.floor(r() * 4), keep, cap: groupCap })
        for (let k = 0; k < per; k++) {
          const off = -w / 2 + ((k + 0.5) * w) / per
          const j = spot.bare ? 0 : (r() - 0.5) * d * 0.3
          people.push({
            x: mx + tx * off + fx * j,
            z: mz + tz * off + fz * j,
            seated: true,
            mat: id,
            tone: Math.floor(r() * 7),
            keep,
            cap: groupCap,
          })
        }
      }
    }
  }

  return { people, mats }
}

type Spot = { x: number; z: number; rot: number }

function treadSpots(tr: NonNullable<Terrain['terrace']>, sx: number): Spot[] {
  const out: Spot[] = []
  for (let k = 1; k < tr.n; k++) {
    const rad = tr.rIn + (k - 0.5) * tr.depth
    const span = 2 * tr.half * rad - sx
    const count = Math.max(1, Math.floor(span / sx) + 1)
    const start = tr.mid - (((count - 1) * sx) / rad) / 2
    for (let i = 0; i < count; i++) {
      const a = start + (i * sx) / rad
      const x = tr.x + Math.sin(a) * rad
      const z = tr.z - Math.cos(a) * rad
      out.push({ x, z, rot: Math.atan2(tr.x - x, tr.z - z) })
    }
  }
  return out
}
type Box = { x0: number; x1: number; z0: number; z1: number }

function gridSpots(b: Box, sx: number, sz: number): Spot[] {
  const out: Spot[] = []
  for (let z = b.z0 + sz / 2; z < b.z1; z += sz) {
    for (let x = b.x0 + sx / 2; x < b.x1; x += sx) out.push({ x, z, rot: 0 })
  }
  return out
}

function arcSpots(b: Box, c: { x: number; z: number }, sx: number, sz: number): Spot[] {
  const out: Spot[] = []
  const nx = Math.max(Math.abs(b.x0 - c.x), Math.abs(b.x1 - c.x))
  const nz = Math.max(Math.abs(b.z0 - c.z), Math.abs(b.z1 - c.z))
  const far = Math.hypot(nx, nz)
  const dx = Math.max(b.x0 - c.x, 0, c.x - b.x1)
  const dz = Math.max(b.z0 - c.z, 0, c.z - b.z1)
  const near = Math.max(sz, Math.hypot(dx, dz))
  let ring = 0
  for (let rad = near + sz / 2; rad < far; rad += sz, ring++) {
    const n = Math.max(1, Math.floor((2 * Math.PI * rad) / sx))
    const step = (2 * Math.PI) / n
    for (let i = 0; i < n; i++) {
      const a = (i + (ring % 2) * 0.5) * step
      const x = c.x + Math.sin(a) * rad
      const z = c.z + Math.cos(a) * rad
      if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) continue
      out.push({ x, z, rot: Math.atan2(c.x - x, c.z - z) })
    }
  }
  return out
}

export function countShown(crowd: Crowd, scale: number): number {
  return crowd.people.reduce((n, p) => n + (isShown(p, scale) ? 1 : 0), 0)
}
