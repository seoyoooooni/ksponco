export type Place = {
  lat: number
  lon: number
}

export type SunPosition = {
  altitude: number
  azimuth: number
  direction: [number, number, number]
}

export const SEOUL: Place = { lat: 37.52, lon: 127.12 }

const RAD = Math.PI / 180
const KST_MERIDIAN = 135

export function dayOfYear(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86400000) + 1
}

export function sunPosition(date: string, hour: number, place: Place = SEOUL): SunPosition {
  const B = (360 / 365) * (dayOfYear(date) - 81) * RAD
  const decl = 23.44 * Math.sin(B) * RAD
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B)
  const solarHour = hour + (4 * (place.lon - KST_MERIDIAN) + eot) / 60
  const H = 15 * (solarHour - 12) * RAD
  const phi = place.lat * RAD
  const alt = Math.asin(Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(H))
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(decl) * Math.cos(phi)) + Math.PI
  const c = Math.cos(alt)
  return {
    altitude: alt / RAD,
    azimuth: az / RAD,
    direction: [c * Math.sin(az), Math.sin(alt), -c * Math.cos(az)],
  }
}

export function sunsetHour(date: string, place: Place = SEOUL): number | null {
  for (let h = 12; h < 23; h += 1 / 60) {
    if (sunPosition(date, h, place).altitude <= 0) return h
  }
  return null
}
