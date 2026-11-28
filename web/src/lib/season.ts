import type { VenueId } from '../data/types'

type Area = 'lawn88' | 'lawnHill' | 'forestCenter' | 'forestNE'

const PALETTE: Record<Area, string[]> = {
  lawn88: ['#C4AF9E', '#AEA48E', '#9D9881', '#969983', '#888E6F', '#AD9D8A'],
  lawnHill: ['#CEB29E', '#C1AD9A', '#848E6F', '#798C73', '#768663', '#A99C83'],
  forestCenter: ['#9B8B80', '#8E8376', '#556B48', '#60705D', '#4A5B3D', '#767961'],
  forestNE: ['#8A8078', '#827A6D', '#506847', '#576B59', '#435437', '#61634D'],
}

const ANCHORS = [30, 105, 151, 213, 268, 319]

export const LIFT = 1.15

const VENUE_AREAS: Record<VenueId, { lawn: Area; park: Area; trees: Area }> = {
  lawn88: { lawn: 'lawn88', park: 'lawnHill', trees: 'forestCenter' },
  lake: { lawn: 'lawnHill', park: 'lawnHill', trees: 'forestNE' },
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`

export function dayOfYearOf(date: string): number {
  const d = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
  return Math.round((d - Date.UTC(+date.slice(0, 4), 0, 1)) / 86_400_000) + 1
}

export function seasonHex(area: Area, date: string): string {
  const day = dayOfYearOf(date)
  const n = ANCHORS.length
  let k = ANCHORS.findIndex((a) => a > day) - 1
  if (k === -2) k = n - 1
  const from = k < 0 ? n - 1 : k
  const to = (from + 1) % n
  const start = k < 0 ? ANCHORS[n - 1] - 365 : ANCHORS[from]
  const end = to === 0 ? ANCHORS[0] + 365 : ANCHORS[to]
  const t = (day - start) / (end - start)
  const a = rgb(PALETTE[area][from])
  const b = rgb(PALETTE[area][to])
  return toHex(a.map((v, i) => v + (b[i] - v) * t))
}

export const lift = (hex: string, k = LIFT) => toHex(rgb(hex).map((v) => v * k))

export type SeasonColors = {
  lawn: string
  picnic: string
  park: string
  outer: string
  drape: string
  trees: string[]
}

const TREE_SHADES = [1.22, 1.1, 1, 0.9, 0.8]

export function seasonColors(venue: VenueId, date: string): SeasonColors {
  const areas = VENUE_AREAS[venue]
  const lawn = lift(seasonHex(areas.lawn, date))
  const park = lift(seasonHex(areas.park, date))
  const tree = lift(seasonHex(areas.trees, date))
  return {
    lawn,
    picnic: lift(lawn, 1.05),
    park,
    outer: lift(park, 1.03),
    drape: lift(park, 0.68),
    trees: TREE_SHADES.map((k) => lift(tree, k)),
  }
}
