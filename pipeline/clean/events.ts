// events_manual.json + 연계 스냅샷 → events.json 내용. 저장은 run.ts가 검사 후에 한다.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { EventItem, VenueId } from '../../web/src/data/types.ts'
import type { LinkedSnapshot } from '../collect/linked.ts'

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

export function loadAndBuild(): EventItem[] {
  const manual = JSON.parse(readFileSync(MANUAL, 'utf8')) as ManualEvent[]
  const linked = JSON.parse(readFileSync(SNAPSHOT, 'utf8')) as LinkedSnapshot
  return buildEvents(manual, linked, (venue, file) => existsSync(join(DATA, venue, file)))
}
