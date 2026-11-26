import type { Vec2, VenueId } from '../data/types'
import type { Variant } from './operator'

export type Rect = [number, number, number, number]

export type SharedPlan = { tents: Vec2[]; zones: Rect[]; palms: Rect[] }

export type PlanFile = {
  venue: VenueId
  date: string
  sold: number | null
  plans: Record<Variant, SharedPlan>
}

const VENUES: VenueId[] = ['lawn88', 'lake']
const VERSION = 1
const MAX_ITEMS = 300
const PARAM = 'op'

const r1 = (n: number) => Math.round(n * 10) / 10

export function rectOf(poly: Vec2[]): Rect {
  const xs = poly.map((p) => p[0])
  const zs = poly.map((p) => p[1])
  return [r1(Math.min(...xs)), r1(Math.min(...zs)), r1(Math.max(...xs)), r1(Math.max(...zs))]
}

export function emptyPlan(p: SharedPlan): boolean {
  return p.tents.length + p.zones.length + p.palms.length === 0
}

function compact(f: PlanFile) {
  const side = (p: SharedPlan) => ({ t: p.tents.map(([x, z]) => [r1(x), r1(z)]), c: p.zones, p: p.palms })
  return { v: VERSION, venue: f.venue, date: f.date, sold: f.sold, A: side(f.plans.A), B: side(f.plans.B) }
}

const nums = (a: unknown, n: number): a is number[] => Array.isArray(a) && a.length === n && a.every((v) => typeof v === 'number' && Number.isFinite(v))

function list<T>(a: unknown, n: number): T[] | null {
  if (a === undefined) return []
  if (!Array.isArray(a) || a.length > MAX_ITEMS || !a.every((v) => nums(v, n))) return null
  return a as T[]
}

function side(raw: unknown): SharedPlan | null {
  if (raw === undefined) return { tents: [], zones: [], palms: [] }
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const tents = list<Vec2>(o.t ?? o.tents, 2)
  const zones = list<Rect>(o.c ?? o.zones, 4)
  const palms = list<Rect>(o.p ?? o.palms, 4)
  if (!tents || !zones || !palms) return null
  return { tents, zones, palms }
}

export function readPlan(raw: unknown): PlanFile | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.v === 'number' && o.v > VERSION) return null
  if (typeof o.version === 'number' && o.version > VERSION) return null
  const venue = o.venue as VenueId
  const date = o.date
  if (!VENUES.includes(venue) || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const plans = (o.plans && typeof o.plans === 'object' ? o.plans : o) as Record<string, unknown>
  const A = side(plans.A)
  const B = side(plans.B)
  if (!A || !B) return null
  const sold = typeof o.sold === 'number' && Number.isFinite(o.sold) && o.sold >= 0 ? Math.round(o.sold) : null
  return { venue, date, sold, plans: { A, B } }
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): string {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function planUrl(f: PlanFile, base = `${window.location.origin}${window.location.pathname}`): string {
  return `${base}?${PARAM}=${toBase64Url(JSON.stringify(compact(f)))}`
}

export function decodePlanParam(value: string): PlanFile | null {
  try {
    return readPlan(JSON.parse(fromBase64Url(value)))
  } catch {
    return null
  }
}

export function planFileText(f: PlanFile): string {
  return JSON.stringify({ app: 'SunSeat', kind: 'operator-plan', version: VERSION, venue: f.venue, date: f.date, sold: f.sold, plans: f.plans }, null, 2)
}

export function parsePlanFile(text: string): PlanFile | null {
  try {
    return readPlan(JSON.parse(text))
  } catch {
    return null
  }
}

export function planFileName(f: PlanFile): string {
  return `sunseat-plan-${f.venue}-${f.date}.json`
}

export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function fromLocation(): PlanFile | null {
  if (typeof window === 'undefined') return null
  const q = new URLSearchParams(window.location.search)
  const value = q.get(PARAM)
  if (!value) return null
  q.delete(PARAM)
  const rest = q.toString()
  window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash)
  const plan = decodePlanParam(value)
  if (!plan) brokenLink = true
  return plan
}

let brokenLink = false

let pendingPlan: PlanFile | null = fromLocation()

export const initialPlan = pendingPlan

export function takeSharedPlan(): { plan: PlanFile | null; broken: boolean } {
  const out = { plan: pendingPlan, broken: brokenLink }
  pendingPlan = null
  brokenLink = false
  return out
}
