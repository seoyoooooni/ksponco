import { useSyncExternalStore } from 'react'
import type { VenueId } from '../data/types'
import type { PersonStyleId } from '../scene/personStyles'
import type { SheetSnap } from '../ui/BottomSheet'
import type { SunPref } from '../lib/comfort'
import type { ClosedArea, Tent, Variant } from '../lib/operator'
import type { Vec2 } from '../data/types'

export type CameraMode = 'orbit' | 'firstPerson'

export type MatPosition = {
  x: number
  z: number
}

export type SceneState = {
  venue: VenueId
  date: string
  hour: number
  stay: [number, number]
  mat: MatPosition | null
  matTouched: boolean
  eyeHeight: number
  camera: CameraMode
  fpAway: boolean
  fpRecenter: number
  notice: string | null
  crowdScale: number
  crowdCount: number
  personStyle: PersonStyleId
  sheetSnap: SheetSnap
  sheetH: number
  sceneReady: boolean
  pickerOpen: boolean
  sourcesOpen: boolean
  seats: boolean
  playing: boolean
  pref: SunPref | null
  operator: boolean
  opTool: OpTool | null
  tents: Tent[]
  closed: ClosedArea[]
  palms: ClosedArea[]
  zoneStart: Vec2 | null
  sold: Record<string, number>
  nextId: number
  variant: Variant
  compare: boolean
}

export type OpTool = 'tent' | 'zone' | 'palm' | 'erase'

type Listener = () => void

function todayString(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000)
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`
}

export const TODAY = todayString()

function initialDate(): string {
  const q = new URLSearchParams(window.location.search).get('date')
  return q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : TODAY
}

const PLAN_KEY = 'ksponco.plans.v1'

type SavedPlans = Pick<SceneState, 'tents' | 'closed' | 'palms' | 'sold' | 'nextId'>

function loadPlans(): Partial<SavedPlans> {
  try {
    const raw = window.localStorage.getItem(PLAN_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw) as Partial<SavedPlans>
    return {
      tents: Array.isArray(data.tents) ? data.tents : [],
      closed: Array.isArray(data.closed) ? data.closed : [],
      palms: Array.isArray(data.palms) ? data.palms : [],
      sold: data.sold && typeof data.sold === 'object' ? data.sold : {},
      nextId: typeof data.nextId === 'number' ? data.nextId : 1,
    }
  } catch {
    return {}
  }
}

function savePlans(s: SceneState) {
  try {
    const data: SavedPlans = { tents: s.tents, closed: s.closed, palms: s.palms, sold: s.sold, nextId: s.nextId }
    window.localStorage.setItem(PLAN_KEY, JSON.stringify(data))
  } catch {
    return
  }
}

let state: SceneState = {
  venue: 'lawn88',
  date: initialDate(),
  hour: 14,
  stay: [14, 16],
  mat: null,
  matTouched: false,
  eyeHeight: 0.8,
  camera: 'orbit',
  fpAway: false,
  fpRecenter: 0,
  notice: null,
  crowdScale: 1,
  crowdCount: 0,
  personStyle: 'chibi',
  sheetSnap: 1,
  sheetH: 0,
  sceneReady: false,
  pickerOpen: false,
  sourcesOpen: false,
  seats: false,
  playing: false,
  pref: null,
  operator: false,
  opTool: null,
  tents: [],
  closed: [],
  palms: [],
  zoneStart: null,
  sold: {},
  nextId: 1,
  variant: 'A',
  compare: false,
  ...loadPlans(),
}

const listeners = new Set<Listener>()

export const sceneStore = {
  get(): SceneState {
    return state
  },
  set(patch: Partial<SceneState>) {
    const prev = state
    state = { ...state, ...patch }
    if (prev.tents !== state.tents || prev.closed !== state.closed || prev.palms !== state.palms || prev.sold !== state.sold) savePlans(state)
    listeners.forEach((l) => l())
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

export function useScene<T>(select: (s: SceneState) => T): T {
  return useSyncExternalStore(sceneStore.subscribe, () => select(state))
}
