import type { Layout, StageSpec, Terrain } from '../data/types'
import { performerTargets, visibleRatio, type Canopy, type HeadIndex } from './analysis'
import { bounds, zoneAt } from './polygon'
import { comfort, type SunPref } from './comfort'
import { dayShade, type ShadeGrid } from './shadeGrid'
import { heightAt } from './terrainSample'

export type SeatCell = {
  x: number
  z: number
  score: number
}

export function goodSeats(
  layout: Layout,
  stage: StageSpec | null,
  terrain: Terrain,
  heads: HeadIndex,
  canopies: Canopy[],
  shade: ShadeGrid | null,
  sunWeight: number,
  cell: number,
  pref: SunPref,
): SeatCell[] {
  const picnic = layout.zones.filter((z) => z.type === 'picnic')
  const all = performerTargets(layout, stage, terrain)
  const targets = all.filter((_, i) => i % 3 === 1)
  const out: SeatCell[] = []
  for (const zone of picnic) {
    const b = bounds(zone.poly)
    for (let z = b.z0 + cell / 2; z < b.z1; z += cell) {
      for (let x = b.x0 + cell / 2; x < b.x1; x += cell) {
        if (zoneAt(layout.zones, x, z) !== zone) continue
        const eye: [number, number, number] = [x, heightAt(terrain, x, z) + 0.8, z]
        const view = visibleRatio(eye, targets, heads, canopies)
        let day: number | null = null
        if (shade) {
          const i = Math.floor((x - shade.x0) / shade.cell)
          const j = Math.floor((z - shade.z0) / shade.cell)
          if (i >= 0 && j >= 0 && i < shade.nx && j < shade.nz) day = dayShade(shade, shade.frac[j * shade.nx + i])
        }
        out.push({ x, z, score: seatScore(view, comfort(day, pref), sunWeight) })
      }
    }
  }
  return out
}

export function seatScore(view: number, comfortScore: number, sunWeight: number): number {
  return view * (1 - sunWeight) + comfortScore * sunWeight
}

export function seatGrade(score: number): 0 | 1 | 2 {
  return score >= 0.62 ? 2 : score >= 0.42 ? 1 : 0
}

const VERDICT = ['아쉬운 자리예요', '무난한 자리예요', '좋은 자리예요'] as const

export function seatVerdict(view: number, shadeOfDaylight: number | null, pref: SunPref, sunWeight: number): string {
  const c = comfort(shadeOfDaylight, pref)
  const grade = seatGrade(seatScore(view, c, sunWeight))
  if (grade === 2 || shadeOfDaylight === null) return VERDICT[grade]
  const sightGood = view >= 0.6
  const comfortGood = c >= 0.5
  if (sightGood && !comfortGood) return pref === 'shade' ? '잘 보이지만 볕이 세요' : '잘 보이지만 그늘져요'
  if (!sightGood && comfortGood) return pref === 'shade' ? '그늘은 좋지만 잘 안 보여요' : '볕은 좋지만 잘 안 보여요'
  return VERDICT[grade]
}
