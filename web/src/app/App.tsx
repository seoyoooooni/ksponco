import { useCallback, useEffect, useMemo } from 'react'
import { loadClosures, loadEvents, loadLayout, loadVenueBundle } from '../data/load'
import { useLoad } from '../data/useLoad'
import type { Closure, EventItem, Layout } from '../data/types'
import type { VenueBundle } from '../data/load'
import { AudienceSheet } from '../features/audience/AudienceSheet'
import { FirstPersonOverlay } from '../features/audience/FirstPersonOverlay'
import { EverydaySheet } from '../features/everyday/EverydaySheet'
import { PlacePicker } from '../features/picker/PlacePicker'
import { dateLabel, durationLabel, hourLabel, parseClock, timeLabel } from '../lib/format'
import { zoneAt } from '../lib/polygon'
import { sunsetHour } from '../lib/sun'
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

const VENUES_READY = ['lawn88'] as const

function defaultEverydayStay(date: string, hours: number): [number, number] {
  if (date === TODAY) {
    const now = new Date()
    const h = now.getHours() + now.getMinutes() / 60
    if (h >= 9 && h <= 20) {
      const from = Math.ceil(h * 4) / 4
      return [from, Math.min(22, from + hours)]
    }
  }
  return [14, 14 + hours]
}

function defaultMat(layout: Layout | null, center: { x: number; z: number }) {
  if (!layout) return { x: center.x + 6, z: center.z + 6 }
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
}

export function App() {
  usePlayback()
  const venue = useScene((s) => s.venue)
  const base = useLoad<Base>(async () => {
    const [bundle, events, closures] = await Promise.all([loadVenueBundle(venue), loadEvents(), loadClosures()])
    return { bundle, events, closures }
  }, [venue])

  if (base.status !== 'ready') {
    return <p style={{ padding: 'var(--space-5)' }}>{base.status === 'error' ? base.error.message : '3D 장면을 불러오는 중…'}</p>
  }
  return <Main ready={base.data} />
}

