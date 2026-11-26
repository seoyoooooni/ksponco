import { useMemo } from 'react'
import type { VenueBundle } from '../data/load'
import type { EventItem, ForecastDay, Layout } from '../data/types'
import {
  indexHeads,
  prepareBlockers,
  scanGround,
  sunHours,
  sunPhrase,
  sunStrip,
  viewFrom,
  type HeadIndex,
  type SunState,
  type ViewResult,
} from '../lib/analysis'
import { buildCrowd, type Crowd } from '../lib/crowd'
import { hourLabel, parseClock, rangeLabel, shortDuration } from '../lib/format'
import { stripShade, type SunPref } from '../lib/comfort'
import { goodSeats, seatGrade, seatVerdict } from '../lib/goodSeats'
import { dayShade, directionName, scanBounds, shadeGrid, shadeSpots, type ShadeSpot } from '../lib/shadeGrid'
import { heightAt, sourceAt } from '../lib/terrainSample'
import { offLimits } from '../lib/offLimits'
import { HEAVY_RAIN_MM, morningSun, pondAt, WET_RAIN_MM, wetAt, type WetReason } from '../lib/engine'
import type { Note } from '../ui/Notes'
import type { OverlayCell } from '../scene/HeatOverlay'
import type { MatPosition } from '../store/sceneStore'
import type { AudienceStats } from '../features/audience/AudienceSheet'
import { POND_COLOR, SEAT_COLORS, SHADE_COLORS } from './Legend'

function pct(v: number): string {
  return `${Math.round(v * 100)}%`
}

type Input = {
  bundle: VenueBundle
  layout: Layout | null
  event: EventItem | null
  date: string
  stay: [number, number]
  mat: MatPosition | null
  anchor: MatPosition | null
  eyeHeight: number
  crowdScale: number
  seats: boolean
  pref: SunPref
  sunWeight: number
  weather: ForecastDay | null
}

export type Analysis = {
  crowd: Crowd | null
  view: ViewResult | null
  strip: SunState[]
  stats: AudienceStats | null
  headline: string
  estimates: string[]
  spots: (ShadeSpot & { name: string })[]
  overlay: OverlayCell[] | null
  ponds: OverlayCell[] | null
  lawnCenter: { x: number; z: number }
  notes: Note[]
}

const WET_OPTS = { sampleHeight: 0.5 }

function wetLine(reason: WetReason | null, mm: number, placed: boolean, pond: boolean): string {
  if (reason === 'heavy' && pond) return '물이 고여 있을 수 있는 곳이에요. 자리를 옮겨 보세요'
  if (reason === 'heavy' || mm >= HEAVY_RAIN_MM) return `전날 비가 ${mm}mm 와서 잔디 전체가 젖어 있을 수 있어요`
  if (!placed) return `전날 비가 ${mm}mm 왔어요. 바닥이 젖어 있을 수 있어요`
  if (reason === 'low') return '주변보다 낮은 곳이라 물이 고여 있을 수 있어요'
  if (reason === 'shade') return '오전 내내 그늘이라 바닥이 덜 말랐을 수 있어요'
  return `전날 비 ${mm}mm · 이 자리는 비교적 말랐을 거예요`
}

function shadeColor(f: number): string {
  const k = f >= 0.95 ? 4 : f >= 0.6 ? 3 : f >= 0.35 ? 2 : f >= 0.1 ? 1 : 0
  return SHADE_COLORS[k]
}

