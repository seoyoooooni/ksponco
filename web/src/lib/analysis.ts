import type { Building, Layout, ScreenSpec, StageSpec, Terrain, Tree, Venue } from '../data/types'
import { isShown, type Crowd } from './crowd'
import {
  buildEventScene,
  buildFixedScene,
  mergeScenes,
  occluded,
  SUN_RAY_MAX,
  Terrain as EngineTerrain,
  type Canopy as EngineCanopy,
  type FixedStage,
  type Scene,
  type VenueData,
} from './engine'
import { sunPosition } from './sun'
import { heightAt } from './terrainSample'

export type Vec3 = [number, number, number]

export type Site = {
  venue: Venue
  terrain: Terrain
  trees: Tree[]
  buildings: Building[]
}

export type Blockers = Scene

export type Ground = EngineTerrain

class SiteGround extends EngineTerrain {
  private readonly site: Terrain

  constructor(site: Terrain) {
    super(site)
    this.site = site
  }

  heightAt(x: number, z: number): number {
    return heightAt(this.site, x, z)
  }
}

export function siteGround(terrain: Terrain): Ground {
  return new SiteGround(terrain)
}

export function scanGround(terrain: Terrain): Ground {
  return new EngineTerrain(terrain)
}

function fixedStageOf(s: StageSpec | null): FixedStage | null {
  if (!s) return null
  if (s.shape === 'circle') {
    return { shape: 'circle', x: s.x, z: s.z, r: s.r ?? s.w / 2, deckH: s.deckH, roofH: s.roofH, azimuth: s.azimuth }
  }
  return { shape: 'rect', x: s.x, z: s.z, w: s.w, d: s.d, deckH: s.deckH, roofH: s.roofH, azimuth: s.azimuth }
}

function venueData(site: Site): VenueData {
  return {
    venue: { ...site.venue, fixedStage: fixedStageOf(site.venue.fixedStage) },
    terrain: site.terrain,
    trees: site.trees,
    buildings: site.buildings,
  }
}

export function prepareBlockers(
  site: Site,
  layout: Layout | null,
  canopies: EngineCanopy[] = [],
  ground: Ground = siteGround(site.terrain),
): Blockers {
  const data = venueData(site)
  return mergeScenes(buildFixedScene(data, { ground }), buildEventScene(data, layout, canopies, ground))
}

export function canopyBlockers(site: Site, ground: Ground, canopies: EngineCanopy[]): Blockers {
  return buildEventScene(venueData(site), null, canopies, ground)
}

export function sunBlocked(blockers: Blockers, p: Vec3, dir: Vec3): boolean {
  return occluded(blockers, p, dir, SUN_RAY_MAX)
}

export function lineBlocked(blockers: Blockers, from: Vec3, to: Vec3, ignoreTag?: string): boolean {
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const dz = to[2] - from[2]
  const L = Math.hypot(dx, dy, dz)
  if (L < 1e-6) return false
  return occluded(blockers, from, [dx / L, dy / L, dz / L], L - 0.05, { ignoreTag })
}

export const STEP = 0.25

export type SunState = 0 | 1 | 2

export function sunStrip(date: string, from: number, to: number, point: Vec3, blockers: Blockers): SunState[] {
  const out: SunState[] = []
  for (let t = from; t < to - 1e-6; t += STEP) {
    const s = sunPosition(date, t + STEP / 2)
    if (s.altitude <= 0.5) out.push(0)
    else out.push(sunBlocked(blockers, point, s.direction) ? 1 : 2)
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

export function headBlocked(e: Vec3, t: Vec3, heads: HeadIndex): boolean {
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

export function visibleRatio(eye: Vec3, targets: Vec3[], heads: HeadIndex, blockers: Blockers, ignoreTag?: string): number {
  if (targets.length === 0) return 0
  let seen = 0
  for (const t of targets) {
    if (headBlocked(eye, t, heads)) continue
    if (lineBlocked(blockers, eye, t, ignoreTag)) continue
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
  blockers: Blockers,
): ViewResult {
  const perf = performerTargets(layout, stage, terrain)
  const stageRatio = visibleRatio(eye, perf, heads, blockers)
  const p = layout.performer
  const stageDistance = p ? Math.hypot(eye[0] - p.x, eye[2] - p.z) : 0
  let best = { ratio: 0, index: -1, distance: 0 }
  layout.screens.forEach((s, i) => {
    const { targets, facing } = screenTargets(s, terrain)
    const toEye = [eye[0] - s.x, eye[2] - s.z]
    if (toEye[0] * facing[0] + toEye[1] * facing[2] <= 0) return
    const ratio = visibleRatio(eye, targets, heads, blockers, `screen${i}`)
    const distance = Math.hypot(toEye[0], toEye[1])
    if (ratio > best.ratio || (ratio === best.ratio && distance < best.distance)) best = { ratio, index: i, distance }
  })
  return { stage: stageRatio, stageDistance, screen: best.ratio, screenIndex: best.index, screenDistance: best.distance }
}

export function sunPhrase(strip: SunState[], from: number, hourText: (h: number) => string): string {
  if (!strip.some((v) => v === 2)) return '내내 그늘'
  const at = shadeFrom(strip, from)
  if (at === null) return '끝까지 볕'
  const rest = strip.slice(Math.round((at - from) / STEP))
  if (rest.some((v) => v === 1)) return `${hourText(at)}부터 그늘`
  return '해\u00a0질 때까지 볕'
}
