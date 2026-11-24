// 올림픽공원 공식 일정(ksponco.or.kr)의 월별 JSON을 받아 온다. 키 불필요. 날짜는 모두 KST 기준.
import type { VenueId } from '../../web/src/data/types.ts'
import { fetchText, type TextResponse } from './http.ts'
import { kstNow } from './kma.ts'

const URL = 'https://www.ksponco.or.kr/olympicpark/eventInfo/eventInfoListAjax.es'
export const FIRST_MONTH = '2026-01' // 2025년은 manual이 정확해서 겹치지 않게 고정
export const MONTHS_AHEAD = 12

export type Post = (body: string) => Promise<TextResponse>

// 응답 필드 중 쓰는 것만. plc, 시각은 자유 입력이라 장소 분류에만 plc를 쓴다.
export type ScheduleItem = { evtSeq: number; title: string; plc: string; beginDt: string; endDt: string }

// plc는 자유 입력이라 문자열로만 장소를 가른다. 둘 다 적혀 있으면 두 무대 모두.
export function venuesOf(plc: string): VenueId[] {
  const out: VenueId[] = []
  if (plc.includes('88잔디마당')) out.push('lawn88')
  if (plc.includes('수변무대')) out.push('lake')
  return out
}

// null, 빈 문자열, 0, 음수는 Number()를 거치면 통과할 수 있어 직접 거른다.
function toSeq(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

const realPost: Post = (body) =>
  // 23개월 이상을 차례로 받으므로 기본값(30초+30초 재시도)이면 Actions 15분 제한을 넘을 수 있다.
  fetchText(URL, {
    timeoutMs: 15_000,
    retryWaitMs: 5_000,
    fetchFn: (u, init) =>
      fetch(u, {
        ...init,
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=UTF-8', 'User-Agent': 'ksponco-data-pipeline' },
        body,
      }),
  })

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function addMonths(ym: string, n: number): string {
  const t = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

// 'YYYY-MM' 목록: FIRST_MONTH부터 오늘(KST)의 MONTHS_AHEAD개월 뒤까지
export function monthRange(now: Date): string[] {
  const last = addMonths(kstNow(now).date.slice(0, 7), MONTHS_AHEAD)
  const out: string[] = []
  for (let m = FIRST_MONTH; m <= last; m = addMonths(m, 1)) out.push(m)
  return out
}

export async function fetchMonth(ym: string, post: Post = realPost): Promise<ScheduleItem[]> {
  const { status, text } = await post(JSON.stringify({ nowYM: ym.replace('-', ''), plcCd: '' }))
  if (status !== 200) throw new Error(`올림픽공원 일정(${ym}): HTTP ${status}`)
  let j: unknown
  try {
    j = JSON.parse(text)
  } catch {
    throw new Error(`올림픽공원 일정(${ym}): JSON이 아닌 응답 (${text.slice(0, 80).replace(/\s+/g, ' ')})`)
  }
  // [예정 공연, 지난 공연]
  // 지난 공연이 빠진 채 통과하면 자동 수집분이 조용히 사라지므로 둘 다 배열이어야 한다.
  if (!Array.isArray(j) || !Array.isArray(j[0]) || !Array.isArray(j[1])) throw new Error(`올림픽공원 일정(${ym}): 응답 구조가 다름`)
  const rows = [...j[0], ...j[1]]
  const out: ScheduleItem[] = []
  rows.forEach((r, i) => {
    // 잔디·수변 행만 쓴다. 실내 공연 행은 형식이 이상해도 갱신을 막지 않도록 무시한다.
    if (typeof r?.plc !== 'string' || !venuesOf(r.plc).length) return
    const evtSeq = toSeq(r.evtSeq)
    if (!evtSeq || typeof r.title !== 'string' || typeof r.beginDt !== 'string' || typeof r.endDt !== 'string')
      throw new Error(`올림픽공원 일정(${ym}) ${i}번째 항목: 필드가 없거나 형식이 다름`)
    const title = r.title.trim()
    if (!title) return void console.warn(`[events] 건너뜀: ${evtSeq} 제목 없음`)
    out.push({ evtSeq, title, plc: r.plc, beginDt: r.beginDt, endDt: r.endDt })
  })
  return out
}

// 한 달이라도 실패하면 전체 실패(이전 events.json 유지). 같은 evtSeq는 한 번만.
export async function fetchSchedule(
  now = new Date(),
  post: Post = realPost,
  sleep: (ms: number) => Promise<void> = realSleep,
): Promise<ScheduleItem[]> {
  const bySeq = new Map<number, ScheduleItem>()
  for (const [i, ym] of monthRange(now).entries()) {
    if (i) await sleep(300)
    for (const it of await fetchMonth(ym, post)) bySeq.set(it.evtSeq, it)
  }
  // 2026년분이 항상 포함되므로 0건이면 응답 형식이나 장소 표기가 바뀐 것으로 본다.
  if (!bySeq.size) throw new Error('올림픽공원 일정: 잔디·수변 공연이 한 건도 없음 (응답 형식이나 장소 표기 변경 의심)')
  return [...bySeq.values()].sort((a, b) => a.evtSeq - b.evtSeq)
}
