import type { Layout } from '../data/types'
import { bounds, pointInPolygon, zoneAt } from './polygon'
import { rng } from './rng'

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

export function buildCrowd(layout: Layout, seed = 11): Crowd {
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
          if (!pointInPolygon(px, pz, zone.poly) || zoneAt(layout.zones, px, pz) !== zone) continue
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
      for (let z = b.z0 + sz / 2; z < b.z1; z += sz) {
        for (let x = b.x0 + sx / 2; x < b.x1; x += sx) {
          const mx = x + (r() - 0.5) * 0.4
          const mz = z + (r() - 0.5) * 0.4
          if (zoneAt(layout.zones, mx, mz) !== zone) continue
          const id = mats.length
          const keep = r()
          mats.push({ x: mx, z: mz, tone: Math.floor(r() * 4), keep, cap })
          for (let k = 0; k < per; k++) {
            people.push({
              x: mx - w / 2 + ((k + 0.5) * w) / per,
              z: mz + (r() - 0.5) * d * 0.3,
              seated: true,
              mat: id,
              tone: Math.floor(r() * 7),
              keep,
              cap,
            })
          }
        }
      }
    }
  }

  return { people, mats }
}

export function countShown(crowd: Crowd, scale: number): number {
  return crowd.people.reduce((n, p) => n + (isShown(p, scale) ? 1 : 0), 0)
}
