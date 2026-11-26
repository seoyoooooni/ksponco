// events_manual.json + KOPIS + 연계 스냅샷 → events.json 내용. 저장은 run.ts가 검사 후에 한다.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EventItem, VenueId } from '../../web/src/data/types.ts'
import { isDate } from '../check/check.ts'
import { addDays } from '../collect/kma.ts'
import { fetchShows, FIRST_MONTH, PLACES, type KopisShow } from '../collect/kopis.ts'
import type { LinkedSnapshot } from '../collect/linked.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MANUAL = join(ROOT, 'pipeline', 'manual', 'events_manual.json')
const EXCLUDE = join(ROOT, 'pipeline', 'manual', 'kopis_exclude.json')
const SNAPSHOT = join(ROOT, 'pipeline', 'snapshot', 'linked_2025.json')
const DATA = join(ROOT, 'web', 'public', 'data')

export const DEFAULT_TIME = { start: '12:00', end: '21:00' }

// linkedName: 연계 데이터 공연명 원문. 이 이름만 있는 행(다른 공연과 겹치지 않은 행)에서 관객 수를 쓴다.
// note: 검증 메모. events.json에는 나가지 않는다.
// timeSource: 자동 수집분만 씀. 없으면 start·end가 모두 있을 때 manual, 아니면 default.
export type ManualEvent = {
  id: string
  name: string
  venue: VenueId
  date: string
  start?: string
  end?: string
  timeSource?: 'api' | 'default'
  people?: number
  sourceUrl: string
  linkedName?: string
  note?: string
}

// 잘못 잡힌 KOPIS 공연을 빼는 목록(pipeline/manual/kopis_exclude.json)
export type ExcludeItem = { id: string; reason: string }

const SHOW_VIEW = 'https://kopis.or.kr/por/db/pblprfr/pblprfrView.do?menuId=MNU_00020&mt20Id='
const MAX_SPAN_DAYS = 31 // 이보다 긴 기간은 공연이 아니라 전시·상설 공연으로 보고 건너뜀
const FIRST_DAY = `${FIRST_MONTH}-01` // 이전 날짜는 manual만 쓴다
const DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'] // getUTCDay 순서

// "화요일 ~ 금요일(20:00), 토요일(16:00,19:00)" → 요일별 첫·마지막 회차 시각. 모르는 표기(HOL 등)와 잘못된 시각은 건너뛴다.
export function startTimes(guidance: string): Map<number, { first: string; last: string }> {
  const out = new Map<number, { first: string; last: string }>()
  for (const [, a, b, inside] of guidance.matchAll(/([가-힣A-Z]+)\s*(?:~\s*([가-힣A-Z]+)\s*)?\(([^)]*)\)/g)) {
    const from = DAYS.indexOf(a), to = DAYS.indexOf(b ?? a)
    const times = [...inside.matchAll(/(\d{1,2}):([0-5]\d)/g)]
      .filter(([, h]) => Number(h) <= 23)
      .map(([, h, m]) => `${h.padStart(2, '0')}:${m}`)
      .sort()
    if (from < 0 || to < 0 || !times.length) continue
    for (let d = from; ; d = (d + 1) % 7) {
      if (!out.has(d)) out.set(d, { first: times[0], last: times.at(-1)! })
      if (d === to) break
    }
  }
  return out
}

// "8시간 30분" → 510, 알 수 없으면 null
export function runtimeMinutes(runtime: string): number | null {
  const h = runtime.match(/(\d+)\s*시간/), m = runtime.match(/(\d+)\s*분/)
  const total = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0)
  return total > 0 ? total : null
}

