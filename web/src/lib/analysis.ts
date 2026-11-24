import type { Layout, ScreenSpec, StageSpec, Terrain, Tree } from '../data/types'
import { isShown, type Crowd } from './crowd'
import { sunPosition } from './sun'
import { heightAt } from './terrainSample'

export type Vec3 = [number, number, number]

export type Canopy = {
  cx: number
  cy: number
  cz: number
  rx: number
  ry: number
}

export function prepareCanopies(trees: Tree[], terrain: Terrain): Canopy[] {
  return trees.map((t) => {
    const g = heightAt(terrain, t.x, t.z)
    const half = Math.max(0.5, (t.h - t.base) / 2)
    return { cx: t.x, cy: g + t.base + half, cz: t.z, rx: t.r, ry: half }
  })
}

export function canopyHit(canopies: Canopy[], p: Vec3, d: Vec3, maxT = Infinity): boolean {
  for (const c of canopies) {
    const ox = (p[0] - c.cx) / c.rx
    const oy = (p[1] - c.cy) / c.ry
    const oz = (p[2] - c.cz) / c.rx
    const dx = d[0] / c.rx
    const dy = d[1] / c.ry
    const dz = d[2] / c.rx
    const a = dx * dx + dy * dy + dz * dz
    const b = ox * dx + oy * dy + oz * dz
    const cc = ox * ox + oy * oy + oz * oz - 1
    const disc = b * b - a * cc
    if (disc <= 0) continue
    const s = Math.sqrt(disc)
    const t1 = (-b - s) / a
    const t2 = (-b + s) / a
    if (t2 > 0 && t1 < maxT) return true
  }
  return false
}

export const STEP = 0.25

export type SunState = 0 | 1 | 2

export function sunStrip(date: string, from: number, to: number, point: Vec3, canopies: Canopy[]): SunState[] {
  const out: SunState[] = []
  for (let t = from; t < to - 1e-6; t += STEP) {
    const s = sunPosition(date, t + STEP / 2)
    if (s.altitude <= 0.5) out.push(0)
    else out.push(canopyHit(canopies, point, s.direction) ? 1 : 2)
  }
  return out
}

export function sunHours(strip: SunState[]): number {
  return strip.filter((v) => v === 2).length * STEP
}

export function shadeFrom(strip: SunState[], from: number): number | null {
  for (let i = 0; i < strip.length; i++) {
    if (strip.slice(i).every((v) => v !== 2)) return from + i * STEP
  }
  return null
}

export type HeadIndex = Map<number, Vec3[]>

const HEAD_R = 0.13

export function indexHeads(crowd: Crowd, terrain: Terrain, scale: number, skipNear?: { x: number; z: number }): HeadIndex {
  const map: HeadIndex = new Map()
  const hidden = new Set<number>()
  if (skipNear) {
    crowd.mats.forEach((m, i) => {
      if (Math.hypot(m.x - skipNear.x, m.z - skipNear.z) < 2.2) hidden.add(i)
    })
  }
  for (const p of crowd.people) {
    if (!isShown(p, scale)) continue
    if (p.mat >= 0 && hidden.has(p.mat)) continue
    const y = heightAt(terrain, p.x, p.z) + (p.seated ? 0.86 : 1.6)
    const k = Math.floor(p.z)
    const list = map.get(k)
    if (list) list.push([p.x, y, p.z])
    else map.set(k, [[p.x, y, p.z]])
  }
  return map
}

function headBlocked(e: Vec3, t: Vec3, heads: HeadIndex): boolean {
  const dx = t[0] - e[0]
  const dy = t[1] - e[1]
  const dz = t[2] - e[2]
  const L2 = dx * dx + dy * dy + dz * dz
  const z0 = Math.floor(Math.min(e[2], t[2]))
  const z1 = Math.floor(Math.max(e[2], t[2]))
  for (let k = z0; k <= z1; k++) {
    const list = heads.get(k)
    if (!list) continue
    const tz = dz === 0 ? 0 : (k + 0.5 - e[2]) / dz
    const rx = e[0] + dx * tz
    for (const h of list) {
      if (Math.abs(h[0] - rx) > 1.2) continue
      const u = ((h[0] - e[0]) * dx + (h[1] - e[1]) * dy + (h[2] - e[2]) * dz) / L2
      if (u <= 0.02 || u >= 0.98) continue
      const px = e[0] + dx * u - h[0]
      const py = e[1] + dy * u - h[1]
      const pz = e[2] + dz * u - h[2]
      if (px * px + py * py + pz * pz < HEAD_R * HEAD_R) return true
    }
  }
  return false
}

