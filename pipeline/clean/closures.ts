// closures_manual.json → closures.json 내용. 저장은 run.ts가 검사 후에 한다.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Closure, VenueId } from '../../web/src/data/types.ts'

const MANUAL = join(dirname(fileURLToPath(import.meta.url)), '..', 'manual', 'closures_manual.json')

// sourceUrl, note: 근거와 검증 메모. closures.json에는 나가지 않는다.
export type ManualClosure = {
  venue: VenueId
  from: string
  to: string
  reason: string
  sourceUrl: string
  note?: string
}

export function buildClosures(manual: ManualClosure[]): Closure[] {
  return manual
    .map(({ venue, from, to, reason }): Closure => ({ venue, from, to, reason, source: 'manual' }))
    .sort((a, b) => a.venue.localeCompare(b.venue) || a.from.localeCompare(b.from))
}

export function loadAndBuildClosures(): Closure[] {
  return buildClosures(JSON.parse(readFileSync(MANUAL, 'utf8')) as ManualClosure[])
}
