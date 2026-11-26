import type { Terrain } from '../data/types'
import { terraceHeight } from './terrace'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function heightAt(t: Terrain, x: number, z: number): number {
  if (t.terrace) {
    const v = terraceHeight(t.terrace, x, z)
    if (v !== null) return v
  }
  return gridHeightAt(t, x, z)
}

export function gridHeightAt(t: Terrain, x: number, z: number): number {
  const fx = (x - t.x0) / t.cell
  const fz = (z - t.z0) / t.cell
  const i = clamp(Math.floor(fx), 0, t.nx - 2)
  const j = clamp(Math.floor(fz), 0, t.nz - 2)
  const u = clamp(fx - i, 0, 1)
  const w = clamp(fz - j, 0, 1)
  const h = (a: number, b: number) => t.h[b * t.nx + a]
  return (
    h(i, j) * (1 - u) * (1 - w) +
    h(i + 1, j) * u * (1 - w) +
    h(i, j + 1) * (1 - u) * w +
    h(i + 1, j + 1) * u * w
  )
}

export function sourceAt(t: Terrain, x: number, z: number): number {
  const i = clamp(Math.round((x - t.x0) / t.cell), 0, t.nx - 1)
  const j = clamp(Math.round((z - t.z0) / t.cell), 0, t.nz - 1)
  return t.src[j * t.nx + i]
}
