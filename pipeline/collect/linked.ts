// 연계 데이터(API_CPM_009)를 한 번 받아 정제본으로 저장한다. 매일 호출하지 않는다.
// 실행: node collect/linked.ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getKey } from './env.ts'
import { createSpacedFetch } from './http.ts'

const BASE = 'https://api.kcisa.kr/openapi/API_CPM_009/request'
const PAGE_SIZE = 500
const YEAR = '2025'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'snapshot', `linked_${YEAR}.json`)

export type LinkedRow = {
  date: string
  hour: number
  show: string
  people: number
  temp: number | null
}

// show: 연계 원문의 공연명 그대로(여러 공연이면 쉼표로 합쳐진 문자열)
export type LinkedShowRow = Omit<LinkedRow, 'temp'>

export type LinkedSnapshot = {
  source: string
  fetched: string
  tempMax: Record<string, number>
  shows: LinkedShowRow[]
}

const tag = (s: string, t: string) => s.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`))?.[1]?.trim()

export function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

export function parseItems(xml: string): Record<string, string>[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, body]) => {
    const o: Record<string, string> = {}
    for (const m of body.matchAll(/<([A-Za-z_]\w*)>([\s\S]*?)<\/\1>/g)) {
      o[m[1]] = m[2].replace(/<!\[CDATA\[|\]\]>/g, '').trim()
    }
    return o
  })
}

export function toRow(item: Record<string, string>): LinkedRow {
  const at = item.ISSUED_DATE?.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):/)
  if (!at) throw new Error(`ISSUED_DATE 형식 오류: ${item.ISSUED_DATE}`)
  const title = item.TITLE ?? ''
  const show = decodeEntities(title.match(/^공연명:(.*),공연관람객수:/)?.[1] ?? '').trim()
  const people = Number(title.match(/,공연관람객수:\s*(\d+)\s*$/)?.[1] ?? 0)
  const tempText = (item.DESCRIPTION ?? '').match(/기온:\s*([^,]*)/)?.[1]?.trim() ?? ''
  const temp = tempText === '' ? null : Number(tempText)
  return { date: at[1], hour: Number(at[2]), show, people, temp: Number.isFinite(temp) ? temp : null }
}

export function toSnapshot(rows: LinkedRow[], fetched: string): LinkedSnapshot {
  const tempMax: Record<string, number> = {}
  for (const r of rows) {
    if (!r.date.startsWith(YEAR)) throw new Error(`${YEAR}년이 아닌 행: ${r.date}`)
    if (r.temp !== null) tempMax[r.date] = Math.max(tempMax[r.date] ?? -Infinity, r.temp)
  }
  const shows = rows
    .filter((r) => r.show)
    .map(({ date, hour, show, people }) => ({ date, hour, show, people }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.hour - b.hour || a.show.localeCompare(b.show))
  const sortedTemps = Object.fromEntries(Object.entries(tempMax).sort(([a], [b]) => a.localeCompare(b)))
  return { source: BASE, fetched, tempMax: sortedTemps, shows }
}

// totalCount가 없거나 숫자가 아니면 NaN이 되어 루프가 첫 페이지에서 조용히 끝나므로 미리 막는다.
export function readTotal(text: string): number {
  const raw = tag(text, 'totalCount')
  const total = Number(raw)
  if (!Number.isInteger(total) || total < 1) throw new Error(`totalCount 오류: ${raw}`)
  return total
}

async function main() {
  const key = getKey('KCISA_LINKED_KEY')
  const get = createSpacedFetch({ spacingMs: 5_000, retryWaitMs: 30_000, retries: 2 })
  const items: Record<string, string>[] = []
  let total = Infinity
  for (let page = 1; items.length < total; page++) {
    const { status, text } = await get(`${BASE}?serviceKey=${encodeURIComponent(key)}&numOfRows=${PAGE_SIZE}&pageNo=${page}`)
    const code = tag(text, 'resultCode')
    if (status !== 200 || code !== '0000') throw new Error(`page ${page}: HTTP ${status}, resultCode ${code}`)
    if (total === Infinity) total = readTotal(text)
    const got = parseItems(text)
    if (!got.length) throw new Error(`page ${page}: 빈 페이지 (${items.length}/${total})`)
    items.push(...got)
    console.log(`page ${page}: ${got.length}건 (${items.length}/${total})`)
  }
  if (items.length !== total) throw new Error(`수집 ${items.length}건, 예상 ${total}건`)
  const snapshot = toSnapshot(items.map(toRow), new Date().toISOString())
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`저장: ${OUT} (기온 ${Object.keys(snapshot.tempMax).length}일, 공연 행 ${snapshot.shows.length}개)`)
}

if (import.meta.main) await main()
