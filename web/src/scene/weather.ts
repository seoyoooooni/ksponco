import { Color } from 'three'
import type { ForecastDay, RainHourly } from '../data/types'

export type WeatherInput = { day: ForecastDay | null; hourly: RainHourly | null }

export type SceneWeather = { cloud: number; overcast: number; rain: number }

const CLEAR: SceneWeather = { cloud: 0.12, overcast: 0, rain: 0 }

function rainAt(hourly: RainHourly | null, date: string, hour: number): number | null {
  if (!hourly) return null
  const at = (Date.parse(`${date}T00:00+09:00`) - Date.parse(hourly.start)) / 3_600_000 + Math.floor(hour)
  for (let i = Math.floor(at); i >= Math.floor(at) - 2; i--) {
    if (i < 0 || i >= hourly.mm.length) return null
    const v = hourly.mm[i]
    if (v != null) return v
  }
  return null
}

export function sceneWeather(input: WeatherInput | null, date: string, hour: number): SceneWeather {
  const day = input?.day
  if (!day) return CLEAR
  const base: SceneWeather =
    day.sky === '흐림' ? { cloud: 1, overcast: 0.85, rain: 0 } : day.sky === '구름많음' ? { cloud: 0.6, overcast: 0.3, rain: 0 } : CLEAR
  const mm = rainAt(input?.hourly ?? null, date, hour)
  if (mm && mm > 0) return { cloud: 1, overcast: 1, rain: Math.min(1, 0.45 + mm / 6) }
  if (mm == null && day.rain) return { ...base, cloud: Math.max(base.cloud, 0.8), overcast: Math.max(base.overcast, 0.7) }
  return base
}

type Key = { alt: number; zen: string; hor: string; glow: string; amt: number }

const KEYS: Key[] = [
  { alt: 20, zen: '#8fc3e3', hor: '#cfe6f0', glow: '#fff3da', amt: 0 },
  { alt: 8, zen: '#86b8dc', hor: '#d3e2ea', glow: '#ffd79a', amt: 0.3 },
  { alt: 2, zen: '#6f9bc8', hor: '#d6d6dc', glow: '#ffa95c', amt: 0.85 },
  { alt: -1, zen: '#56739f', hor: '#c6b6c2', glow: '#ff8549', amt: 1 },
  { alt: -4, zen: '#33467a', hor: '#8c809c', glow: '#e0685c', amt: 0.7 },
  { alt: -8, zen: '#18233f', hor: '#34436a', glow: '#8a5a78', amt: 0.22 },
  { alt: -12, zen: '#0c1324', hor: '#22304a', glow: '#22304a', amt: 0 },
]

export type SkyTone = { zenith: Color; horizon: Color; glow: Color; amount: number; disc: number }

function grey(c: Color, k: number, tint: Color): Color {
  const l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722
  return c.lerp(new Color(l, l, l).multiply(tint), k)
}

const OVERCAST_TINT = new Color('#f2f5f8')

export function skyTone(alt: number, w: SceneWeather): SkyTone {
  let i = KEYS.findIndex((k) => alt >= k.alt)
  if (i === -1) i = KEYS.length
  const a = KEYS[Math.max(0, i - 1)]
  const b = KEYS[Math.min(KEYS.length - 1, i)]
  const t = a === b ? 0 : (a.alt - alt) / (a.alt - b.alt)
  const zenith = new Color(a.zen).lerp(new Color(b.zen), t)
  const horizon = new Color(a.hor).lerp(new Color(b.hor), t)
  const glow = new Color(a.glow).lerp(new Color(b.glow), t)
  let amount = a.amt + (b.amt - a.amt) * t
  const ov = w.overcast * 0.85
  grey(zenith, ov, OVERCAST_TINT)
  grey(horizon, ov, OVERCAST_TINT)
  const dim = 1 - 0.28 * w.rain - 0.08 * w.overcast
  zenith.multiplyScalar(dim)
  horizon.multiplyScalar(dim)
  amount *= 1 - 0.85 * w.overcast
  const disc = (1 - w.overcast) * Math.min(1, Math.max(0, (alt + 1.5) / 2))
  return { zenith, horizon, glow, amount, disc }
}
