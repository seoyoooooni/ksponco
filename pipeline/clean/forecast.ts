// 단기예보 + ASOS → forecast.json 내용. 저장은 run.ts가 검사 후에 한다.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Forecast, ForecastDay } from '../../web/src/data/types.ts'
import { getKey } from '../collect/env.ts'
import { fetchText } from '../collect/http.ts'
import { addDays, dashed, fetchAsosDailyRain, fetchVilage, kstNow, vilageBase, type Get, type VilageItem } from '../collect/kma.ts'

const FORECAST = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'web', 'public', 'data', 'forecast.json')

const SKY: Record<string, string> = { '1': '맑음', '3': '구름많음', '4': '흐림' }
const SKY_HOURS = [9, 18] // 하늘 상태 대표 시간대(포함)
const RAIN_HOURS = [9, 21] // 비 여부 판단 시간대(포함)

// 단기예보 PCP(1시간 강수량) 문자열 → mm. 구간값은 하한을 쓴다.
export function parsePcp(s: string): number {
  const v = s.trim()
  if (v === '강수없음' || v === '0') return 0
  if (/^1(\.0)?mm 미만$/.test(v)) return 0.5
  const range = v.match(/^(\d+(?:\.\d+)?)~\d+(?:\.\d+)?mm$/)
  if (range) return Number(range[1])
  const over = v.match(/^(\d+(?:\.\d+)?)mm 이상$/)
  if (over) return Number(over[1])
  const plain = v.match(/^(\d+(?:\.\d+)?)(?:mm)?$/)
  if (plain) return Number(plain[1])
  throw new Error(`PCP 형식 오류: ${s}`)
}

const hourOf = (i: VilageItem) => Number(i.fcstTime.slice(0, 2))
const round1 = (n: number) => Math.round(n * 10) / 10

// today: KST 오늘. observedPrevRain: 어제 ASOS 관측 강수량(오늘의 rainPrevDay).
// 내일 이후의 rainPrevDay는 전날 예보 PCP 합(06시 발표 이전 시간은 예보에 없음).
export function buildForecast(items: VilageItem[], today: string, observedPrevRain: number, updated: string): Forecast {
  const byDate = new Map<string, VilageItem[]>()
  for (const i of items) {
    const d = dashed(i.fcstDate)
    const list = byDate.get(d) ?? []
    list.push(i)
    byDate.set(d, list)
  }
  const pick = (date: string, cat: string, [from, to] = [0, 23]) =>
    (byDate.get(date) ?? []).filter((i) => i.category === cat && hourOf(i) >= from && hourOf(i) <= to)

  const days: ForecastDay[] = []
  for (const date of [...byDate.keys()].sort()) {
    if (date < today) continue
    const tmx = pick(date, 'TMX')[0]
    if (!tmx) continue

    const skies = pick(date, 'SKY', SKY_HOURS).map((i) => i.fcstValue)
    if (!skies.length) throw new Error(`${date}: ${SKY_HOURS.join('~')}시 SKY 없음`)
    const counts = new Map<string, number>()
    for (const s of skies) counts.set(s, (counts.get(s) ?? 0) + 1)
    const [skyCode] = [...counts.entries()].sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0]))[0]
    const sky = SKY[skyCode]
    if (!sky) throw new Error(`${date}: SKY 코드 오류 ${skyCode}`)

    const ptys = pick(date, 'PTY', RAIN_HOURS)
    if (!ptys.length) throw new Error(`${date}: ${RAIN_HOURS.join('~')}시 PTY 없음`)
    const rain = ptys.some((i) => i.fcstValue !== '0')

    let rainPrevDay = observedPrevRain
    if (date !== today) {
      const pcp = pick(addDays(date, -1), 'PCP')
      if (!pcp.length) throw new Error(`${date}: 전날 PCP 없음`)
      rainPrevDay = round1(pcp.reduce((s, i) => s + parsePcp(i.fcstValue), 0))
    }

    days.push({ date, sky, rain, rainPrevDay, tempMax: Number(tmx.fcstValue) })
  }
  return { updated, days }
}

// 이전 forecast.json에 있던 오늘의 rainPrevDay(어제 예보 PCP 합). 없거나 읽을 수 없으면 null.
export function previousRainPrevDay(today: string, file = FORECAST): number | null {
  try {
    const prev = JSON.parse(readFileSync(file, 'utf8')) as Forecast
    const v = prev.days.find((d) => d.date === today)?.rainPrevDay
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
  } catch {
    return null
  }
}

export async function loadAndBuildForecast(
  now = new Date(),
  get: Get = fetchText,
  prevFile = FORECAST,
  key: (name: string) => string = getKey,
): Promise<Forecast> {
  const today = kstNow(now).date
  const { baseDate, baseTime } = vilageBase(now)
  const items = await fetchVilage(now, get, key('KMA_AUTH_KEY'))
  // 키가 없는 설정 오류는 대신하지 않고 실패시킨다.
  const asosKey = key('ASOS_DAILY_KEY')
  // ASOS는 오늘 rainPrevDay 하나에만 쓰이므로, 실패하면 이전 예보값으로 대신해 예보 전체가 멈추지 않게 한다.
  const observed = await fetchAsosDailyRain(addDays(today, -1), get, asosKey).catch((err: Error) => {
    const prev = previousRainPrevDay(today, prevFile)
    if (prev === null) throw err
    console.warn(`[forecast] ASOS 실패, 이전 예보의 오늘 rainPrevDay(${prev}mm)를 씀: ${err.message}`)
    process.exitCode = 1 // 저장·커밋은 하되 작업은 실패로 표시해 알아채게 한다
    return prev
  })
  const updated = `${dashed(baseDate)}T${baseTime.slice(0, 2)}:${baseTime.slice(2)}+09:00`
  return buildForecast(items, today, observed, updated)
}
