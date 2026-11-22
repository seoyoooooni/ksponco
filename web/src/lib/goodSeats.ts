import type { Layout, StageSpec, Terrain } from '../data/types'
import { performerTargets, visibleRatio, type Canopy, type HeadIndex } from './analysis'
import { bounds, zoneAt } from './polygon'
import type { ShadeGrid } from './shadeGrid'
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
  cell = 4,
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
        let shadeFrac = 0
        if (shade) {
          const i = Math.floor((x - shade.x0) / shade.cell)
          const j = Math.floor((z - shade.z0) / shade.cell)
          if (i >= 0 && j >= 0 && i < shade.nx && j < shade.nz) shadeFrac = shade.frac[j * shade.nx + i]
        }
        out.push({ x, z, score: view * (1 - sunWeight) + shadeFrac * sunWeight })
      }
    }
  }
  return out
}

export function seatGrade(score: number): 0 | 1 | 2 {
  return score >= 0.62 ? 2 : score >= 0.42 ? 1 : 0
}