export function visibleRatio(eye: Vec3, targets: Vec3[], heads: HeadIndex, canopies: Canopy[]): number {
  if (targets.length === 0) return 0
  let seen = 0
  for (const t of targets) {
    const d: Vec3 = [t[0] - eye[0], t[1] - eye[1], t[2] - eye[2]]
    if (headBlocked(eye, t, heads)) continue
    if (canopyHit(canopies, eye, d, 1)) continue
    seen++
  }
  return seen / targets.length
}

const DEG = Math.PI / 180

export function performerTargets(layout: Layout, stage: StageSpec | null, terrain: Terrain): Vec3[] {
  if (!layout.performer || !stage) return []
  const p = layout.performer
  const floor = heightAt(terrain, stage.x, stage.z) + stage.deckH
  const out: Vec3[] = []
  for (const f of [0.05, 0.3, 0.55, 0.8, 0.97]) {
    for (const off of [-0.22, 0, 0.22]) out.push([p.x + off, floor + p.h * f, p.z])
  }
  return out
}

export function screenTargets(screen: ScreenSpec, terrain: Terrain): { targets: Vec3[]; facing: Vec3 } {
  const g = heightAt(terrain, screen.x, screen.z)
  const a = screen.azimuth * DEG
  const right: Vec3 = [Math.cos(a), 0, Math.sin(a)]
  const facing: Vec3 = [Math.sin(a), 0, -Math.cos(a)]
  const targets: Vec3[] = []
  for (const fx of [-0.4, 0, 0.4]) {
    for (const fy of [0.15, 0.5, 0.85]) {
      targets.push([
        screen.x + right[0] * screen.w * fx,
        g + screen.bottom + screen.h * fy,
        screen.z + right[2] * screen.w * fx,
      ])
    }
  }
  return { targets, facing }
}

export type ViewResult = {
  stage: number
  stageDistance: number
  screen: number
  screenIndex: number
  screenDistance: number
}

export function viewFrom(
  eye: Vec3,
  layout: Layout,
  stage: StageSpec | null,
  terrain: Terrain,
  heads: HeadIndex,
  canopies: Canopy[],
): ViewResult {
  const perf = performerTargets(layout, stage, terrain)
  const stageRatio = visibleRatio(eye, perf, heads, canopies)
  const p = layout.performer
  const stageDistance = p ? Math.hypot(eye[0] - p.x, eye[2] - p.z) : 0
  let best = { ratio: 0, index: -1, distance: 0 }
  layout.screens.forEach((s, i) => {
    const { targets, facing } = screenTargets(s, terrain)
    const toEye = [eye[0] - s.x, eye[2] - s.z]
    if (toEye[0] * facing[0] + toEye[1] * facing[2] <= 0) return
    const ratio = visibleRatio(eye, targets, heads, canopies)
    const distance = Math.hypot(toEye[0], toEye[1])
    if (ratio > best.ratio || (ratio === best.ratio && distance < best.distance)) best = { ratio, index: i, distance }
  })
  return { stage: stageRatio, stageDistance, screen: best.ratio, screenIndex: best.index, screenDistance: best.distance }
}

export function sightPhrase(view: ViewResult): string {
  const far = view.stageDistance > 45
  if (view.stage >= 0.6 && !far) return '무대 잘 보임'
  if (view.stage >= 0.6 && view.screen >= 0.6) return '스크린 잘 보임'
  if (view.stage >= 0.6) return '무대 멀리 보임'
  if (view.screen >= 0.6) return '스크린만 잘 보임'
  if (view.stage >= 0.25) return '무대 일부 보임'
  return '앞사람에 많이 가림'
}


export function sunPhrase(strip: SunState[], from: number, hourText: (h: number) => string): string {
  if (!strip.some((v) => v === 2)) return '내내 그늘'
  const at = shadeFrom(strip, from)
  if (at === null) return '끝까지 볕'
  const rest = strip.slice(Math.round((at - from) / STEP))
  if (rest.some((v) => v === 1)) return `${hourText(at)}부터 그늘`
  return '해\u00a0질 때까지 볕'
}
