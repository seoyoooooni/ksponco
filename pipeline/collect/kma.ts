// 기상청 단기예보(API허브)와 ASOS 일자료(서울 108) 수집. 날짜는 모두 KST 기준.
import { getKey } from './env.ts'
import { fetchText, type TextResponse } from './http.ts'

const VILAGE_URL = 'https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst'
const ASOS_DAILY_URL = 'https://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList'
const ASOS_HOURLY_URL = 'https://apis.data.go.kr/1360000/AsosHourlyInfoService/getWthrDataList'
const GRID = { nx: 62, ny: 126 } // 송파구(올림픽공원)
const ASOS_STATION = 108 // 서울
const BASE_TIME = '0500'
const BASE_READY_MIN = 5 * 60 + 30 // 05시 발표분은 05:30 이후 사용

export type Get = (url: string) => Promise<TextResponse>

export type VilageItem = {
  category: string
  fcstDate: string // YYYYMMDD
  fcstTime: string // HHMM
  fcstValue: string
}

const KST_MS = 9 * 60 * 60 * 1000

export function kstNow(now: Date): { date: string; minutes: number } {
  const k = new Date(now.getTime() + KST_MS)
  return { date: k.toISOString().slice(0, 10), minutes: k.getUTCHours() * 60 + k.getUTCMinutes() }
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const compact = (date: string) => date.replaceAll('-', '')
export const dashed = (ymd: string) => `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`

export function vilageBase(now: Date): { baseDate: string; baseTime: string } {
  const { date, minutes } = kstNow(now)
  return { baseDate: compact(minutes >= BASE_READY_MIN ? date : addDays(date, -1)), baseTime: BASE_TIME }
}

function parseJson(text: string, what: string): any {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${what}: JSON이 아닌 응답 (${text.slice(0, 80).replace(/\s+/g, ' ')})`)
  }
}

const VILAGE_ROWS = 1000
const VILAGE_MAX_PAGES = 5

// 한 페이지는 1000건까지라, totalCount를 채울 때까지 다음 페이지를 받는다.
export async function fetchVilage(now: Date, get: Get = fetchText, key = getKey('KMA_AUTH_KEY')): Promise<VilageItem[]> {
  const { baseDate, baseTime } = vilageBase(now)
  const all: VilageItem[] = []
  let total = NaN
  for (let page = 1; page <= VILAGE_MAX_PAGES; page++) {
    const q = new URLSearchParams({
      pageNo: String(page),
      numOfRows: String(VILAGE_ROWS),
      dataType: 'JSON',
      base_date: baseDate,
      base_time: baseTime,
      nx: String(GRID.nx),
      ny: String(GRID.ny),
      authKey: key,
    })
    const { status, text } = await get(`${VILAGE_URL}?${q}`)
    if (status !== 200) throw new Error(`단기예보: HTTP ${status}`)
    const j = parseJson(text, '단기예보')
    const code = j?.response?.header?.resultCode
    if (code !== '00') throw new Error(`단기예보: resultCode ${code} ${j?.response?.header?.resultMsg ?? ''}`)
    const items: VilageItem[] = j.response.body?.items?.item ?? []
    total = Number(j.response.body?.totalCount)
    all.push(...items)
    if (all.length >= total || items.length < VILAGE_ROWS) break // 덜 찬 페이지는 마지막 페이지
  }
  if (all.length !== total) throw new Error(`단기예보: ${all.length}/${total}건만 받음`)
  return all
}

// date(YYYY-MM-DD) 하루 강수량(mm). 비가 안 온 날은 sumRn이 빈 문자열이라 0으로 본다.
export async function fetchAsosDailyRain(date: string, get: Get = fetchText, key = getKey('ASOS_DAILY_KEY')): Promise<number> {
  const serviceKey = key.includes('%') ? key : encodeURIComponent(key)
  const ymd = compact(date)
  const url =
    `${ASOS_DAILY_URL}?serviceKey=${serviceKey}&numOfRows=10&pageNo=1&dataType=JSON` +
    `&dataCd=ASOS&dateCd=DAY&startDt=${ymd}&endDt=${ymd}&stnIds=${ASOS_STATION}`
  const { status, text } = await get(url)
  if (status !== 200) throw new Error(`ASOS 일자료: HTTP ${status}`)
  const j = parseJson(text, 'ASOS 일자료')
  const code = j?.response?.header?.resultCode
  if (code !== '00') throw new Error(`ASOS 일자료(${date}): resultCode ${code} ${j?.response?.header?.resultMsg ?? ''}`)
  const item = (j.response.body?.items?.item ?? []).find((i: { tm?: string }) => i.tm === date)
  if (!item) throw new Error(`ASOS 일자료: ${date} 자료 없음`)
  // 비 안 온 날의 빈 문자열과 달리, 필드 자체가 없으면 응답 형식이 바뀐 것이다.
  if (!('sumRn' in item)) throw new Error('ASOS 일자료: sumRn 필드 없음')
  const raw = String(item.sumRn ?? '').trim()
  const mm = raw === '' ? 0 : Number(raw)
  if (!Number.isFinite(mm) || mm < 0) throw new Error(`ASOS 일자료: sumRn 값 오류 ${raw}`)
  return mm
}

// date(YYYY-MM-DD) 00~23시 시간별 강수량(mm) 24칸. 빈 rn은 0, 결측(rnQcflg 9)이나 빠진 시각은 null.
export async function fetchAsosHourlyRain(date: string, get: Get = fetchText, key = getKey('ASOS_DAILY_KEY')): Promise<(number | null)[]> {
  const serviceKey = key.includes('%') ? key : encodeURIComponent(key)
  const ymd = compact(date)
  const url =
    `${ASOS_HOURLY_URL}?serviceKey=${serviceKey}&numOfRows=30&pageNo=1&dataType=JSON` +
    `&dataCd=ASOS&dateCd=HR&startDt=${ymd}&startHh=00&endDt=${ymd}&endHh=23&stnIds=${ASOS_STATION}`
  const { status, text } = await get(url)
  if (status !== 200) throw new Error(`ASOS 시간자료: HTTP ${status}`)
  const j = parseJson(text, 'ASOS 시간자료')
  const code = j?.response?.header?.resultCode
  if (code !== '00') throw new Error(`ASOS 시간자료(${date}): resultCode ${code} ${j?.response?.header?.resultMsg ?? ''}`)
  const out: (number | null)[] = Array(24).fill(null)
  let rows = 0
  for (const item of j.response.body?.items?.item ?? []) {
    const m = String(item.tm ?? '').match(/^(\d{4}-\d{2}-\d{2}) (\d{2}):00$/)
    if (!m || m[1] !== date) continue
    rows++
    if (!('rn' in item)) throw new Error('ASOS 시간자료: rn 필드 없음')
    const raw = String(item.rn ?? '').trim()
    if (raw === '') {
      out[Number(m[2])] = String(item.rnQcflg ?? '').trim() === '9' ? null : 0
      continue
    }
    const mm = Number(raw)
    if (!Number.isFinite(mm) || mm < 0) throw new Error(`ASOS 시간자료: rn 값 오류 ${raw}`)
    out[Number(m[2])] = mm
  }
  // 빈 응답이나 tm 형식 변경을 조용히 null로 넘기지 않는다.
  if (!rows) throw new Error(`ASOS 시간자료: ${date} 자료 없음`)
  return out
}
