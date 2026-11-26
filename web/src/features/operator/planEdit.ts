import type { VenueId } from '../../data/types'
import { planKey, rectPoly, type ClosedArea, type Tent, type Variant } from '../../lib/operator'
import { rectOf, type PlanFile, type Rect, type SharedPlan } from '../../lib/planShare'
import { sceneStore, type SceneState } from '../../store/sceneStore'

export type PlanItems = { tents: Tent[]; closed: ClosedArea[]; palms: ClosedArea[] }

const LIMIT = 30

function itemsOf(s: SceneState, plan: string): PlanItems {
  return {
    tents: s.tents.filter((t) => t.plan === plan),
    closed: s.closed.filter((c) => c.plan === plan),
    palms: s.palms.filter((c) => c.plan === plan),
  }
}

export function planSize(s: SceneState, plan: string): number {
  const items = itemsOf(s, plan)
  return items.tents.length + items.closed.length + items.palms.length
}

export function editPlan(plan: string, change: (s: SceneState) => Partial<SceneState>) {
  const s = sceneStore.get()
  const past = s.opHistory[plan] ?? []
  const patch = change(s)
  sceneStore.set({ ...patch, opHistory: { ...s.opHistory, [plan]: [...past, itemsOf(s, plan)].slice(-LIMIT) } })
}

export function undoPlan(plan: string): boolean {
  const s = sceneStore.get()
  const past = s.opHistory[plan] ?? []
  const last = past[past.length - 1]
  if (!last) return false
  sceneStore.set({
    tents: [...s.tents.filter((t) => t.plan !== plan), ...last.tents],
    closed: [...s.closed.filter((c) => c.plan !== plan), ...last.closed],
    palms: [...s.palms.filter((c) => c.plan !== plan), ...last.palms],
    opHistory: { ...s.opHistory, [plan]: past.slice(0, -1) },
    zoneStart: null,
  })
  return true
}

export function clearPlan(plan: string) {
  editPlan(plan, (s) => ({
    tents: s.tents.filter((t) => t.plan !== plan),
    closed: s.closed.filter((c) => c.plan !== plan),
    palms: s.palms.filter((c) => c.plan !== plan),
    zoneStart: null,
  }))
}

export function planFileOf(s: SceneState, venue: VenueId, date: string): PlanFile {
  const side = (variant: Variant): SharedPlan => {
    const items = itemsOf(s, planKey(venue, date, variant))
    return {
      tents: items.tents.map((t) => [Math.round(t.x * 10) / 10, Math.round(t.z * 10) / 10]),
      zones: items.closed.map((c) => rectOf(c.poly)),
      palms: items.palms.map((c) => rectOf(c.poly)),
    }
  }
  const soldKey = `${venue}|${date}`
  return { venue, date, sold: soldKey in s.sold ? s.sold[soldKey] : null, plans: { A: side('A'), B: side('B') } }
}

export function applyPlanFile(f: PlanFile) {
  for (const variant of ['A', 'B'] as const) {
    const key = planKey(f.venue, f.date, variant)
    const side = f.plans[variant]
    editPlan(key, (s) => {
      let id = s.nextId
      const tents: Tent[] = side.tents.map(([x, z]) => ({ id: id++, plan: key, x, z }))
      const area = (r: Rect): ClosedArea => ({ id: id++, plan: key, poly: rectPoly([r[0], r[1]], [r[2], r[3]]) })
      const closed = side.zones.map(area)
      const palms = side.palms.map(area)
      return {
        tents: [...s.tents.filter((t) => t.plan !== key), ...tents],
        closed: [...s.closed.filter((c) => c.plan !== key), ...closed],
        palms: [...s.palms.filter((c) => c.plan !== key), ...palms],
        nextId: id,
      }
    })
  }
  const s = sceneStore.get()
  const sold = { ...s.sold }
  const soldKey = `${f.venue}|${f.date}`
  if (f.sold === null) delete sold[soldKey]
  else sold[soldKey] = f.sold
  sceneStore.set({ sold, zoneStart: null, opHover: null })
}
