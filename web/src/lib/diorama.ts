import type { GridMeta, Vec2 } from '../data/types'

export const DISC_R = 100
const SIDES = 128

export type Disc = { x: number; z: number; r: number }

export function discOf(t: GridMeta): Disc {
  return {
    x: t.x0 + ((t.nx - 1) * t.cell) / 2,
    z: t.z0 + ((t.nz - 1) * t.cell) / 2,
    r: DISC_R,
  }
}

export function inDisc(d: Disc, x: number, z: number, margin = 0): boolean {
  return Math.hypot(x - d.x, z - d.z) <= d.r - margin
}

export function onRim(d: Disc, p: Vec2, eps = 0.05): boolean {
  return Math.abs(Math.hypot(p[0] - d.x, p[1] - d.z) - d.r) < eps
}

function edge(d: Disc): Vec2[] {
  const out: Vec2[] = []
  for (let i = 0; i < SIDES; i++) {
    const a = (i / SIDES) * Math.PI * 2
    out.push([d.x + Math.cos(a) * d.r, d.z + Math.sin(a) * d.r])
  }
  return out
}

export function clipToDisc(d: Disc, poly: Vec2[]): Vec2[] {
  if (poly.every(([x, z]) => inDisc(d, x, z))) return poly
  const clip = edge(d)
  let out = poly
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i]
    const b = clip[(i + 1) % clip.length]
    const inside = (p: Vec2) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0
    const cross = (p: Vec2, q: Vec2): Vec2 => {
      const x1 = p[0], z1 = p[1], x2 = q[0], z2 = q[1]
      const x3 = a[0], z3 = a[1], x4 = b[0], z4 = b[1]
      const den = (x1 - x2) * (z3 - z4) - (z1 - z2) * (x3 - x4)
      const t = ((x1 - x3) * (z3 - z4) - (z1 - z3) * (x3 - x4)) / den
      return [x1 + t * (x2 - x1), z1 + t * (z2 - z1)]
    }
    const input = out
    out = []
    for (let k = 0; k < input.length; k++) {
      const cur = input[k]
      const prev = input[(k + input.length - 1) % input.length]
      if (inside(cur)) {
        if (!inside(prev)) out.push(cross(prev, cur))
        out.push(cur)
      } else if (inside(prev)) out.push(cross(prev, cur))
    }
  }
  return out
}
