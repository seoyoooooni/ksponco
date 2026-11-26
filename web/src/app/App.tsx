import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { loadClosures, loadEvents, loadForecast, loadLayout, loadVenueBundle } from '../data/load'
import { useLoad } from '../data/useLoad'
import type { Closure, EventItem, Forecast, Layout } from '../data/types'
import type { VenueBundle } from '../data/load'
import { AudienceSheet } from '../features/audience/AudienceSheet'
import { FirstPersonOverlay } from '../features/audience/FirstPersonOverlay'
import { EverydaySheet } from '../features/everyday/EverydaySheet'
import { PlacePicker } from '../features/picker/PlacePicker'
import { chipDateLabel, dateLabel, parseClock, rangeLabel, timeLabel } from '../lib/format'
import { autoPref, dayTempMax, prefWeight } from '../lib/comfort'
import { zoneAt } from '../lib/polygon'
import { offLimits } from '../lib/offLimits'
import { sourceAt } from '../lib/terrainSample'
import { planKey, rectPoly, withClosed, type ClosedArea, type Tent, type Wet } from '../lib/operator'
import { OperatorSheet } from '../features/operator/OperatorSheet'
import { OperatorTools } from '../features/operator/OperatorTools'
import { useOperator } from '../features/operator/useOperator'
import { PillButton } from '../ui/Buttons'
import { CloseIcon, PlayIcon, StarIcon } from '../ui/icons'
import { sunsetHour } from '../lib/sun'
import { WET_RAIN_MM } from '../lib/engine'
import { SceneCanvas } from '../scene/SceneCanvas'
import { sceneStore, TODAY, useScene } from '../store/sceneStore'
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
    if (event) {
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

  const pickOperator = (x: number, z: number) => {
    const s = sceneStore.get()
    if (s.opTool === 'tent') {
      sceneStore.set({ tents: [...s.tents, { id: s.nextId, plan, x, z }], nextId: s.nextId + 1 })
    } else if (s.opTool === 'zone') {
      if (!s.zoneStart) sceneStore.set({ zoneStart: [x, z], notice: '반대쪽 꼭짓점을 눌러 주세요' })
      else {
        sceneStore.set({ closed: [...s.closed, { id: s.nextId, plan, poly: rectPoly(s.zoneStart, [x, z]) }], nextId: s.nextId + 1, zoneStart: null, notice: null })
      }
    } else if (s.opTool === 'palm') {
      if (!s.zoneStart) sceneStore.set({ zoneStart: [x, z], notice: '반대쪽 꼭짓점을 눌러 주세요' })
      else {
        sceneStore.set({ palms: [...s.palms, { id: s.nextId, plan, poly: rectPoly(s.zoneStart, [x, z]) }], nextId: s.nextId + 1, zoneStart: null, notice: null })
      }
    } else if (s.opTool === 'erase') {
      const inArea = (c: ClosedArea) => c.plan === plan && zoneAt([{ type: 'closed', poly: c.poly }], x, z)
      const tent = s.tents.find((t) => t.plan === plan && Math.hypot(t.x - x, t.z - z) < 4)
      const palm = s.palms.find(inArea)
      const area = s.closed.find(inArea)
      if (tent) sceneStore.set({ tents: s.tents.filter((t) => t !== tent) })
      else if (palm) sceneStore.set({ palms: s.palms.filter((c) => c !== palm) })
      else if (area) sceneStore.set({ closed: s.closed.filter((c) => c !== area) })
    } else {
      sceneStore.set({ notice: '왼쪽 도구를 먼저 골라 주세요' })
    }
  }

  const TOOL_HINT = { tent: '잔디를 눌러 그늘막을 놓으세요', zone: '출입 금지 구역의 한쪽 꼭짓점을 눌러 주세요', palm: '야자매트를 깔 곳의 한쪽 꼭짓점을 눌러 주세요', erase: '지울 그늘막·구역·매트를 눌러 주세요' } as const
  const copyAtoB = () => {
    const s = sceneStore.get()
    let id = s.nextId
    const tentsB: Tent[] = s.tents.filter((t) => t.plan === planA).map((t) => ({ ...t, id: id++, plan: planB }))
    const closedB = s.closed.filter((c) => c.plan === planA).map((c) => ({ ...c, id: id++, plan: planB }))
    const palmsB = s.palms.filter((c) => c.plan === planA).map((c) => ({ ...c, id: id++, plan: planB }))
    sceneStore.set({ tents: [...s.tents, ...tentsB], closed: [...s.closed, ...closedB], palms: [...s.palms, ...palmsB], nextId: id })
  }
  const firstPerson = camera === 'firstPerson'
  const suggestedAt = mode === 'everyday' && !closure ? (analysis.suggestion?.at ?? null) : null
  const takeSuggestion = () => {
    if (suggestedAt) sceneStore.set({ mat: { x: suggestedAt.x, z: suggestedAt.z }, matTouched: true })
  }
  const credit = (
    <button type="button" className="sheet-credit" onClick={() => sceneStore.set({ sourcesOpen: true })}>
      데이터 출처
    </button>
  )
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
        overlayOverride={operator && opResult && opResult.wetCells.length ? opResult.wetCells.map((c) => ({ ...c, size: 4, color: '#7fa6c6' })) : undefined}
        ponds={mode !== 'operator' && !closure ? analysis.ponds : null}
        operator={operator ? { tents, palms, suggestion: opResult?.suggestion ?? null, zoneStart, onPick: compare ? () => sceneStore.set({ notice: 'A안이나 B안을 골라야 고칠 수 있어요' }) : pickOperator, onTent: opTool === 'erase' ? (id) => sceneStore.set({ tents: sceneStore.get().tents.filter((t) => t.id !== id) }) : undefined } : undefined}
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
              <span className="sr-only">app name</span>
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
          {operator && !compare && (
            <OperatorTools
              tool={opTool}
              wet={wet !== null}
              onTool={(t) => sceneStore.set({ opTool: t, zoneStart: null, notice: t ? TOOL_HINT[t] : null })}
            />
          )}
          {mode === 'event' && seats && <Legend kind="seats" ponds={Boolean(analysis.ponds)} />}
          {mode !== 'operator' && !closure && !(mode === 'event' && seats) && analysis.ponds && <Legend kind="ponds" />}
          {playing && (
            <div className="play-clock" aria-hidden="true">
              <PlayIcon size={12} />
              {timeLabel(Math.round(hour * 6) / 6)}
            </div>
          )}
          {mode === 'event' && <FloatingActions seats={seats} onSeats={() => sceneStore.set({ seats: !seats })} />}
          {suggestedAt && analysis.suggestion && (
            <div className="fabs">
              <button type="button" className="fab-star" aria-label={`추천 자리로 옮기기, ${analysis.suggestion.text}`} title="추천 자리로 옮기기" onClick={takeSuggestion}>
                <StarIcon size={26} />
              </button>
            </div>
          )}
          <button type="button" className="map-credit" onClick={() => sceneStore.set({ sourcesOpen: true })}>
            데이터 출처
          </button>
          {mode === 'operator' ? (
            <OperatorSheet
              onVisibleHeight={setSheetH}
              footer={credit}
              view={compare ? 'compare' : variant}
              onView={(v) => sceneStore.set(v === 'compare' ? { compare: true, opTool: null, zoneStart: null } : { compare: false, variant: v, zoneStart: null })}
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
              canCopy={variant === 'B' && countsOf(planB).tents + countsOf(planB).zones + countsOf(planB).palms === 0 && countsOf(planA).tents + countsOf(planA).zones + countsOf(planA).palms > 0}
              onCopy={copyAtoB}
              onSuggest={() => {
                const s = sceneStore.get()
                if (opResult?.suggestion) sceneStore.set({ tents: [...s.tents, { id: s.nextId, plan, ...opResult.suggestion }], nextId: s.nextId + 1 })
              }}
            />
          ) : mode === 'event' ? (
            <AudienceSheet
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
              canFirstPerson={Boolean(mat)}
              onFirstPerson={() => sceneStore.set({ camera: 'firstPerson' })}
              playing={playing}
              onPlay={() => sceneStore.set({ playing: !playing })}
              sunset={sunset ? { at: sunset, label: timeLabel(sunset) } : null}
              notes={analysis.notes}
              hours={barHours(event)}
              footer={credit}
            />
          ) : (
            <EverydaySheet
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
              canFirstPerson={Boolean(mat)}
              onFirstPerson={() => sceneStore.set({ camera: 'firstPerson' })}
              onStay={(from, to) => sceneStore.set({ stay: [from, to], hour: Math.min(to, Math.max(from, hour)) })}
              onHour={peekHour}
              playing={playing}
              onPlay={() => sceneStore.set({ playing: !playing })}
              sunset={sunset ? { at: sunset, label: timeLabel(sunset) } : null}
              notes={analysis.notes}
              footer={credit}
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
        onOperator={() => sceneStore.set({ pickerOpen: false, operator: true, opTool: null, camera: 'orbit', seats: false, notice: null })}
      />
      <SourcesSheet
        open={sourcesOpen}
        onClose={closeSources}
        estimates={mode === 'event' ? analysis.estimates : []}
        satelliteTrees={ready.bundle.trees.some((t) => t.source !== 'scan')}
      />
      <Toast message={notice} onDone={clearNotice} />
    </>
  )
}
