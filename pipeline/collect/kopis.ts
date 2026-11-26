// KOPIS(공연예술통합전산망) 오픈 API로 올림픽공원 잔디·수변·일대 공연을 받는다. 날짜는 모두 KST 기준.
import type { VenueId } from '../../web/src/data/types.ts'
import { getKey } from './env.ts'
import { fetchText, type TextResponse } from './http.ts'
import { kstNow } from './kma.ts'

const API = 'https://kopis.or.kr/openApi/restful' // www.는 이 주소로 리다이렉트된다(리다이렉트는 따라가지 않음)
export const FIRST_MONTH = '2026-01' // 2025년은 manual이 정확해서 겹치지 않게 고정
export const MONTHS_AHEAD = 12

// 올림픽공원(FC001247)의 공연장 코드. 일대는 어느 무대인지 몰라 두 무대 모두 쓰고,
// 공원 다른 장소 공연이 섞이지 않게 페스티벌만 받는다(clean/events.ts에서 거름).
export const PLACES: Record<string, { venues: VenueId[]; festivalOnly: boolean }> = {
  'FC001247-07': { venues: ['lawn88'], festivalOnly: false }, // 야외(88잔디마당)
  'FC001247-08': { venues: ['lake'], festivalOnly: false }, // 야외(수변무대)
  'FC001247-12': { venues: ['lawn88', 'lake'], festivalOnly: true }, // 일대
}

export type Get = (url: string) => Promise<TextResponse>

// from, to는 YYYY-MM-DD. guidance 예: "토요일 ~ 일요일(14:00)", runtime 예: "8시간 30분"
export type KopisShow = {
  id: string
  name: string
  from: string
  to: string
  places: string[]
  festival: boolean
  guidance: string
  runtime: string
}

const ENTITIES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&amp;': '&' }
const decode = (s: string) => s.replace(/&(lt|gt|quot|#39|apos|amp);/g, (m) => ENTITIES[m])

export function tags(xml: string, name: string): string[] {
  return [...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => decode(m[1]).trim())
}

const realGet: Get = (url) => fetchText(url, { timeoutMs: 15_000, retryWaitMs: 5_000 })
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

// 오류 메시지에 URL을 넣지 않는다(쿼리에 키가 있음).
async function getXml(get: Get, url: string, what: string): Promise<string> {
  const { status, text } = await get(url)
  if (status !== 200) throw new Error(`KOPIS ${what}: HTTP ${status}`)
  if (!text.includes('<dbs')) throw new Error(`KOPIS ${what}: XML이 아닌 응답 (${text.slice(0, 80).replace(/\s+/g, ' ')})`)
  return text
}

const dashed = (d: string) => d.replaceAll('.', '-')

// 한 달·한 공연장의 공연 목록(조회 기간은 최대 31일이라 한 달씩)
export async function fetchList(key: string, ym: string, place: string, get: Get = realGet) {
  const last = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0)).getUTCDate()
  const q = new URLSearchParams({ service: key, stdate: `${ym.replace('-', '')}01`, eddate: `${ym.replace('-', '')}${last}`, cpage: '1', rows: '100', prfplccd: place })
  const xml = await getXml(get, `${API}/pblprfr?${q}`, `목록(${ym}, ${place})`)
  const rows = tags(xml, 'db')
  // 100건이 차면 다음 페이지가 있을 수 있다. 야외 공연장은 한 달에 몇 건이라 넘으면 형식 변화로 본다.
  if (rows.length >= 100) throw new Error(`KOPIS 목록(${ym}, ${place}): 100건 이상 (페이지 처리 필요)`)
  return rows.map((db, i) => {
    const [id] = tags(db, 'mt20id'), [name] = tags(db, 'prfnm'), [from] = tags(db, 'prfpdfrom'), [to] = tags(db, 'prfpdto')
    if (!id || !name || !from || !to) throw new Error(`KOPIS 목록(${ym}, ${place}) ${i}번째 항목: 필드가 없음`)
    return { id, name, from: dashed(from), to: dashed(to) }
  })
}

export async function fetchDetail(key: string, id: string, get: Get = realGet) {
  const xml = await getXml(get, `${API}/pblprfr/${encodeURIComponent(id)}?${new URLSearchParams({ service: key })}`, `상세(${id})`)
  if (tags(xml, 'mt20id')[0] !== id) throw new Error(`KOPIS 상세(${id}): 공연 ID가 다름`)
  return { festival: tags(xml, 'festival')[0] === 'Y', guidance: tags(xml, 'dtguidance')[0] ?? '', runtime: tags(xml, 'prfruntime')[0] ?? '' }
}

// 한 번이라도 실패하면 전체 실패(이전 events.json 유지). 같은 공연이 여러 달·공연장에 나오면 공연장만 모은다.
export async function fetchShows(
  now = new Date(),
  get: Get = realGet,
  sleep: (ms: number) => Promise<void> = realSleep,
  key = getKey('KOPIS_KEY'),
): Promise<KopisShow[]> {
  const byId = new Map<string, { id: string; name: string; from: string; to: string; places: Set<string> }>()
  let calls = 0
  const pace = () => (calls++ ? sleep(300) : Promise.resolve())
  for (const ym of monthRange(now)) {
    for (const place of Object.keys(PLACES)) {
      await pace()
      for (const r of await fetchList(key, ym, place, get)) {
        const prev = byId.get(r.id)
        if (prev) prev.places.add(place)
        else byId.set(r.id, { ...r, places: new Set([place]) })
      }
    }
  }
  // 2026년분이 항상 포함되므로 0건이면 응답 형식이나 공연장 코드가 바뀐 것으로 본다.
  if (!byId.size) throw new Error('KOPIS: 잔디·수변·일대 공연이 한 건도 없음 (응답 형식이나 공연장 코드 변경 의심)')
  const out: KopisShow[] = []
  for (const s of [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    await pace()
    out.push({ ...s, places: [...s.places].sort(), ...(await fetchDetail(key, s.id, get)) })
  }
  return out
}
