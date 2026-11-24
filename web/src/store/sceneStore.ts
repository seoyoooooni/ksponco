import { useSyncExternalStore } from 'react'
import type { VenueId } from '../data/types'
import type { PersonStyleId } from '../scene/personStyles'
import type { SheetSnap } from '../ui/BottomSheet'

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
  notice: string | null
  crowdScale: number
  crowdCount: number
  personStyle: PersonStyleId
  sheetSnap: SheetSnap
  sheetH: number
  pickerOpen: boolean
  sourcesOpen: boolean
  seats: boolean
  playing: boolean
}

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

let state: SceneState = {
  venue: 'lawn88',
  date: initialDate(),
  hour: 14,
  stay: [14, 16],
  mat: null,
  matTouched: false,
  eyeHeight: 0.8,
  camera: 'orbit',
  notice: null,
  crowdScale: 1,
  crowdCount: 0,
  personStyle: 'chibi',
  sheetSnap: 1,
  sheetH: 0,
  pickerOpen: false,
  sourcesOpen: false,
  seats: false,
  playing: false,
}

const listeners = new Set<Listener>()

export const sceneStore = {
  get(): SceneState {
    return state
  },
  set(patch: Partial<SceneState>) {
    state = { ...state, ...patch }
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
