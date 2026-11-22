// closures_manual.json → web/public/data/closures.json
// 실행: node clean/closures.ts
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Closure, VenueId } from '../../web/src/data/types.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MANUAL = join(ROOT, 'pipeline', 'manual', 'closures_manual.json')
const OUT = join(ROOT, 'web', 'public', 'data', 'closures.json')

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

if (import.meta.main) {
  const closures = buildClosures(JSON.parse(readFileSync(MANUAL, 'utf8')) as ManualClosure[])
  writeFileSync(OUT, JSON.stringify(closures, null, 2) + '\n')
  console.log(`저장: web/public/data/closures.json (${closures.length}건)`)
}
