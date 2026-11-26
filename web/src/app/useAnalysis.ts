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
  STEP,
  type SunState,
  type ViewResult,
} from '../lib/analysis'
import { buildCrowd, type Crowd } from '../lib/crowd'
import { clockLabel, hourLabel, parseClock, shortDuration } from '../lib/format'
import { comfort, stripShade, type SunPref } from '../lib/comfort'
import { goodSeats, seatGrade, seatVerdict } from '../lib/goodSeats'
import { dayShade, directionName, scanBounds, shadeGrid, shadeSpots } from '../lib/shadeGrid'
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
  verdict: string
  suggestion: Suggestion | null
  overlay: OverlayCell[] | null
  ponds: OverlayCell[] | null
  lawnCenter: { x: number; z: number }
  notes: Note[]
}

export type Suggestion = {
  at: { x: number; z: number } | null
  text: string
}

const WET_OPTS = { sampleHeight: 0.5 }
const STEADY = 0.95
const MIN_MOVE = 4

function spotVerdict(strip: SunState[], from: number, pref: SunPref): { text: string; good: boolean } {
  const shadeShare = stripShade(strip)
  if (shadeShare === null) return { text: '해가 진 뒤라 그늘과 볕 차이가 없어요', good: true }
  const span = strip[strip.length - 1] === 0 ? '해 질 때까지' : '계속'
  if (comfort(shadeShare, pref) >= STEADY) return { text: pref === 'shade' ? `지금 자리는 ${span} 그늘이에요` : `지금 자리는 ${span} 볕이 들어요`, good: true }
  const unwanted = pref === 'shade' ? 2 : 1
  const wanted = pref === 'shade' ? 1 : 2
  const at = (k: number) => clockLabel(from + k * STEP)
  const i = strip.findIndex((v) => v === unwanted)
  if (i > 0) return { text: `${at(i)}부터 ${pref === 'shade' ? '볕이 들어요' : '그늘이 져요'}`, good: false }
  let k = strip.length
  while (k > 0 && strip[k - 1] !== unwanted) k--
  if (k < strip.length && strip[k] === wanted) return { text: pref === 'shade' ? `${at(k)}까지 볕이 들고, 그 뒤엔 그늘이에요` : `${at(k)}까지 그늘이고, 그 뒤엔 볕이 들어요`, good: false }
  const sunH = sunHours(strip)
  if (pref === 'sun' && sunH === 0) return { text: '지금 자리는 볕이 안 들어요', good: false }
  const sun = sunH < 1 ? `${Math.round(sunH * 60)}분` : shortDuration(sunH)
  return { text: pref === 'shade' ? `머무는 동안 햇볕이 ${sun} 들어요` : `머무는 동안 볕이 ${sun}만 들어요`, good: false }
}

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

export function useAnalysis({ bundle, layout, event, date, stay, mat, eyeHeight, crowdScale, seats, pref, sunWeight, weather }: Input): Analysis {
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

  const everyday = useMemo(() => {
    if (layout || !mat) return { verdict: '', suggestion: null as Suggestion | null }
    const here = spotVerdict(strip, from, pref)
    if (here.good || !shade) return { verdict: here.text, suggestion: null }
    const base = {
      ...shade,
      frac: shade.frac.map((f) => {
        const day = dayShade(shade, f)
        return day === null ? 0 : pref === 'shade' ? day : 1 - day
      }),
    }
    const want = {
      ...base,
      frac: base.frac.map((f, k) => {
        if (blocked[k] || wetCells?.[k]) return 0
        const x = shade.x0 + ((k % shade.nx) + 0.5) * shade.cell
        const z = shade.z0 + (Math.floor(k / shade.nx) + 0.5) * shade.cell
        return Math.hypot(x - mat.x, z - mat.z) < MIN_MOVE ? 0 : f
      }),
    }
    const pick = shadeSpots(want, mat, 1)[0]
    const kind = pref === 'shade' ? '계속 그늘인' : '계속 볕 드는'
    if (!pick) return { verdict: here.text, suggestion: { at: null, text: `근처에 ${kind} 자리가 없어요` } }
    return { verdict: here.text, suggestion: { at: { x: pick.x, z: pick.z }, text: `${directionName(mat, pick)} ${Math.round(pick.distance)}m에 ${kind} 자리가 있어요` } }
  }, [layout, mat, strip, from, pref, shade, blocked, wetCells])

  const overlay = useMemo<OverlayCell[] | null>(() => {
    if (!layout && shade) {
      const cells: OverlayCell[] = []
      shade.frac.forEach((f, k) => {
        const i = k % shade.nx
        const j = Math.floor(k / shade.nx)
        const x = shade.x0 + (i + 0.5) * shade.cell
        const z = shade.z0 + (j + 0.5) * shade.cell
        if (sourceAt(terrain, x, z) !== 0 || blocked[k]) return
        const day = dayShade(shade, f)
        if (day === null || (pref === 'shade' ? day < 0.6 : day >= 0.35)) return
        cells.push({ x, z, size: shade.cell, color: shadeColor(day) })
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
      out.push(`끝나는 시간이 공개되지 않아 ${clockLabel(parseClock(event.end))}에 끝난다고 보고 계산했어요`)
    }
    if (layout?.source === 'default') out.push('공식 배치도가 없어 기본 배치로 계산했어요')
    return out
  }, [layout, event])

  const notes: Note[] = []
  if (weather?.rain) notes.push({ kind: 'rain', text: '비 예보가 있어요. 우산을 챙기세요' })
  else if (weather?.sky === '흐림') notes.push({ kind: 'cloud', text: '흐린 날이라 그늘과 볕 차이가 작아요' })
  else if (weather?.sky === '구름많음') notes.push({ kind: 'cloud', text: '구름이 많아 볕이 약할 수 있어요' })
  if (rain >= WET_RAIN_MM) notes.push({ kind: 'wet', text: wetLine(wetHere, rain, Boolean(mat), pondHere) })

  return { crowd, view, strip, stats, headline, estimates, verdict: everyday.verdict, suggestion: everyday.suggestion, overlay, ponds, lawnCenter, notes }
}
