import type { Layout, StageSpec, Terrain, Vec2 } from '../data/types'
import { canopyHit, headBlocked, performerTargets, STEP, type Canopy, type HeadIndex, type Vec3 } from './analysis'
import { bounds, pointInPolygon, zoneAt } from './polygon'
import { sunPosition } from './sun'
import { heightAt } from './terrainSample'

export const TENT_SIZE = 5
export const TENT_ROOF = 2.8
const SHADE_GAIN = 0.25
const VIEW_LOSS = 0.2
const CELL = 4
const REACH = 30

export type Tent = { id: number; plan: string; x: number; z: number }

export type ClosedArea = { id: number; plan: string; poly: Vec2[] }

export type Variant = 'A' | 'B'

export function planKey(venue: string, date: string, variant: Variant): string {
  return `${venue}|${date}|${variant}`
}

export function tentCanopy(t: { x: number; z: number }, terrain: Terrain): Canopy {
  return { cx: t.x, cy: heightAt(terrain, t.x, t.z) + TENT_ROOF, cz: t.z, rx: TENT_SIZE * 0.56, ry: 0.3 }
}

export function withClosed(layout: Layout, closed: ClosedArea[]): Layout {
  if (closed.length === 0) return layout
  return { ...layout, zones: [...layout.zones, ...closed.map((c) => ({ type: 'closed' as const, poly: c.poly }))] }
}

export function rectPoly(a: Vec2, b: Vec2): Vec2[] {
  const x0 = Math.min(a[0], b[0])
  const x1 = Math.max(a[0], b[0])
  const z0 = Math.min(a[1], b[1])
  const z1 = Math.max(a[1], b[1])
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]
}

function peopleIn(layout: Layout, x0: number, z0: number, size: number): number {
  let n = 0
  for (let z = z0 + 0.5; z < z0 + size; z += 1) {
    for (let x = x0 + 0.5; x < x0 + size; x += 1) {
      const zone = zoneAt(layout.zones, x, z)
      if (zone && (zone.type === 'picnic' || zone.type === 'standing') && zone.density) n += zone.density
    }
  }
  return n
}

export function capacity(layout: Layout): number {
  let n = 0
  for (const zone of layout.zones) {
    if ((zone.type !== 'picnic' && zone.type !== 'standing') || !zone.density) continue
    const b = bounds(zone.poly)
    for (let z = Math.floor(b.z0) + 0.5; z < b.z1; z += 1) {
      for (let x = Math.floor(b.x0) + 0.5; x < b.x1; x += 1) {
        if (pointInPolygon(x, z, zone.poly) && zoneAt(layout.zones, x, z) === zone) n += zone.density
      }
    }
  }
  return Math.floor(n)
}

type OpCell = {
  x: number
  z: number
  people: number
  eye: Vec3
  ground: Vec3
  shadeBase: number
  shadeNow: boolean[]
  seenBase: boolean[]
  seenNow: boolean[]
}

export type Wet = { heavy: boolean } | null

export type OperatorResult = {
  capacity: number
  shadeGain: number
  blocked: number
  suggestion: { x: number; z: number } | null
  wetPeople: number | null
  wetCells: { x: number; z: number }[]
}

export type OperatorArgs = {
  layout: Layout
  stage: StageSpec | null
  terrain: Terrain
  heads: HeadIndex
  trees: Canopy[]
  tents: Tent[]
  palms: ClosedArea[]
  wet: Wet
  date: string
  from: number
  to: number
  suggest: boolean
}

function isWet(terrain: Terrain, trees: Canopy[], x: number, z: number, morning: Vec3[], wet: NonNullable<Wet>): boolean {
  if (wet.heavy) return true
  const h = heightAt(terrain, x, z)
  let sum = 0
  let n = 0
  for (const dx of [-CELL, 0, CELL]) {
    for (const dz of [-CELL, 0, CELL]) {
      if (!dx && !dz) continue
      sum += heightAt(terrain, x + dx, z + dz)
      n++
    }
  }
  if (h < sum / n - 0.03) return true
  if (!morning.length) return false
  const p: Vec3 = [x, h + 0.5, z]
  const shaded = morning.filter((d) => canopyHit(trees, p, d)).length
  return shaded / morning.length >= 0.7
}

function lawnCells(layout: Layout): { x: number; z: number; type: string }[] {
  const out: { x: number; z: number; type: string }[] = []
  for (const zone of layout.zones) {
    if ((zone.type !== 'picnic' && zone.type !== 'standing') || !zone.density) continue
    const b = bounds(zone.poly)
    for (let z = b.z0; z < b.z1; z += CELL) {
      for (let x = b.x0; x < b.x1; x += CELL) {
        const cx = x + CELL / 2
        const cz = z + CELL / 2
        if (zoneAt(layout.zones, cx, cz) === zone) out.push({ x: cx, z: cz, type: zone.type })
      }
    }
  }
  return out
}

