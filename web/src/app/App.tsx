import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadClosures, loadEvents, loadForecast, loadLayout, loadVenueBundle } from '../data/load'
import { useLoad } from '../data/useLoad'
import type { Closure, EventItem, Forecast, Layout } from '../data/types'
import type { VenueBundle } from '../data/load'
import { AudienceSheet } from '../features/audience/AudienceSheet'
import { FirstPersonOverlay } from '../features/audience/FirstPersonOverlay'
import { EverydaySheet } from '../features/everyday/EverydaySheet'
import { PlacePicker } from '../features/picker/PlacePicker'
import { chipDateLabel, dateLabel, monthDayLabel, parseClock, rangeLabel, timeLabel } from '../lib/format'
import { autoPref, dayTempMax, prefWeight } from '../lib/comfort'
import { zoneAt } from '../lib/polygon'
import { offLimits } from '../lib/offLimits'
import { sourceAt } from '../lib/terrainSample'
import { planKey, rectPoly, rectProblem, tentProblem, withClosed, type ClosedArea, type Tent, type Wet } from '../lib/operator'
import { applyPlanFile, clearPlan, editPlan, planFileOf, planSize, undoPlan } from '../features/operator/planEdit'
import { PlanShareSheet } from '../features/operator/PlanShareSheet'
import { emptyPlan, takeSharedPlan, type PlanFile } from '../lib/planShare'
import { BOTH_COLOR, LAYER_COLOR, OperatorSheet } from '../features/operator/OperatorSheet'
import { OperatorTools } from '../features/operator/OperatorTools'
import { useOperator } from '../features/operator/useOperator'
import { PillButton } from '../ui/Buttons'
import { CloseIcon, PlayIcon } from '../ui/icons'
import { sunsetHour } from '../lib/sun'
import { WET_RAIN_MM } from '../lib/engine'
import { SceneCanvas } from '../scene/SceneCanvas'
import { sceneStore, TODAY, useScene, type OpLayer } from '../store/sceneStore'
import type { SheetSnap } from '../ui/BottomSheet'
import { SearchBar } from '../ui/SearchBar'
import { Toast } from '../ui/Toast'
import { DevTools } from './DevTools'
import { FloatingActions } from './FloatingActions'
import { Legend } from './Legend'
import { SourcesSheet } from './SourcesSheet'
import { useAnalysis } from './useAnalysis'
import { usePlayback } from './usePlayback'
import { LoadingScreen } from '../ui/LoadingScreen'
import { BrandMark } from '../ui/BrandMark'
import { forgetShare, sameSpot, shareMessage, shareUrl, takeSharedStay } from '../lib/share'
import { ShareSheet } from '../features/share/ShareSheet'
import { SharedBanner } from '../features/share/SharedBanner'
import { Tour } from '../features/tour/Tour'
import { markTourSeen, OP_TOUR_KEY, operatorTourSteps, tourSeen, tourSteps } from '../features/tour/steps'
import { SettingsSheet } from '../features/settings/SettingsSheet'
import { AboutSheet } from '../features/settings/AboutSheet'
import { applyTheme, watchSystemTheme } from '../features/settings/settings'
import { GearIcon } from '../ui/icons'

const VENUES_READY = ['lawn88', 'lake'] as const

function nowStart(date: string): number | null {
  if (date !== TODAY) return null
  const now = new Date()
  const h = now.getHours() + now.getMinutes() / 60
  return h >= 9 && h <= 20 ? Math.ceil(h * 4) / 4 : null
}

const DAY_HOURS: [number, number] = [9, 22]

function barHours(event: EventItem | null): [number, number] {
  if (!event) return DAY_HOURS
  return [Math.min(DAY_HOURS[0], Math.floor(parseClock(event.start))), Math.min(24, Math.max(DAY_HOURS[1], Math.ceil(parseClock(event.end))))]
}

function defaultEverydayStay(date: string, hours: number): [number, number] {
  const from = nowStart(date) ?? 14
  return [from, Math.min(DAY_HOURS[1], from + hours)]
}

function freeSpot(bundle: VenueBundle, center: { x: number; z: number }) {
  const ok = (x: number, z: number) => sourceAt(bundle.terrain, x, z) === 0 && !offLimits(bundle.venue, x, z)
  if (ok(center.x + 6, center.z + 6)) return { x: center.x + 6, z: center.z + 6 }
  for (let r = 4; r <= 40; r += 2) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2 + Math.PI / 4
      const x = center.x + Math.cos(a) * r
      const z = center.z + Math.sin(a) * r
      if (ok(x, z)) return { x, z }
    }
  }
  return { x: center.x + 6, z: center.z + 6 }
}

