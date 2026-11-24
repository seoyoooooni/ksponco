// events_manual.json + 올림픽공원 공식 일정 + 연계 스냅샷 → events.json 내용. 저장은 run.ts가 검사 후에 한다.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EventItem, VenueId } from '../../web/src/data/types.ts'
import { isDate } from '../check/check.ts'
import { addDays } from '../collect/kma.ts'
import type { LinkedSnapshot } from '../collect/linked.ts'
import { fetchSchedule, venuesOf, type ScheduleItem } from '../collect/olympicpark.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MANUAL = join(ROOT, 'pipeline', 'manual', 'events_manual.json')
const SNAPSHOT = join(ROOT, 'pipeline', 'snapshot', 'linked_2025.json')
const DATA = join(ROOT, 'web', 'public', 'data')

export const DEFAULT_TIME = { start: '12:00', end: '21:00' }

// linkedName: 연계 데이터 공연명 원문. 이 이름만 있는 행(다른 공연과 겹치지 않은 행)에서 관객 수를 쓴다.
// note: 검증 메모. events.json에는 나가지 않는다.
export type ManualEvent = {
  id: string
  name: string
  venue: VenueId
  date: string
  start?: string
  end?: string
  people?: number
  sourceUrl: string
  linkedName?: string
  note?: string
}

const SCHEDULE_VIEW = 'https://www.ksponco.or.kr/olympicpark/eventInfo/eventInfoView.es?mid=a20301010100&evtSeq='
const MAX_SPAN_DAYS = 31 // 이보다 긴 기간은 공연이 아니라 전시·시설 안내로 보고 건너뜀

// 공식 일정 → manual 형식. 기간은 하루씩 펼치고 시각은 알 수 없어 비워 둔다(default 시각이 쓰인다).
export function scheduleToManual(items: ScheduleItem[]): ManualEvent[] {
  const out: ManualEvent[] = []
  for (const it of items) {
    const venues = venuesOf(it.plc)
    if (!venues.length) continue
    const { beginDt: from, endDt: to } = it
    if (!isDate(from) || !isDate(to) || from > to || to > addDays(from, MAX_SPAN_DAYS - 1)) {
      console.warn(`[events] 건너뜀: ${it.evtSeq} ${it.title} (${from} ~ ${to})`)
      continue
    }
    for (let date = from; date <= to; date = addDays(date, 1))
      for (const venue of venues)
        out.push({
          id: `${date.replaceAll('-', '')}-${it.evtSeq}${venue === 'lake' ? '-lake' : ''}`,
          name: it.title,
          venue,
          date,
          sourceUrl: SCHEDULE_VIEW + it.evtSeq,
        })
  }
  // 날짜 형식이 바뀌면 전부 건너뛰어 manual만 남은 채 저장되므로 실패로 처리한다.
  if (items.length && !out.length) throw new Error('올림픽공원 일정: 펼친 공연이 0건 (날짜 형식 변경 의심)')
  return out
}

// 같은 장소·날짜는 manual이 우선, 수집분끼리는 먼저 온 것(evtSeq가 작은 것)이 우선.
export function mergeEvents(manual: ManualEvent[], auto: ManualEvent[]): ManualEvent[] {
  const taken = new Set(manual.map((m) => `${m.venue}|${m.date}`))
  const extra = auto.filter((a) => {
    const key = `${a.venue}|${a.date}`
    if (taken.has(key)) return false
    taken.add(key)
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
        timeSource: timed ? 'manual' : 'default',
        people: m.people ?? linkedPeople,
        peopleSource: m.people != null ? 'manual' : linkedPeople != null ? 'linked' : 'default',
        layout: hasLayout(m.venue, layout) ? layout : null,
        sourceUrl: m.sourceUrl,
        tempMax: linked.tempMax[m.date] ?? null,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.venue.localeCompare(b.venue))
}

export async function loadAndBuild(now = new Date(), getSchedule = fetchSchedule): Promise<EventItem[]> {
  const manual = JSON.parse(readFileSync(MANUAL, 'utf8')) as ManualEvent[]
  const linked = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as LinkedSnapshot
  const auto = scheduleToManual(await getSchedule(now))
  return buildEvents(mergeEvents(manual, auto), linked, (venue, file) => existsSync(join(DATA, venue, file)))
}