function Main({ ready }: { ready: Base }) {
  const venue = useScene((s) => s.venue)
  const date = useScene((s) => s.date)
  const hour = useScene((s) => s.hour)
  const stay = useScene((s) => s.stay)
  const mat = useScene((s) => s.mat)
  const matTouched = useScene((s) => s.matTouched)
  const eyeHeight = useScene((s) => s.eyeHeight)
  const camera = useScene((s) => s.camera)
  const notice = useScene((s) => s.notice)
  const crowdScale = useScene((s) => s.crowdScale)
  const sheetSnap = useScene((s) => s.sheetSnap)
  const pickerOpen = useScene((s) => s.pickerOpen)
  const sourcesOpen = useScene((s) => s.sourcesOpen)
  const seats = useScene((s) => s.seats)
  const playing = useScene((s) => s.playing)

  const event = useMemo(
    () => ready.events.find((e) => e.venue === venue && e.date === date) ?? null,
    [ready, venue, date],
  )
  const closure = useMemo<Closure | null>(
    () => (event ? null : (ready.closures.find((c) => c.venue === venue && c.from <= date && date <= c.to) ?? null)),
    [ready, event, venue, date],
  )

  const layoutState = useLoad(
    async () => (event ? loadLayout(ready.bundle.venue, event.layout) : null),
    [ready, event?.id],
  )
  const layout = layoutState.status === 'ready' ? layoutState.data : null
  const layoutReady = layoutState.status === 'ready'

  useEffect(() => {
    if (event) {
      const from = Math.max(9, parseClock(event.start))
      const to = Math.min(22, parseClock(event.end))
      sceneStore.set({ stay: [from, to], hour: Math.min(to, from + 2.5), seats: false, sheetSnap: 1 })
    } else {
      const s = defaultEverydayStay(date, 2)
      sceneStore.set({ stay: s, hour: s[0], seats: false, sheetSnap: 1 })
    }
  }, [event?.id, date])

  const analysis = useAnalysis({ bundle: ready.bundle, layout, event, date, stay, mat, eyeHeight, crowdScale, seats })

  useEffect(() => {
    if (!layoutReady) return
    const current = sceneStore.get().mat
    const valid = current && (layout ? zoneAt(layout.zones, current.x, current.z)?.type === 'picnic' : true)
    if (!valid) sceneStore.set({ mat: defaultMat(layout, analysis.lawnCenter), matTouched: false, camera: 'orbit' })
  }, [layoutReady, layout, analysis.lawnCenter])

  useEffect(() => {
    document.documentElement.dataset.view = camera === 'firstPerson' ? 'fp' : 'main'
  }, [camera])

  const clearNotice = useCallback(() => sceneStore.set({ notice: null }), [])
  const setSnap = useCallback((v: SheetSnap) => sceneStore.set({ sheetSnap: v }), [])
  const setSheetH = useCallback((h: number) => sceneStore.set({ sheetH: h }), [])
  const closePicker = useCallback(() => sceneStore.set({ pickerOpen: false }), [])
  const closeSources = useCallback(() => sceneStore.set({ sourcesOpen: false }), [])

  const mode = event ? 'event' : 'everyday'
  const firstPerson = camera === 'firstPerson'
  const sunset = sunsetHour(date)
  const duration = stay[1] - stay[0]
  const durationValue = [1, 2, 3].includes(duration) ? duration : ('custom' as const)

  const fpLines: [string, string?] = analysis.view
    ? [
        analysis.view.stage >= 0.95
          ? '무대가 다 보여요.'
          : analysis.view.stage >= 0.6
            ? '무대가 대부분 보여요.'
            : `무대가 ${Math.round(analysis.view.stage * 100)}%만 보여요.`,
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
        markers={mode === 'everyday' && !closure ? analysis.spots.map((s, i) => ({ x: s.x, z: s.z, label: String(i + 1) })) : undefined}
      />

      {firstPerson ? (
        <FirstPersonOverlay
          lines={fpLines}
          stats={analysis.stats}
          hour={hour}
          range={stay}
          onHour={(h) => sceneStore.set({ hour: h })}
          eyeHeight={eyeHeight}
          onEye={(h) => sceneStore.set({ eyeHeight: h })}
          onBack={() => sceneStore.set({ camera: 'orbit' })}
        />
      ) : (
        <>
          <header className="topbar">
            <span className="brand">app name</span>
            <SearchBar
              place={ready.bundle.venue.name}
              date={dateLabel(date)}
              onOpen={() => sceneStore.set({ pickerOpen: true })}
            />
          </header>
          {mode === 'everyday' && !closure && <Legend kind="shade" />}
          {mode === 'event' && seats && <Legend kind="seats" />}
          {!closure && (
            <FloatingActions
              showSeats={mode === 'event'}
              seats={seats}
              onSeats={() => sceneStore.set({ seats: !seats })}
              playing={playing}
              onPlay={() => sceneStore.set({ playing: !playing })}
            />
          )}
          {mode === 'event' ? (
            <AudienceSheet
              snap={sheetSnap}
              onSnap={setSnap}
              onVisibleHeight={setSheetH}
              headline={analysis.headline}
              notes={analysis.estimates}
              stats={analysis.stats}
              stay={stay}
              strip={analysis.strip}
              hour={hour}
              onStay={(from, to) => sceneStore.set({ stay: [from, to], hour: Math.min(to, Math.max(from, hour)) })}
              onHour={(h) => sceneStore.set({ hour: h })}
              eyeHeight={eyeHeight}
              onEye={(h) => sceneStore.set({ eyeHeight: h })}
              canFirstPerson={Boolean(mat)}
              onFirstPerson={() => sceneStore.set({ camera: 'firstPerson' })}
              onSources={() => sceneStore.set({ sourcesOpen: true })}
            />
          ) : (
            <EverydaySheet
              snap={sheetSnap}
              onSnap={setSnap}
              onVisibleHeight={setSheetH}
              closure={closure ? { title: `${dateLabel(date)}은 ${closure.reason}로 출입이 제한돼요`, sub: `${dateLabel(closure.from)}부터 ${dateLabel(closure.to)}까지예요. 다른 날짜를 골라 보세요.` } : null}
              headline={`${date === TODAY && stay[0] === defaultEverydayStay(date, duration)[0] ? '지금부터' : `${hourLabel(stay[0])}부터`} ${durationLabel(duration)}\n그늘이 이어지는 곳`}
              spots={analysis.spots.map((s) => ({ name: s.name, meta: `${mat ? '내 돗자리에서' : '잔디 가운데서'} ${Math.round(s.distance)}m` }))}
              onSpot={(i) => {
                const s = analysis.spots[i]
                if (s) sceneStore.set({ mat: { x: s.x, z: s.z }, matTouched: true })
              }}
              sunsetText={sunset ? `해 지는 시각 ${timeLabel(sunset)} · 노을은 ${hourLabel(Math.floor((sunset - 0.5) * 4) / 4)}쯤부터` : '해 지는 시각을 계산하지 못했어요'}
              duration={durationValue}
              onDuration={(h) => sceneStore.set({ stay: [stay[0], Math.min(22, stay[0] + h)] })}
              stay={stay}
              strip={analysis.strip}
              hour={hour}
              myMatText={mat ? `내 돗자리: ${analysis.headline}` : null}
              onStay={(from, to) => sceneStore.set({ stay: [from, to], hour: Math.min(to, Math.max(from, hour)) })}
              onHour={(h) => sceneStore.set({ hour: h })}
              onSources={() => sceneStore.set({ sourcesOpen: true })}
            />
          )}
          {import.meta.env.DEV && <DevTools />}
        </>
      )}

      <PlacePicker
        open={pickerOpen}
        onClose={closePicker}
        venue={venue}
        onVenue={(v) => sceneStore.set({ venue: v, mat: null })}
        venuesReady={[...VENUES_READY]}
        date={date}
        today={TODAY}
        events={ready.events}
        closures={ready.closures}
        onApply={(d) => sceneStore.set({ date: d, pickerOpen: false, camera: 'orbit' })}
        onOperator={() => sceneStore.set({ pickerOpen: false, notice: '운영자 모드는 준비 중이에요' })}
      />
      <SourcesSheet
        open={sourcesOpen}
        onClose={closeSources}
        layoutSource={layout?.source ?? null}
        satelliteTrees={ready.bundle.trees.some((t) => t.source !== 'scan')}
      />
      <Toast message={notice} onDone={clearNotice} />
    </>
  )
}