function defaultMat(layout: Layout | null, center: { x: number; z: number }, bundle: VenueBundle) {
  if (!layout) return freeSpot(bundle, center)
  const picnic = layout.zones.find((z) => z.type === 'picnic')
  if (!picnic) return null
  const xs = picnic.poly.map((p) => p[0])
  const zs = picnic.poly.map((p) => p[1])
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2
  for (let r = 0; r < 30; r += 2) {
    for (const [dx, dz] of [[6, 12], [-6, 12], [6, -6], [-6, -6]]) {
      const x = cx + dx + r
      const z = cz + dz
      if (zoneAt(layout.zones, x, z)?.type === 'picnic') return { x, z }
    }
  }
  return null
}

type Base = {
  bundle: VenueBundle
  events: EventItem[]
  closures: Closure[]
  forecast: Forecast | null
}

export function App() {
  usePlayback()
  const venue = useScene((s) => s.venue)
  const base = useLoad<Base>(async () => {
    const [bundle, events, closures, forecast] = await Promise.all([
      loadVenueBundle(venue),
      loadEvents(),
      loadClosures(),
      loadForecast().catch(() => null),
    ])
    return { bundle, events, closures, forecast }
  }, [venue])

  const sceneReady = useScene((s) => s.sceneReady)
  const [covered, setCovered] = useState(true)

  useEffect(() => {
    sceneStore.set({ sceneReady: false })
    setCovered(true)
  }, [venue])

  return (
    <>
      {base.status === 'ready' && <Main ready={base.data} />}
      {covered && (
        <LoadingScreen
          place={VENUE_NAMES[venue] ?? ''}
          error={base.status === 'error' ? base.error.message : null}
          leaving={base.status === 'ready' && sceneReady}
          onRetry={() => window.location.reload()}
          onLeft={() => setCovered(false)}
        />
      )}
    </>
  )
}

const EMPTY_FILE: PlanFile = { venue: 'lawn88', date: '2000-01-01', sold: null, plans: { A: { tents: [], zones: [], palms: [] }, B: { tents: [], zones: [], palms: [] } } }

const VENUE_NAMES: Record<string, string> = { lawn88: '88잔디마당', lake: '88호수 수변무대' }

