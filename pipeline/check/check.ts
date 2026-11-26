// 출력 파일 품질 검사. 오류 메시지 목록을 돌려주고, 비어 있으면 통과.
import { readFileSync } from 'node:fs'
import { addDays } from '../collect/kma.ts'

const VENUES = ['lawn88', 'lake']
const VALUE_SOURCES = ['api', 'manual', 'linked', 'default']
const SKIES = ['맑음', '구름많음', '흐림']
const TEMP_RANGE = [-30, 45] as const
const MIN_FORECAST_DAYS = 3 // 05:30 전 실행(전날 발표분)이어도 오늘~모레는 있다
export const MAX_BYTES = 300 * 1024

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim() !== ''
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function isDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
}

export function isClock(v: unknown): v is string {
  return typeof v === 'string' && (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) || v === '24:00')
}

const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
const inTemp = (v: number) => v >= TEMP_RANGE[0] && v <= TEMP_RANGE[1]

export function checkSize(text: string): string[] {
  const bytes = Buffer.byteLength(text, 'utf8')
  return bytes > MAX_BYTES ? [`파일 크기 ${bytes}B가 ${MAX_BYTES}B를 넘음`] : []
}

// 지난 공연도 계속 받으므로 정상이면 건수가 크게 줄지 않는다. 10% 넘게, 그리고 10건 넘게 줄면 수집 누락을 의심한다.
// 건수 조건은 페스티벌 하나 취소(3일×2무대=6건)로 매일 실패가 이어지지 않게 하려는 것.
// 이전 파일이 없거나 읽지 못하면 비교하지 않는다.
export function checkShrink(data: unknown, prevFile: string): string[] {
  let prev: unknown
  try {
    prev = JSON.parse(readFileSync(prevFile, 'utf8'))
  } catch {
    return []
  }
  if (!Array.isArray(data) || !Array.isArray(prev)) return []
  const shrunk = data.length < prev.length * 0.9 && prev.length - data.length > 10
  return shrunk ? [`건수가 ${prev.length}건에서 ${data.length}건으로 10%·10건 넘게 줄어듦 (수집 누락 의심)`] : []
}

export function checkEvents(data: unknown): string[] {
  if (!Array.isArray(data)) return ['events: 배열이 아님']
  if (!data.length) return ['events: 빈 배열']
  const errors: string[] = []
  const ids = new Set<string>()
  const slots = new Set<string>()
  data.forEach((e, i) => {
    const at = `events[${i}]`
    if (!isObj(e)) return void errors.push(`${at}: 객체가 아님`)
    const err = (msg: string) => errors.push(`${at}(${String(e.id)}): ${msg}`)
    if (!isStr(e.id)) err('id 없음')
    else if (ids.has(e.id)) err('id 중복')
    else ids.add(e.id)
    if (!isStr(e.name)) err('name 없음')
    if (!VENUES.includes(e.venue as string)) err(`venue 값 오류: ${String(e.venue)}`)
    if (!isDate(e.date)) err(`date 형식 오류: ${String(e.date)}`)
    const slot = `${String(e.venue)}|${String(e.date)}`
    if (slots.has(slot)) err(`같은 장소·날짜 중복: ${slot}`)
    slots.add(slot)
    if (!isClock(e.start)) err(`start 형식 오류: ${String(e.start)}`)
    if (!isClock(e.end)) err(`end 형식 오류: ${String(e.end)}`)
    if (isClock(e.start) && isClock(e.end) && minutes(e.start) >= minutes(e.end)) err(`start(${e.start}) ≥ end(${e.end})`)
    if (!VALUE_SOURCES.includes(e.timeSource as string)) err(`timeSource 값 오류: ${String(e.timeSource)}`)
    if (!(e.people === null || (Number.isInteger(e.people) && (e.people as number) >= 0))) err(`people 값 오류: ${String(e.people)}`)
    if (!VALUE_SOURCES.includes(e.peopleSource as string)) err(`peopleSource 값 오류: ${String(e.peopleSource)}`)
    if (!(e.layout === null || (typeof e.layout === 'string' && /^layout_.+\.json$/.test(e.layout)))) err(`layout 값 오류: ${String(e.layout)}`)
    if (!(typeof e.sourceUrl === 'string' && /^https?:\/\/\S+$/.test(e.sourceUrl))) err('sourceUrl 없음 또는 형식 오류')
    if (!(e.tempMax === null || (isNum(e.tempMax) && inTemp(e.tempMax)))) err(`tempMax 값 오류: ${String(e.tempMax)}`)
  })
  return errors
}