export function useAnalysis({ bundle, layout, event, date, stay, mat, anchor, eyeHeight, crowdScale, seats, pref, sunWeight, weather }: Input): Analysis {
  const { terrain, trees, buildings, venue } = bundle
  const [from, to] = stay
  const stage = layout ? (layout.stage ?? venue.fixedStage ?? null) : null

  const blockers = useMemo(() => prepareBlockers({ venue, terrain, trees, buildings }, layout), [venue, terrain, trees, buildings, layout])
  const area = useMemo(() => scanBounds(terrain), [terrain])
  const lawnCenter = useMemo(() => ({ x: (area.x0 + area.x1) / 2, z: (area.z0 + area.z1) / 2 }), [area])
  const crowd = useMemo(() => (layout ? buildCrowd(layout, terrain) : null), [layout, terrain])

  const heads = useMemo<HeadIndex>(
    () => (crowd ? indexHeads(crowd, terrain, crowdScale, mat ?? undefined) : new Map()),
    [crowd, terrain, crowdScale, mat],
  )

  const view = useMemo(() => {
    if (!layout || !mat) return null
    const eye: [number, number, number] = [mat.x, heightAt(terrain, mat.x, mat.z) + eyeHeight, mat.z]
    return viewFrom(eye, layout, stage, terrain, heads, blockers)
  }, [layout, mat, eyeHeight, stage, terrain, heads, blockers])

  const strip = useMemo(() => {
    if (!mat) return []
    return sunStrip(date, from, to, [mat.x, heightAt(terrain, mat.x, mat.z) + 0.5, mat.z], blockers)
  }, [mat, date, from, to, terrain, blockers])

  const rain = weather ? weather.rainPrevDay : 0
  const overcast = weather ? weather.rain || weather.sky === '흐림' : false
  const comfortWeight = overcast ? 0 : sunWeight
  const morning = useMemo(() => (rain >= WET_RAIN_MM ? morningSun(date) : []), [rain, date])
  const scan = useMemo(() => scanGround(terrain), [terrain])

  const wetHere = useMemo<WetReason | null>(() => {
    if (!mat || rain < WET_RAIN_MM) return null
    return wetAt(blockers, scan, mat.x, mat.z, rain, morning, WET_OPTS)
  }, [mat, rain, morning, blockers, scan])

  const pondHere = useMemo(() => Boolean(mat && rain >= HEAVY_RAIN_MM && pondAt(scan, mat.x, mat.z)), [mat, rain, scan])

  const ponds = useMemo<OverlayCell[] | null>(() => {
    if (rain < HEAVY_RAIN_MM) return null
    const out: OverlayCell[] = []
    for (let z = area.z0 + 1; z < area.z1; z += 2) {
      for (let x = area.x0 + 1; x < area.x1; x += 2) {
        if (sourceAt(terrain, x, z) !== 0 || offLimits(venue, x, z)) continue
        if (pondAt(scan, x, z)) out.push({ x, z, size: 2, color: POND_COLOR })
      }
    }
    return out.length ? out : null
  }, [rain, area, terrain, venue, scan])

  const needShade = !layout || seats
  const shade = useMemo(
    () => (needShade ? shadeGrid(terrain, blockers, date, from, to, area, 2) : null),
    [needShade, terrain, blockers, date, from, to, area],
  )

  const blocked = useMemo(() => {
    if (!shade) return []
    return shade.frac.map((_, k) => {
      const x = shade.x0 + ((k % shade.nx) + 0.5) * shade.cell
      const z = shade.z0 + (Math.floor(k / shade.nx) + 0.5) * shade.cell
      return offLimits(venue, x, z) !== null
    })
  }, [shade, venue])

  const wetCells = useMemo(() => {
    if (!shade || rain < WET_RAIN_MM) return null
    const heavy = rain >= HEAVY_RAIN_MM
    return shade.frac.map((_, k) => {
      const x = shade.x0 + ((k % shade.nx) + 0.5) * shade.cell
      const z = shade.z0 + (Math.floor(k / shade.nx) + 0.5) * shade.cell
      return heavy ? pondAt(scan, x, z) : wetAt(blockers, scan, x, z, rain, morning, WET_OPTS) !== null
    })
  }, [shade, rain, morning, blockers, scan])

  const spots = useMemo(() => {
    if (layout || !shade) return []
    const origin = anchor ?? lawnCenter
    const base = pref === 'shade' ? shade : { ...shade, frac: shade.frac.map((f) => 1 - (dayShade(shade, f) ?? 1)) }
    const want = { ...base, frac: base.frac.map((f, k) => (blocked[k] || wetCells?.[k] ? 0 : f)) }
    const suffix = pref === 'shade' ? '나무 그늘' : '양지'
    const picks = shadeSpots(want, origin).map((s) => ({ ...s, name: `${directionName(lawnCenter, s)} ${suffix}` }))
    const sides = ['서편', '가운데', '동편']
    for (const name of new Set(picks.map((s) => s.name))) {
      const same = picks.filter((s) => s.name === name).sort((a, b) => a.x - b.x)
      if (same.length < 2) continue
      same.forEach((s, i) => {
        s.name = `${name} · ${same.length === 2 ? sides[i * 2] : sides[i]}`
      })
    }
    return picks
  }, [layout, shade, anchor, lawnCenter, pref, blocked, wetCells])

  const overlay = useMemo<OverlayCell[] | null>(() => {
    if (!layout && shade) {
      const cells: OverlayCell[] = []
      shade.frac.forEach((f, k) => {
        const i = k % shade.nx
        const j = Math.floor(k / shade.nx)
        const x = shade.x0 + (i + 0.5) * shade.cell
        const z = shade.z0 + (j + 0.5) * shade.cell
        if (sourceAt(terrain, x, z) !== 0 || blocked[k]) return
        if (pref === 'shade' ? f < 0.6 : f >= 0.35) return
        cells.push({ x, z, size: shade.cell, color: shadeColor(f) })
      })
      return cells
    }
    if (layout && seats) {
      return goodSeats(layout, stage, terrain, heads, blockers, shade, comfortWeight, 2, pref)
        .filter((c) => !offLimits(venue, c.x, c.z))
        .map((c) => ({
          x: c.x,
          z: c.z,
          size: 2,
          color: SEAT_COLORS[seatGrade(c.score)],
        }))
    }
    return null
  }, [layout, seats, shade, stage, terrain, heads, blockers, comfortWeight, pref, blocked, venue])

  const stats = useMemo<AudienceStats | null>(() => {
    if (!mat) return null
    return {
      stage: view ? pct(view.stage) : '—',
      distance: view ? `${Math.round(view.stageDistance)}m` : '—',
      screen: view && view.screenIndex >= 0 ? pct(view.screen) : '—',
      sun: shortDuration(sunHours(strip)),
    }
  }, [mat, view, strip])

  const headline = !mat
    ? layout
      ? '피크닉존 잔디를 눌러 돗자리를 놓아 보세요'
      : '잔디를 눌러 돗자리를 놓아 보세요'
    : view
      ? seatVerdict(view.stage, overcast ? null : stripShade(strip), pref, comfortWeight)
      : sunPhrase(strip, from, hourLabel)


  const estimates = useMemo(() => {
    const out: string[] = []
    if (event?.timeSource === 'default') {
      out.push(`공연 시간이 정해지지 않아 ${rangeLabel(parseClock(event.start), parseClock(event.end))}로 계산했어요`)
    }
    if (layout?.source === 'default') out.push('공식 배치도가 없어 기본 배치로 계산했어요')
    return out
  }, [layout, event])

  const notes: Note[] = []
  if (weather?.rain) notes.push({ kind: 'rain', text: '비 예보가 있어요. 우산을 챙기세요' })
  else if (weather?.sky === '흐림') notes.push({ kind: 'cloud', text: '흐린 날이라 그늘과 볕 차이가 작아요' })
  else if (weather?.sky === '구름많음') notes.push({ kind: 'cloud', text: '구름이 많아 볕이 약할 수 있어요' })
  if (rain >= WET_RAIN_MM) notes.push({ kind: 'wet', text: wetLine(wetHere, rain, Boolean(mat), pondHere) })

  return { crowd, view, strip, stats, headline, estimates, spots, overlay, ponds, lawnCenter, notes }
}