function Main({ ready }: { ready: Base }) {
  const venue = useScene((s) => s.venue)
  const date = useScene((s) => s.date)
  const hour = useScene((s) => s.hour)
  const stay = useScene((s) => s.stay)
  const mat = useScene((s) => s.mat)
  const matTouched = useScene((s) => s.matTouched)
  const eyeHeight = useScene((s) => s.eyeHeight)
  const fpAway = useScene((s) => s.fpAway)
  const camera = useScene((s) => s.camera)
  const notice = useScene((s) => s.notice)
  const crowdScale = useScene((s) => s.crowdScale)
  const sheetSnap = useScene((s) => s.sheetSnap)
  const pickerOpen = useScene((s) => s.pickerOpen)
  const sourcesOpen = useScene((s) => s.sourcesOpen)
  const seats = useScene((s) => s.seats)
  const playing = useScene((s) => s.playing)
  const chosenPref = useScene((s) => s.pref)
  const operator = useScene((s) => s.operator)
  const opTool = useScene((s) => s.opTool)
  const variant = useScene((s) => s.variant)
  const compare = useScene((s) => s.compare)
  const plan = planKey(venue, date, variant)
  const planA = planKey(venue, date, 'A')
  const planB = planKey(venue, date, 'B')
  const allTents = useScene((s) => s.tents)
  const allClosed = useScene((s) => s.closed)
  const allPalms = useScene((s) => s.palms)
  const pick = <T extends { plan: string }>(list: T[], key: string) => list.filter((t) => t.plan === key)
  const tents = useMemo(() => pick(allTents, plan), [allTents, plan])
  const closedAreas = useMemo(() => pick(allClosed, plan), [allClosed, plan])
  const palms = useMemo(() => pick(allPalms, plan), [allPalms, plan])
  const zoneStart = useScene((s) => s.zoneStart)
  const canUndo = useScene((s) => (s.opHistory[planKey(s.venue, s.date, s.variant)]?.length ?? 0) > 0)
  const chosenLayers = useScene((s) => s.opLayers)
  const soldMap = useScene((s) => s.sold)
  const soldKey = `${venue}|${date}`

  const event = useMemo(
    () => ready.events.find((e) => e.venue === venue && e.date === date) ?? null,
    [ready, venue, date],
  )
  const closure = useMemo<Closure | null>(
    () => (event ? null : (ready.closures.find((c) => c.venue === venue && c.from <= date && date <= c.to) ?? null)),
    [ready, event, venue, date],
  )

  const layoutState = useLoad(
    async () => (event ? loadLayout(ready.bundle.venue, event.layout) : operator ? loadLayout(ready.bundle.venue, null) : null),
    [ready, event?.id, operator],
  )
  const baseLayout = layoutState.status === 'ready' ? layoutState.data : null
  const layout = useMemo(() => (operator && baseLayout ? withClosed(baseLayout, closedAreas) : baseLayout), [operator, baseLayout, closedAreas])
  const layoutReady = layoutState.status === 'ready'

  useEffect(() => {
    const shared = operator ? (forgetShare(), null) : takeSharedStay(venue, date)
    if (shared?.stay) {
      const [from, to] = shared.stay
      sceneStore.set({ stay: [from, to], hour: event ? Math.min(to, from + 2.5) : from, seats: false, sheetSnap: 1, pref: shared.pref })
    } else if (event) {
      const [lo, hi] = barHours(event)
      const from = Math.max(lo, parseClock(event.start))
      const to = Math.min(hi, parseClock(event.end))
      sceneStore.set({ stay: [from, to], hour: Math.min(to, from + 2.5), seats: false, sheetSnap: 1, pref: null })
    } else if (operator) {
      sceneStore.set({ stay: [12, 21], hour: 14.5, seats: false, sheetSnap: 1, pref: null })
    } else {
      const s = defaultEverydayStay(date, 2)
      sceneStore.set({ stay: s, hour: s[0], seats: false, sheetSnap: 1, pref: null })
    }
  }, [event?.id, date, operator])

  const tempMax = dayTempMax(date, ready.forecast, event?.tempMax ?? null)
  const pref = chosenPref ?? autoPref(tempMax)
  const sunWeight = prefWeight(tempMax, chosenPref !== null)
  const forecastDay = ready.forecast?.days.find((d) => d.date === date) ?? null
  const analysis = useAnalysis({ bundle: ready.bundle, layout, event, date, stay, mat, eyeHeight, crowdScale, seats: seats && !operator, pref, sunWeight, weather: forecastDay })
  const sold = soldKey in soldMap ? soldMap[soldKey] : (event?.people ?? null)
  const wet: Wet = forecastDay && forecastDay.rainPrevDay >= WET_RAIN_MM ? { mm: forecastDay.rainPrevDay } : null
  const wetText = forecastDay && wet ? `전날 비 ${forecastDay.rainPrevDay}mm · 젖은 바닥은 추정이에요` : null
  const planInputs = useMemo(() => {
    const make = (key: string, suggest: boolean) => ({ key, tents: pick(allTents, key), closed: pick(allClosed, key), palms: pick(allPalms, key), suggest })
    return compare ? [make(planA, false), make(planB, false)] : [make(plan, true)]
  }, [compare, plan, planA, planB, allTents, allClosed, allPalms])
  const op = useOperator({ on: operator, bundle: ready.bundle, baseLayout, plans: planInputs, wet, date, stay })
  const opResult = compare ? null : (op.results[plan] ?? null)
  const countsOf = (key: string) => ({ tents: pick(allTents, key).length, zones: pick(allClosed, key).length, palms: pick(allPalms, key).length })
  const layers: OpLayer[] = (chosenLayers ?? ['shade', 'blocked', 'wet']).filter((l) => l !== 'wet' || wet !== null)
  const opOverlay = useMemo(() => {
    if (!opResult) return undefined
    const cells = new Map<string, { x: number; z: number; size: number; color: string }>()
    const paint = (list: { x: number; z: number }[], layer: OpLayer) => {
      if (!layers.includes(layer)) return
      for (const c of list) {
        const key = `${c.x},${c.z}`
        const before = cells.get(key)
        const both = before && ((layer === 'blocked' && before.color === LAYER_COLOR.shade) || (layer === 'shade' && before.color === LAYER_COLOR.blocked))
        cells.set(key, { x: c.x, z: c.z, size: 4, color: both ? BOTH_COLOR : LAYER_COLOR[layer] })
      }
    }
    paint(opResult.wetCells, 'wet')
    paint(opResult.shadeCells, 'shade')
    paint(opResult.blockedCells, 'blocked')
    return cells.size ? [...cells.values()] : undefined
  }, [opResult, layers.join()])

  useEffect(() => {
    if (!layoutReady) return
    const current = sceneStore.get().mat
    const valid =
      current &&
      !offLimits(ready.bundle.venue, current.x, current.z) &&
      (layout ? zoneAt(layout.zones, current.x, current.z)?.type === 'picnic' : true)
    if (!valid) {
      const m = defaultMat(layout, analysis.lawnCenter, ready.bundle)
      sceneStore.set({ mat: m, matTouched: false, camera: 'orbit' })
    }
  }, [layoutReady, layout, analysis.lawnCenter, ready.bundle])

  const shareOpen = useScene((s) => s.shareOpen)
  const shared = useScene((s) => s.shared)
  const place = ready.bundle.venue.name
  const share = shareOpen && mat
    ? {
        url: shareUrl({ venue, date, mat, stay, pref: chosenPref }),
        message: shareMessage(place, date, TODAY, stay[0]),
      }
    : null
  const sceneReady = useScene((s) => s.sceneReady)
  const [touring, setTouring] = useState(false)
  useEffect(() => {
    if (!sceneReady || tourSeen()) return
    const t = window.setTimeout(() => setTouring(true), 900)
    return () => window.clearTimeout(t)
  }, [sceneReady])
  const endTour = useCallback(() => {
    markTourSeen()
    setTouring(false)
  }, [])
  const [opTouring, setOpTouring] = useState(false)
  const opTourTimer = useRef(0)
  const startOpTour = useCallback((delay: number) => {
    sceneStore.set({ compare: false, opTool: null, zoneStart: null, opHover: null, camera: 'orbit' })
    window.clearTimeout(opTourTimer.current)
    opTourTimer.current = window.setTimeout(() => setOpTouring(true), delay)
  }, [])
  useEffect(() => {
    if (!operator) {
      window.clearTimeout(opTourTimer.current)
      setOpTouring(false)
      return
    }
    if (sceneReady && !tourSeen(OP_TOUR_KEY)) startOpTour(600)
    return () => window.clearTimeout(opTourTimer.current)
  }, [operator, sceneReady, startOpTour])
  const endOpTour = useCallback(() => {
    markTourSeen(OP_TOUR_KEY)
    setOpTouring(false)
  }, [])
  const settingsOpen = useScene((s) => s.settingsOpen)
  const theme = useScene((s) => s.theme)
  const quality = useScene((s) => s.quality)
  useEffect(() => {
    applyTheme(theme)
    return watchSystemTheme(theme)
  }, [theme])
  const closeSettings = useCallback(() => sceneStore.set({ settingsOpen: false }), [])
  const aboutOpen = useScene((s) => s.aboutOpen)
  const closeAbout = useCallback(() => sceneStore.set({ aboutOpen: false }), [])
  const closeShare = useCallback(() => sceneStore.set({ shareOpen: false }), [])
  const showNotice = useCallback((text: string) => sceneStore.set({ notice: text }), [])
  const [planShareOpen, setPlanShareOpen] = useState(false)
  const closePlanShare = useCallback(() => setPlanShareOpen(false), [])
  const importPlan = useCallback((f: PlanFile) => {
    const s = sceneStore.get()
    const moved = f.venue !== s.venue || f.date !== s.date
    sceneStore.set({
      ...(moved ? { venue: f.venue, date: f.date, mat: null } : {}),
      operator: true,
      compare: false,
      variant: 'A',
      opTool: null,
      zoneStart: null,
      opHover: null,
    })
    const mine = planFileOf(sceneStore.get(), f.venue, f.date).plans
    const replaced = (['A', 'B'] as const).filter((v) => !emptyPlan(mine[v]) && JSON.stringify(mine[v]) !== JSON.stringify(f.plans[v]))
    applyPlanFile(f)
    const head = `${VENUE_NAMES[f.venue] ?? f.venue} ${monthDayLabel(f.date)} 운영 계획을 불러왔어요`
    const sides = replaced.map((v) => `${v}안`).join('·')
    sceneStore.set({
      notice: replaced.length ? `${head}\n내가 만들어 둔 ${sides}을 받은 계획으로 바꿨어요. ${sides}에서 되돌리기를 누르면 내 계획이 다시 돌아와요` : head,
    })
  }, [])
  useEffect(() => {
    const { plan, broken } = takeSharedPlan()
    if (plan) importPlan(plan)
    else if (broken) sceneStore.set({ notice: '운영 계획 링크가 깨져서 열지 못했어요' })
  }, [importPlan])
  const banner =
    shared && !operator && shared.venue === venue && shared.date === date && sameSpot(mat, shared.mat) ? (
      <SharedBanner
        when={`${dateLabel(shared.date)} · ${rangeLabel(...(shared.stay ?? stay))}`}
        onClose={() => sceneStore.set({ shared: null })}
      />
    ) : null

  useEffect(() => {
    document.documentElement.dataset.view = camera === 'firstPerson' ? 'fp' : 'main'
  }, [camera])

  const clearNotice = useCallback(() => sceneStore.set({ notice: null }), [])
  const setSnap = useCallback((v: SheetSnap) => sceneStore.set({ sheetSnap: v }), [])
  const setSheetH = useCallback((h: number) => sceneStore.set({ sheetH: h }), [])
  const peekTimer = useRef(0)
  const peekHour = useCallback((h: number) => {
    sceneStore.set({ hour: h, peek: true })
    window.clearTimeout(peekTimer.current)
    peekTimer.current = window.setTimeout(() => sceneStore.set({ peek: false }), 1500)
  }, [])
  const closePicker = useCallback(() => sceneStore.set({ pickerOpen: false }), [])
  const closeSources = useCallback(() => sceneStore.set({ sourcesOpen: false }), [])

  const mode = operator ? 'operator' : event ? 'event' : 'everyday'
  const steps = useMemo(() => tourSteps(mode === 'event'), [mode])
  const opSteps = useMemo(() => operatorTourSteps(wet !== null), [wet !== null])

  const opStage = baseLayout?.stage ?? ready.bundle.venue.fixedStage ?? null
  const tentWhy = (x: number, z: number, ignore?: number) => tentProblem(layout, opStage, ready.bundle.venue, sceneStore.get().tents.filter((t) => t.plan === plan), x, z, ignore)

  const pickOperator = (x: number, z: number) => {
    const s = sceneStore.get()
    if (s.opTool === 'tent') {
      const why = tentWhy(x, z)
      if (why) return sceneStore.set({ notice: why })
      editPlan(plan, (s) => ({ tents: [...s.tents, { id: s.nextId, plan, x, z }], nextId: s.nextId + 1, notice: null }))
    } else if (s.opTool === 'zone' || s.opTool === 'palm') {
      if (!s.zoneStart) return sceneStore.set({ zoneStart: [x, z], opHover: null, notice: '반대쪽 꼭짓점을 눌러 주세요' })
      const why = rectProblem(s.zoneStart, [x, z])
      if (why) return sceneStore.set({ notice: why })
      const poly = rectPoly(s.zoneStart, [x, z])
      const asZone = s.opTool === 'zone'
      editPlan(plan, (s) => {
        const item = { id: s.nextId, plan, poly }
        return { ...(asZone ? { closed: [...s.closed, item] } : { palms: [...s.palms, item] }), nextId: s.nextId + 1, zoneStart: null, opHover: null, notice: null }
      })
    } else if (s.opTool === 'erase') {
      const inArea = (c: ClosedArea) => c.plan === plan && zoneAt([{ type: 'closed', poly: c.poly }], x, z)
      const tent = s.tents.find((t) => t.plan === plan && Math.abs(t.x - x) < 3 && Math.abs(t.z - z) < 3)
      const palm = s.palms.find(inArea)
      const area = s.closed.find(inArea)
      if (tent) editPlan(plan, (s) => ({ tents: s.tents.filter((t) => t !== tent) }))
      else if (palm) editPlan(plan, (s) => ({ palms: s.palms.filter((c) => c !== palm) }))
      else if (area) editPlan(plan, (s) => ({ closed: s.closed.filter((c) => c !== area) }))
      else sceneStore.set({ notice: '지울 게 없는 곳이에요' })
    } else {
      sceneStore.set({ notice: '도구를 먼저 골라 주세요' })
    }
  }

  const eraseTent = (id: number) => editPlan(plan, (s) => ({ tents: s.tents.filter((t) => t.id !== id) }))
  const moveTent = (id: number, x: number, z: number) => editPlan(plan, (s) => ({ tents: s.tents.map((t) => (t.id === id ? { ...t, x, z } : t)) }))
  const undo = () => {
    if (!undoPlan(plan)) sceneStore.set({ notice: '되돌릴 게 없어요' })
  }
  const clear = () => {
    clearPlan(plan)
    sceneStore.set({ notice: `${variant}안을 비웠어요 · 되돌리기로 살릴 수 있어요` })
  }

  useEffect(() => {
    if (!operator || compare) return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undo()
      } else if (e.key === 'Escape' && sceneStore.get().zoneStart) {
        sceneStore.set({ zoneStart: null, opHover: null, notice: null })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [operator, compare, plan])

  const TOOL_HINT = { tent: '잔디를 눌러 그늘막을 놓으세요 · 놓은 건 끌어서 옮겨요', zone: '출입 금지 구역의 한쪽 꼭짓점을 눌러 주세요', palm: '야자매트를 깔 곳의 한쪽 꼭짓점을 눌러 주세요', erase: '지울 그늘막·구역·매트를 눌러 주세요' } as const
  const copyAtoB = () => {
    editPlan(planB, (s) => {
      let id = s.nextId
      const tentsB: Tent[] = s.tents.filter((t) => t.plan === planA).map((t) => ({ ...t, id: id++, plan: planB }))
      const closedB = s.closed.filter((c) => c.plan === planA).map((c) => ({ ...c, id: id++, plan: planB }))
      const palmsB = s.palms.filter((c) => c.plan === planA).map((c) => ({ ...c, id: id++, plan: planB }))
      return { tents: [...s.tents, ...tentsB], closed: [...s.closed, ...closedB], palms: [...s.palms, ...palmsB], nextId: id }
    })
  }
  const firstPerson = camera === 'firstPerson'
  const suggestedAt = mode === 'everyday' && !closure ? (analysis.suggestion?.at ?? null) : null
  const takeSuggestion = () => {
    if (suggestedAt) sceneStore.set({ mat: { x: suggestedAt.x, z: suggestedAt.z }, matTouched: true })
  }
  const hadSuggestion = useRef(false)
  useEffect(() => {
    if (suggestedAt) hadSuggestion.current = true
    else if (hadSuggestion.current && !sceneStore.get().suggestHintSeen) sceneStore.set({ suggestHintSeen: true })
  }, [suggestedAt])
  const sunset = sunsetHour(date)
  const duration = stay[1] - stay[0]
  const durationValue = [1, 2, 3].includes(duration) ? duration : ('custom' as const)

  const fpLines: [string, string?] = analysis.view
    ? [
        analysis.view.stage >= 0.95
          ? '무대가 다 보여요'
          : analysis.view.stage >= 0.6
            ? '무대가 대부분 보여요'
            : `무대가 ${Math.round(analysis.view.stage * 100)}%만 보여요`,
        analysis.view.stageDistance > 45 && analysis.view.screen >= 0.6 ? '표정은 스크린으로 보세요' : undefined,
      ]
    : [analysis.headline]

  return (
    <>
      <SceneCanvas
        bundle={ready.bundle}
        layout={layout}
        crowd={analysis.crowd}
        overlay={analysis.overlay}
        bubble={!matTouched && mode === 'event' ? '여기 앉으면?' : null}
        suggestion={suggestedAt}
        onSuggestion={takeSuggestion}
        overlayOverride={operator ? opOverlay : undefined}
        ponds={mode !== 'operator' && !closure ? analysis.ponds : null}
        operator={
          operator
            ? {
                tents,
                palms,
                suggestion: opResult?.suggestion ?? null,
                zoneStart,
                draft: !compare && (opTool === 'zone' || opTool === 'palm') ? opTool : null,
                onPick: compare ? () => sceneStore.set({ notice: 'A안이나 B안을 골라야 고칠 수 있어요' }) : pickOperator,
                onHover: !compare && zoneStart ? (x, z) => sceneStore.set({ opHover: [x, z] }) : undefined,
                onTent: !compare && opTool === 'erase' ? eraseTent : undefined,
                canMove: !compare && (opTool === 'tent' || opTool === null) ? (id, x, z) => tentWhy(x, z, id) === null : undefined,
                onMove: !compare && (opTool === 'tent' || opTool === null) ? moveTent : undefined,
              }
            : undefined
        }
      />

      {firstPerson ? (
        <FirstPersonOverlay
          lines={fpLines}
          stats={analysis.view ? analysis.stats : null}
          eyeHeight={eyeHeight}
          onEye={(h) => sceneStore.set({ eyeHeight: h })}
          onBack={() => sceneStore.set({ camera: 'orbit' })}
          away={fpAway}
          onRecenter={() => sceneStore.set({ fpRecenter: sceneStore.get().fpRecenter + 1 })}
          recenterLabel={layout?.stage || ready.bundle.venue.fixedStage ? '무대 보기' : '처음 방향 보기'}
        />
      ) : (
        <>
          <header className="topbar">
            <span className="brand">
              <BrandMark />
              <span className="sr-only">SunSeat</span>
            </span>
            <SearchBar
              place={ready.bundle.venue.name}
              date={dateLabel(date)}
              dateShort={chipDateLabel(date)}
              onOpen={() => sceneStore.set({ pickerOpen: true })}
              right={
                operator ? (
                    <PillButton
                      variant="primary"
                      style={{ height: 44 }}
                      className="op-exit"
                      aria-label="운영자 모드 끝내기"
                      icon={<CloseIcon size={16} />}
                      onClick={() => sceneStore.set({ operator: false, opTool: null, zoneStart: null })}
                    >
                      <span className="op-exit__text">운영자</span>
                    </PillButton>
                ) : undefined
              }
            />
          </header>
          <button type="button" className="icon-chip settings-btn" aria-label="설정" title="설정" onClick={() => sceneStore.set({ settingsOpen: true })}>
            <GearIcon size={20} />
          </button>
          {operator && !compare && (
            <OperatorTools
              tool={opTool}
              wet={wet !== null}
              onTool={(t) => sceneStore.set({ opTool: t, zoneStart: null, opHover: null, notice: t ? TOOL_HINT[t] : null })}
              canUndo={canUndo}
              onUndo={undo}
            />
          )}
          {mode !== 'operator' && !closure && !(mode === 'event' && seats) && analysis.ponds && <Legend kind="ponds" />}
          {playing && (
            <div className="play-clock" aria-hidden="true">
              <PlayIcon size={12} />
              {timeLabel(Math.round(hour * 6) / 6)}
            </div>
          )}
          {mode !== 'operator' && (
            <FloatingActions
              onView={mat && !closure ? () => sceneStore.set({ camera: 'firstPerson' }) : null}
              onShare={mat && !closure ? () => sceneStore.set({ shareOpen: true }) : null}
              seats={mode === 'event' ? { on: seats, toggle: () => sceneStore.set({ seats: !seats }), legend: <Legend kind="seats" inline ponds={Boolean(analysis.ponds)} /> } : null}
            />
          )}
          {mode === 'operator' ? (
            <OperatorSheet
              onVisibleHeight={setSheetH}
              view={compare ? 'compare' : variant}
              onView={(v) => sceneStore.set(v === 'compare' ? { compare: true, opTool: null, zoneStart: null, opHover: null } : { compare: false, variant: v, zoneStart: null, opHover: null })}
              result={opResult}
              resultA={op.results[planA] ?? null}
              resultB={op.results[planB] ?? null}
              counts={countsOf(plan)}
              countsA={countsOf(planA)}
              countsB={countsOf(planB)}
              sold={sold}
              onSold={(v) => {
                const next = { ...sceneStore.get().sold }
                if (v === null) delete next[soldKey]
                else next[soldKey] = v
                sceneStore.set({ sold: next })
              }}
              rangeText={rangeLabel(stay[0], stay[1])}
              wetText={wetText}
              busy={op.busy}
              canCopy={variant === 'B' && planSize(sceneStore.get(), planB) === 0 && planSize(sceneStore.get(), planA) > 0}
              onCopy={copyAtoB}
              canClear={planSize(sceneStore.get(), plan) > 0}
              onClear={clear}
              layers={layers}
              onLayers={(v) => sceneStore.set({ opLayers: v })}
              snap={sheetSnap}
              onSnap={setSnap}
              onShare={() => setPlanShareOpen(true)}
              onSuggest={() => {
                const at = opResult?.suggestion
                if (at && !tentWhy(at.x, at.z)) editPlan(plan, (s) => ({ tents: [...s.tents, { id: s.nextId, plan, x: at.x, z: at.z }], nextId: s.nextId + 1 }))
              }}
            />
          ) : mode === 'event' ? (
            <AudienceSheet
              banner={banner}
              snap={sheetSnap}
              onSnap={setSnap}
              onVisibleHeight={setSheetH}
              headline={analysis.headline}
              pref={pref}
              onPref={(v) => sceneStore.set({ pref: v })}
              stats={analysis.stats}
              stay={stay}
              strip={analysis.strip}
              hour={hour}
              onStay={(from, to) => sceneStore.set({ stay: [from, to], hour: Math.min(to, Math.max(from, hour)) })}
              onHour={peekHour}
              playing={playing}
              onPlay={() => sceneStore.set({ playing: !playing })}
              sunset={sunset ? { at: sunset, label: timeLabel(sunset) } : null}
              notes={analysis.notes}
              hours={barHours(event)}
            />
          ) : (
            <EverydaySheet
              banner={banner}
              snap={sheetSnap}
              onSnap={setSnap}
              onVisibleHeight={setSheetH}
              closure={closure ? { title: `${dateLabel(date)}은 ${closure.reason}로 출입이 제한돼요`, sub: `${dateLabel(closure.from)}부터 ${dateLabel(closure.to)}까지예요. 다른 날짜를 골라 보세요.` } : null}
              headline={analysis.verdict || analysis.headline}
              pref={pref}
              onPref={(v) => sceneStore.set({ pref: v })}
              hint={analysis.suggestion && !analysis.suggestion.at ? analysis.suggestion.text : null}
              duration={durationValue}
              onDuration={(h) => sceneStore.set({ stay: [stay[0], Math.min(DAY_HOURS[1], stay[0] + h)] })}
              stay={stay}
              strip={analysis.strip}
              hour={hour}
              onStay={(from, to) => sceneStore.set({ stay: [from, to], hour: Math.min(to, Math.max(from, hour)) })}
              onHour={peekHour}
              playing={playing}
              onPlay={() => sceneStore.set({ playing: !playing })}
              sunset={sunset ? { at: sunset, label: timeLabel(sunset) } : null}
              notes={analysis.notes}
            />
          )}
          {import.meta.env.DEV && <DevTools />}
        </>
      )}

      <PlacePicker
        open={pickerOpen}
        onClose={closePicker}
        venue={venue}
        onVenue={(v) => sceneStore.set({ venue: v, mat: null, zoneStart: null })}
        venuesReady={[...VENUES_READY]}
        date={date}
        today={TODAY}
        events={ready.events}
        closures={ready.closures}
        onApply={(d) => sceneStore.set({ date: d, pickerOpen: false, camera: 'orbit', zoneStart: null })}
      />
      <SourcesSheet
        open={sourcesOpen}
        onClose={closeSources}
        estimates={mode === 'event' ? analysis.estimates : []}
        satelliteTrees={ready.bundle.trees.some((t) => t.source !== 'scan')}
      />
      {operator && (
        <PlanShareSheet
          open={planShareOpen}
          onClose={closePlanShare}
          file={planShareOpen ? planFileOf(sceneStore.get(), venue, date) : EMPTY_FILE}
          placeLabel={`${place} ${monthDayLabel(date)}`}
          onImport={importPlan}
          onNotice={showNotice}
        />
      )}
      <ShareSheet open={share !== null} onClose={closeShare} url={share?.url ?? ''} message={share?.message ?? ''} onNotice={showNotice} />
      <AboutSheet open={aboutOpen} onClose={closeAbout} />
      <SettingsSheet
        open={settingsOpen}
        onClose={closeSettings}
        theme={theme}
        onTheme={(v) => sceneStore.set({ theme: v })}
        quality={quality}
        onQuality={(v) => sceneStore.set({ quality: v })}
        onAbout={() => sceneStore.set({ settingsOpen: false, aboutOpen: true })}
        operator={operator}
        onOperator={() =>
          sceneStore.set(
            operator
              ? { settingsOpen: false, operator: false, opTool: null, zoneStart: null }
              : { settingsOpen: false, operator: true, opTool: null, camera: 'orbit', seats: false, notice: null },
          )
        }
        onTour={
          operator
            ? () => {
                sceneStore.set({ settingsOpen: false })
                startOpTour(250)
              }
            : () => {
                sceneStore.set({ settingsOpen: false, camera: 'orbit' })
                setTouring(true)
              }
        }
        onSources={() => sceneStore.set({ settingsOpen: false, sourcesOpen: true })}
      />
      {touring && mode !== 'operator' && !firstPerson && !pickerOpen && !shareOpen && !settingsOpen && !sourcesOpen && !aboutOpen && <Tour steps={steps} onDone={endTour} />}
      {opTouring && mode === 'operator' && !pickerOpen && !planShareOpen && !settingsOpen && !sourcesOpen && !aboutOpen && <Tour steps={opSteps} onDone={endOpTour} />}
      <Toast message={notice} onDone={clearNotice} />
    </>
  )
}
