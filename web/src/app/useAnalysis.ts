import { useMemo } from 'react'
import type { VenueBundle } from '../data/load'
import type { EventItem, Layout } from '../data/types'
import {
  indexHeads,
  prepareCanopies,
  sightPhrase,
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
import { comfort, stripShade, type SunPref } from '../lib/comfort'
import { goodSeats, seatGrade, seatVerdict } from '../lib/goodSeats'
import { dayShade, directionName, scanBounds, shadeGrid, shadeSpots, type ShadeGrid, type ShadeSpot } from '../lib/shadeGrid'
import { heightAt, sourceAt } from '../lib/terrainSample'
import type { OverlayCell } from '../scene/HeatOverlay'
import type { MatPosition } from '../store/sceneStore'
import type { AudienceStats } from '../features/audience/AudienceSheet'
import { SEAT_COLORS, SHADE_COLORS } from './Legend'

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
}

export type Analysis = {
  crowd: Crowd | null
  view: ViewResult | null
  strip: SunState[]
  stats: AudienceStats | null
  headline: string
  detail: string
  estimates: string[]
  shade: ShadeGrid | null
  spots: (ShadeSpot & { name: string })[]
  overlay: OverlayCell[] | null
  lawnCenter: { x: number; z: number }
}

function shadeColor(f: number): string {
  const k = f >= 0.95 ? 4 : f >= 0.6 ? 3 : f >= 0.35 ? 2 : f >= 0.1 ? 1 : 0
  return SHADE_COLORS[k]
}

export function useAnalysis({ bundle, layout, event, date, stay, mat, eyeHeight, crowdScale, seats, pref, sunWeight }: Input): Analysis {
  const { terrain, trees, venue } = bundle
  const [from, to] = stay
  const stage = layout ? (layout.stage ?? venue.fixedStage ?? null) : null

  const canopies = useMemo(() => prepareCanopies(trees, terrain), [trees, terrain])
  const area = useMemo(() => scanBounds(terrain), [terrain])
  const lawnCenter = useMemo(() => ({ x: (area.x0 + area.x1) / 2, z: (area.z0 + area.z1) / 2 }), [area])
  const crowd = useMemo(() => (layout ? buildCrowd(layout) : null), [layout])

  const heads = useMemo<HeadIndex>(
    () => (crowd ? indexHeads(crowd, terrain, crowdScale, mat ?? undefined) : new Map()),
    [crowd, terrain, crowdScale, mat],
  )

  const view = useMemo(() => {
    if (!layout || !mat) return null
    const eye: [number, number, number] = [mat.x, heightAt(terrain, mat.x, mat.z) + eyeHeight, mat.z]
    return viewFrom(eye, layout, stage, terrain, heads, canopies)
  }, [layout, mat, eyeHeight, stage, terrain, heads, canopies])

  const strip = useMemo(() => {
    if (!mat) return []
    return sunStrip(date, from, to, [mat.x, heightAt(terrain, mat.x, mat.z) + 0.5, mat.z], canopies)
  }, [mat, date, from, to, terrain, canopies])

  const needShade = !layout || seats
  const shade = useMemo(
    () => (needShade ? shadeGrid(terrain, canopies, date, from, to, area, 2) : null),
    [needShade, terrain, canopies, date, from, to, area],
  )

  const spots = useMemo(() => {
    if (layout || !shade) return []
    const origin = mat ?? lawnCenter
    const want = pref === 'shade' ? shade : { ...shade, frac: shade.frac.map((f) => 1 - (dayShade(shade, f) ?? 1)) }
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
  }, [layout, shade, mat, lawnCenter, pref])

  const overlay = useMemo<OverlayCell[] | null>(() => {
    if (!layout && shade) {
      const cells: OverlayCell[] = []
      shade.frac.forEach((f, k) => {
        const i = k % shade.nx
        const j = Math.floor(k / shade.nx)
        const x = shade.x0 + (i + 0.5) * shade.cell
        const z = shade.z0 + (j + 0.5) * shade.cell
        if (sourceAt(terrain, x, z) !== 0) return
        cells.push({ x, z, size: shade.cell, color: shadeColor(f) })
      })
      return cells
    }
    if (layout && seats) {
      return goodSeats(layout, stage, terrain, heads, canopies, shade, sunWeight, 2, pref).map((c) => ({
        x: c.x,
        z: c.z,
        size: 2,
        color: SEAT_COLORS[seatGrade(c.score)],
      }))
    }
    return null
  }, [layout, seats, shade, stage, terrain, heads, canopies, sunWeight, pref])

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
      ? seatVerdict(view.stage, comfort(stripShade(strip), pref), sunWeight)
      : sunPhrase(strip, from, hourLabel)

  const detail = mat && view ? `${sightPhrase(view)} · ${sunPhrase(strip, from, hourLabel)}` : ''

  const estimates = useMemo(() => {
    const out: string[] = []
    if (event?.timeSource === 'default') {
      out.push(`공연 시간이 정해지지 않아 ${rangeLabel(parseClock(event.start), parseClock(event.end))}로 계산했어요`)
    }
    if (layout?.source === 'default') out.push('공식 배치도가 없어 기본 배치로 계산했어요')
    return out
  }, [layout, event])

  return { crowd, view, strip, stats, headline, detail, estimates, shade, spots, overlay, lawnCenter }
}
