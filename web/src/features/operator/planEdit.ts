import type { ClosedArea, Tent } from '../../lib/operator'
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