export function checkClosures(data: unknown): string[] {
  if (!Array.isArray(data)) return ['closures: 배열이 아님']
  const errors: string[] = []
  data.forEach((c, i) => {
    const at = `closures[${i}]`
    if (!isObj(c)) return void errors.push(`${at}: 객체가 아님`)
    if (!VENUES.includes(c.venue as string)) errors.push(`${at}: venue 값 오류: ${String(c.venue)}`)
    if (!isDate(c.from)) errors.push(`${at}: from 형식 오류: ${String(c.from)}`)
    if (!isDate(c.to)) errors.push(`${at}: to 형식 오류: ${String(c.to)}`)
    if (isDate(c.from) && isDate(c.to) && c.from > c.to) errors.push(`${at}: from(${c.from}) > to(${c.to})`)
    if (!isStr(c.reason)) errors.push(`${at}: reason 없음`)
    if (!isStr(c.source)) errors.push(`${at}: source 없음`)
  })
  return errors
}

export function checkForecast(data: unknown): string[] {
  if (!isObj(data)) return ['forecast: 객체가 아님']
  const errors: string[] = []
  if (!(typeof data.updated === 'string' && !Number.isNaN(Date.parse(data.updated)))) errors.push(`forecast.updated 형식 오류: ${String(data.updated)}`)
  if (!Array.isArray(data.days) || !data.days.length) return [...errors, 'forecast.days: 빈 배열이거나 배열이 아님']
  const dates = new Set<string>()
  data.days.forEach((d, i) => {
    const at = `forecast.days[${i}]`
    if (!isObj(d)) return void errors.push(`${at}: 객체가 아님`)
    if (!isDate(d.date)) errors.push(`${at}: date 형식 오류: ${String(d.date)}`)
    else if (dates.has(d.date)) errors.push(`${at}: date 중복: ${d.date}`)
    else dates.add(d.date)
    if (!SKIES.includes(d.sky as string)) errors.push(`${at}: sky 값 오류: ${String(d.sky)}`)
    if (typeof d.rain !== 'boolean') errors.push(`${at}: rain이 boolean이 아님`)
    if (!(isNum(d.rainPrevDay) && d.rainPrevDay >= 0)) errors.push(`${at}: rainPrevDay 값 오류: ${String(d.rainPrevDay)}`)
    if (!(isNum(d.tempMax) && inTemp(d.tempMax))) errors.push(`${at}: tempMax 값 오류: ${String(d.tempMax)}`)
  })
  // 일부 날짜가 빠지거나 오래된 발표분이 들어온 경우
  const ds = [...dates]
  if (ds.length < MIN_FORECAST_DAYS) errors.push(`forecast.days: ${ds.length}일뿐 (최소 ${MIN_FORECAST_DAYS}일)`)
  ds.forEach((d, i) => {
    if (i && d !== addDays(ds[i - 1], 1)) errors.push(`forecast.days: ${ds[i - 1]} 다음 날짜가 ${d}`)
  })
  const base = typeof data.updated === 'string' ? data.updated.slice(0, 10) : ''
  if (isDate(base) && ds.length && ds[0] !== base && ds[0] !== addDays(base, 1))
    errors.push(`forecast.days: 첫날 ${ds[0]}이 발표일(${base}) 또는 다음 날이 아님`)
  return errors
}
