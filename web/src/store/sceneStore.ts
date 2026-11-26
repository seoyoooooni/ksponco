import { useSyncExternalStore } from 'react'
import type { VenueId } from '../data/types'
import type { PersonStyleId } from '../scene/personStyles'
import type { SheetSnap } from '../ui/BottomSheet'
import type { SunPref } from '../lib/comfort'
import type { ClosedArea, Tent, Variant } from '../lib/operator'
import type { PlanItems } from '../features/operator/planEdit'
import type { Vec2 } from '../data/types'
import { initialShare, type SharedSpot } from '../lib/share'
import { initialPlan } from '../lib/planShare'
import { loadSettings, saveSettings, type Quality, type ThemeMode } from '../features/settings/settings'

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
  suggestHintSeen: boolean
  personStyle: PersonStyleId | 'cookie'
  sheetSnap: SheetSnap
  sheetH: number
  sceneReady: boolean
  pickerOpen: boolean
  sourcesOpen: boolean
  seats: boolean
  playing: boolean
  peek: boolean
  pref: SunPref | null
  operator: boolean
  opTool: OpTool | null
  tents: Tent[]
  closed: ClosedArea[]
  palms: ClosedArea[]
  zoneStart: Vec2 | null
  opHover: Vec2 | null
  opHistory: Record<string, PlanItems[]>
  opLayers: OpLayer[] | null
  sold: Record<string, number>
  nextId: number
  variant: Variant
  compare: boolean
  shareOpen: boolean
  shared: SharedSpot | null
  settingsOpen: boolean
  theme: ThemeMode
  quality: Quality
  aboutOpen: boolean
}

export type OpTool = 'tent' | 'zone' | 'palm' | 'erase'

export type OpLayer = 'shade' | 'blocked' | 'wet'

type Listener = () => void

function todayString(): string {
  const now = new Date()
  const kst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000)
  return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`
}

export const TODAY = todayString()

function initialDate(): string {
  if (initialPlan) return initialPlan.date
  if (initialShare) return initialShare.date
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
  venue: initialPlan?.venue ?? initialShare?.venue ?? 'lawn88',
  date: initialDate(),
  hour: initialShare?.stay?.[0] ?? 14,
  stay: initialShare?.stay ?? [14, 16],
  mat: initialShare?.mat ?? null,
  matTouched: initialShare !== null,
  eyeHeight: 0.8,
  camera: 'orbit',
  fpAway: false,
  fpRecenter: 0,
  notice: null,
  crowdScale: 1,
  crowdCount: 0,
  suggestHintSeen: false,
  personStyle: 'cookie',
  sheetSnap: 1,
  sheetH: 0,
  sceneReady: false,
  pickerOpen: false,
  sourcesOpen: false,
  seats: false,
  playing: false,
  peek: false,
  pref: initialShare?.pref ?? null,
  operator: initialPlan !== null,
  opTool: null,
  tents: [],
  closed: [],
  palms: [],
  zoneStart: null,
  opHover: null,
  opHistory: {},
  opLayers: null,
  sold: {},
  nextId: 1,
  variant: 'A',
  compare: false,
  shareOpen: false,
  shared: initialShare,
  settingsOpen: false,
  aboutOpen: false,
  ...loadSettings(),
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
    if (prev.theme !== state.theme || prev.quality !== state.quality) saveSettings({ theme: state.theme, quality: state.quality })
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
