import type { Terrain } from '../data/types'
import { canopyHit, STEP, type Canopy } from './analysis'
import { sunPosition } from './sun'
import { heightAt } from './terrainSample'

export type ShadeGrid = {
  x0: number
  z0: number
  cell: number
  nx: number
  nz: number
  frac: number[]
  steps: number
  daySteps: number
}

export function scanBounds(terrain: Terrain): { x0: number; x1: number; z0: number; z1: number } {
  let x0 = Infinity
  let x1 = -Infinity
  let z0 = Infinity
  let z1 = -Infinity
  for (let j = 0; j < terrain.nz; j++) {
    for (let i = 0; i < terrain.nx; i++) {
      if (terrain.src[j * terrain.nx + i] !== 0) continue
      const x = terrain.x0 + i * terrain.cell
      const z = terrain.z0 + j * terrain.cell
      x0 = Math.min(x0, x)
      x1 = Math.max(x1, x)
      z0 = Math.min(z0, z)
      z1 = Math.max(z1, z)
    }
  }
  return { x0, x1, z0, z1 }
}

export function shadeGrid(
  terrain: Terrain,
  canopies: Canopy[],
  date: string,
  from: number,
  to: number,
  area: { x0: number; x1: number; z0: number; z1: number },
  cell = 2,
): ShadeGrid {
  const nx = Math.max(1, Math.floor((area.x1 - area.x0) / cell))
  const nz = Math.max(1, Math.floor((area.z1 - area.z0) / cell))
  const suns: { up: boolean; dir: [number, number, number] }[] = []
  for (let t = from; t < to - 1e-6; t += STEP) {
    const s = sunPosition(date, t + STEP / 2)
    suns.push({ up: s.altitude > 0.5, dir: s.direction })
  }
  const frac: number[] = []
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const x = area.x0 + (i + 0.5) * cell
      const z = area.z0 + (j + 0.5) * cell
      const p: [number, number, number] = [x, heightAt(terrain, x, z) + 0.5, z]
      let shade = 0
      for (const s of suns) if (!s.up || canopyHit(canopies, p, s.dir)) shade++
      frac.push(suns.length ? shade / suns.length : 0)
    }
  }
  return { x0: area.x0, z0: area.z0, cell, nx, nz, frac, steps: suns.length, daySteps: suns.filter((s) => s.up).length }
}

export function dayShade(grid: ShadeGrid, f: number): number | null {
  if (!grid.daySteps) return null
  const night = grid.steps - grid.daySteps
  return Math.min(1, Math.max(0, (f * grid.steps - night) / grid.daySteps))
}

export type ShadeSpot = {
  x: number
  z: number
  frac: number
  distance: number
}

export function shadeSpots(grid: ShadeGrid, from: { x: number; z: number }, count = 3, gap = 18, min = 0.95): ShadeSpot[] {
  const all: ShadeSpot[] = []
  grid.frac.forEach((f, k) => {
    if (f < min) return
    const i = k % grid.nx
    const j = Math.floor(k / grid.nx)
    const x = grid.x0 + (i + 0.5) * grid.cell
    const z = grid.z0 + (j + 0.5) * grid.cell
    all.push({ x, z, frac: f, distance: Math.hypot(x - from.x, z - from.z) })
  })
  all.sort((a, b) => a.distance - b.distance)
  const picks: ShadeSpot[] = []
  for (const s of all) {
    if (picks.length >= count) break
    if (picks.every((p) => Math.hypot(p.x - s.x, p.z - s.z) > gap)) picks.push(s)
  }
  return picks
}

export function directionName(from: { x: number; z: number }, to: { x: number; z: number }): string {
  const dx = to.x - from.x
  const dz = to.z - from.z
  const a = (Math.atan2(dx, -dz) * 180) / Math.PI
  const names = ['북쪽', '북동쪽', '동쪽', '남동쪽', '남쪽', '남서쪽', '서쪽', '북서쪽']
  return names[Math.round(((a + 360) % 360) / 45) % 8]
}
