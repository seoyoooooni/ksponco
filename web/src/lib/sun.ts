import { parseTime, sunPosition as engineSun, sunsetTime } from './engine'

export type SunPosition = {
  altitude: number
  azimuth: number
  direction: [number, number, number]
}

export function dayOfYear(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1
}

function clock(hour: number): string {
  const total = hour * 60
  const h = Math.floor(total / 60)
  return `${h}:${total - h * 60}`
}

export function sunPosition(date: string, hour: number): SunPosition {
  const s = engineSun(date, clock(hour))
  return { altitude: s.altitude, azimuth: s.azimuth, direction: s.dir }
}

export function sunsetHour(date: string): number | null {
  return parseTime(sunsetTime(date)) / 60
}