export function analyzeOperator(args: OperatorArgs): OperatorResult {
  const { layout, stage, terrain, heads, trees, tents, palms, wet, date, from, to, suggest } = args
  const tentCanopies = tents.map((t) => tentCanopy(t, terrain))
  const suns: Vec3[] = []
  for (let t = from; t < to - 1e-6; t += STEP) {
    const s = sunPosition(date, t + STEP / 2)
    if (s.altitude > 0.5) suns.push(s.direction)
  }
  const targets = performerTargets(layout, stage, terrain).filter((_, i) => i % 3 === 1)

  const cells: OpCell[] = lawnCells(layout).map((c) => {
    const g = heightAt(terrain, c.x, c.z)
    const ground: Vec3 = [c.x, g + 0.5, c.z]
    const eye: Vec3 = [c.x, g + (c.type === 'standing' ? 1.6 : 0.86), c.z]
    let base = 0
    const shadeNow = suns.map((d) => {
      const byTree = canopyHit(trees, ground, d)
      if (byTree) base++
      return byTree || canopyHit(tentCanopies, ground, d)
    })
    const seenBase = targets.map((t) => {
      const d: Vec3 = [t[0] - eye[0], t[1] - eye[1], t[2] - eye[2]]
      return !headBlocked(eye, t, heads) && !canopyHit(trees, eye, d, 1)
    })
    const seenNow = targets.map((t, k) => {
      if (!seenBase[k]) return false
      const d: Vec3 = [t[0] - eye[0], t[1] - eye[1], t[2] - eye[2]]
      return !canopyHit(tentCanopies, eye, d, 1)
    })
    return {
      x: c.x,
      z: c.z,
      people: peopleIn(layout, c.x - CELL / 2, c.z - CELL / 2, CELL),
      eye,
      ground,
      shadeBase: suns.length ? base / suns.length : 0,
      shadeNow,
      seenBase,
      seenNow,
    }
  })

  const frac = (list: boolean[]) => (list.length ? list.filter(Boolean).length / list.length : 0)
  const gains = (c: OpCell, now: number) => now - c.shadeBase >= SHADE_GAIN
  const loses = (c: OpCell, seen: number) => frac(c.seenBase) - seen >= VIEW_LOSS

  let shadeGain = 0
  let blocked = 0
  for (const c of cells) {
    if (gains(c, frac(c.shadeNow))) shadeGain += c.people
    if (targets.length && loses(c, frac(c.seenNow))) blocked += c.people
  }

  let wetPeople: number | null = null
  const wetCells: { x: number; z: number }[] = []
  if (wet) {
    const morning: Vec3[] = []
    for (let t = 9; t < 12; t += STEP) {
      const s = sunPosition(date, t + STEP / 2)
      if (s.altitude > 0.5) morning.push(s.direction)
    }
    wetPeople = 0
    for (const c of cells) {
      if (!isWet(terrain, trees, c.x, c.z, morning, wet)) continue
      if (palms.some((p) => pointInPolygon(c.x, c.z, p.poly))) continue
      wetPeople += c.people
      wetCells.push({ x: c.x, z: c.z })
    }
    wetPeople = Math.round(wetPeople)
  }

  let suggestion: OperatorResult['suggestion'] = null
  if (suggest && suns.length) {
    let best = 0
    const picnic = layout.zones.filter((z) => z.type === 'picnic')
    for (const zone of picnic) {
      const b = bounds(zone.poly)
      for (let z = b.z0 + 3; z < b.z1 - 2; z += 6) {
        for (let x = b.x0 + 3; x < b.x1 - 2; x += 6) {
          if (zoneAt(layout.zones, x, z) !== zone) continue
          if (tents.some((t) => Math.hypot(t.x - x, t.z - z) < TENT_SIZE + 1)) continue
          const cand = [tentCanopy({ x, z }, terrain)]
          let score = 0
          for (const c of cells) {
            const near = Math.abs(c.x - x) <= REACH && Math.abs(c.z - z) <= REACH
            const nowShade = frac(c.shadeNow)
            if (near && !gains(c, nowShade)) {
              let extra = 0
              suns.forEach((d, i) => {
                if (!c.shadeNow[i] && canopyHit(cand, c.ground, d)) extra++
              })
              if (gains(c, nowShade + extra / suns.length)) score += c.people
            }
            if (targets.length) {
              const seenNow = frac(c.seenNow)
              if (!loses(c, seenNow)) {
                let lost = 0
                targets.forEach((t, k) => {
                  if (!c.seenNow[k]) return
                  const d: Vec3 = [t[0] - c.eye[0], t[1] - c.eye[1], t[2] - c.eye[2]]
                  if (canopyHit(cand, c.eye, d, 1)) lost++
                })
                if (loses(c, seenNow - lost / targets.length)) score -= 2 * c.people
              }
            }
          }
          if (score > best) {
            best = score
            suggestion = { x, z }
          }
        }
      }
    }
  }

  return { capacity: capacity(layout), shadeGain: Math.round(shadeGain), blocked: Math.round(blocked), suggestion, wetPeople, wetCells }
}
