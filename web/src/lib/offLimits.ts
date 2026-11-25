import type { StageSpec, Venue } from '../data/types'
import { pointInPolygon } from './polygon'

const MARGIN = 1

export function onStage(stage: StageSpec, x: number, z: number, margin = MARGIN): boolean {
  const dx = x - stage.x
  const dz = z - stage.z
  if (stage.shape === 'circle') return Math.hypot(dx, dz) < (stage.r ?? stage.w / 2) + margin
  const rot = Math.PI - (stage.azimuth * Math.PI) / 180
  const lx = dx * Math.cos(rot) - dz * Math.sin(rot)
  const lz = dx * Math.sin(rot) + dz * Math.cos(rot)
  return Math.abs(lx) < stage.w / 2 + margin && Math.abs(lz) < stage.d / 2 + margin
}

export function offLimits(venue: Venue, x: number, z: number): string | null {
  if (venue.fixedStage && onStage(venue.fixedStage, x, z)) return '무대 위에는 돗자리를 펼 수 없어요'
  if (venue.water && pointInPolygon(x, z, venue.water)) return '호수에는 돗자리를 펼 수 없어요'
  return null
}