function addMinutes(clock: string, min: number): string {
  const t = Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3)) + min
  return t >= 1440 ? '24:00' : `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

// 시작은 그 요일 첫 회차. 종료는 마지막 회차+런타임이면 api, 런타임이 없으면 기본 종료 시각으로 추정(default).
// 공연시간을 읽었는데 그 요일이 없으면 공연 없는 날(null). 아예 못 읽었으면 시각을 비운다(기본 시각).
function timeOf(show: KopisShow, date: string): Pick<ManualEvent, 'start' | 'end' | 'timeSource'> | null {
  const times = startTimes(show.guidance)
  if (!times.size) return {}
  const t = times.get(new Date(`${date}T00:00:00Z`).getUTCDay())
  if (!t) return null
  const run = runtimeMinutes(show.runtime)
  if (run) return { start: t.first, end: addMinutes(t.last, run), timeSource: 'api' }
  return { start: t.first, end: t.last < DEFAULT_TIME.end ? DEFAULT_TIME.end : '24:00', timeSource: 'default' }
}

const spanMs = (s: KopisShow) => Date.parse(s.to) - Date.parse(s.from)

// 공연장 코드 → 무대. 일대 코드는 페스티벌일 때만 인정한다.
function venuesOf(show: KopisShow): VenueId[] {
  const set = new Set<VenueId>()
  for (const code of show.places) {
    const p = PLACES[code]
    if (p && (!p.festivalOnly || show.festival)) p.venues.forEach((v) => set.add(v))
  }
  return (['lawn88', 'lake'] as const).filter((v) => set.has(v))
}

// KOPIS 공연 → manual 형식. 기간은 하루씩, 무대마다 펼친다.
// 기간이 짧은 순(같으면 id 순)으로 내보내 mergeEvents에서 긴 행사가 공연을 가리지 않게 한다.
export function kopisToManual(shows: KopisShow[], exclude: ExcludeItem[] = []): ManualEvent[] {
  const reasons = new Map(exclude.map((e) => [e.id, e.reason]))
  const out: ManualEvent[] = []
  let kept = 0, badDates = 0
  for (const s of [...shows].sort((a, b) => spanMs(a) - spanMs(b) || a.id.localeCompare(b.id))) {
    if (reasons.has(s.id)) {
      console.warn(`[events] 제외: ${s.id} ${s.name} (${reasons.get(s.id)})`)
      continue
    }
    const venues = venuesOf(s)
    if (!venues.length) {
      console.warn(`[events] 제외: ${s.id} ${s.name} (일대 공연인데 페스티벌이 아님)`)
      continue
    }
    kept++
    const bad = !isDate(s.from) || !isDate(s.to) || s.from > s.to
    if (bad || s.to > addDays(s.from, MAX_SPAN_DAYS - 1)) {
      if (bad) badDates++
      console.warn(`[events] 건너뜀: ${s.id} ${s.name} (${s.from} ~ ${s.to})`)
      continue
    }
    for (let date = s.from; date <= s.to; date = addDays(date, 1)) {
      if (date < FIRST_DAY) continue
      const time = timeOf(s, date)
      if (!time) continue
      for (const venue of venues)
        out.push({
          id: `${date.replaceAll('-', '')}-${s.id}${venue === 'lake' ? '-lake' : ''}`,
          name: s.name,
          venue,
          date,
          ...time,
          sourceUrl: SHOW_VIEW + s.id,
        })
    }
  }
  // 날짜 형식이 바뀌면 전부 건너뛰어 manual만 남은 채 저장되므로 실패로 처리한다(긴 기간으로 건너뛴 건 정상).
  if (kept && badDates === kept) throw new Error('KOPIS: 남은 공연의 날짜를 하나도 읽지 못함 (날짜 형식 변경 의심)')
  return out
}

// 같은 장소·날짜는 manual이 우선, 수집분끼리는 먼저 온 것(kopisToManual 순서)이 우선하고 경고한다.
export function mergeEvents(manual: ManualEvent[], auto: ManualEvent[]): ManualEvent[] {
  const slot = (e: ManualEvent) => `${e.venue}|${e.date}`
  const manualSlots = new Set(manual.map(slot))
  const taken = new Map<string, ManualEvent>()
  const extra = auto.filter((a) => {
    const key = slot(a)
    if (manualSlots.has(key)) return false
    const winner = taken.get(key)
    if (winner) {
      console.warn(`[events] 겹쳐서 건너뜀: ${a.id} ${a.name} (${winner.id} ${winner.name} 우선)`)
      return false
    }
    taken.set(key, a)
    return true
  })
  return [...manual, ...extra]
}

export function buildEvents(
  manual: ManualEvent[],
  linked: Pick<LinkedSnapshot, 'tempMax' | 'shows'>,
  hasLayout: (venue: VenueId, file: string) => boolean,
): EventItem[] {
  return manual
    .map((m): EventItem => {
      const timed = Boolean(m.start && m.end)
      const rows = m.linkedName ? linked.shows.filter((r) => r.date === m.date && r.show === m.linkedName) : []
      const linkedPeople = rows.length ? Math.max(...rows.map((r) => r.people)) : null
      const layout = `layout_${m.id}.json`
      return {
        id: m.id,
        name: m.name,
        venue: m.venue,
        date: m.date,
        start: timed ? m.start! : DEFAULT_TIME.start,
        end: timed ? m.end! : DEFAULT_TIME.end,
        timeSource: timed ? (m.timeSource ?? 'manual') : 'default',
        people: m.people ?? linkedPeople,
        peopleSource: m.people != null ? 'manual' : linkedPeople != null ? 'linked' : 'default',
        layout: hasLayout(m.venue, layout) ? layout : null,
        sourceUrl: m.sourceUrl,
        tempMax: linked.tempMax[m.date] ?? null,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.venue.localeCompare(b.venue))
}

export async function loadAndBuild(now = new Date(), getShows: (now: Date) => Promise<KopisShow[]> = fetchShows): Promise<EventItem[]> {
  const manual = JSON.parse(readFileSync(MANUAL, 'utf8')) as ManualEvent[]
  const linked = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as LinkedSnapshot
  const exclude = JSON.parse(readFileSync(EXCLUDE, 'utf8')) as ExcludeItem[]
  const auto = kopisToManual(await getShows(now), exclude)
  return buildEvents(mergeEvents(manual, auto), linked, (venue, file) => existsSync(join(DATA, venue, file)))
}
