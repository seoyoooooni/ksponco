import type { Forecast } from '../data/types'
import type { SunState } from './analysis'

export type SunPref = 'shade' | 'sun'

const SHADE_FROM = 20
const HOT_FROM = 25

const SEOUL_NORMAL_MAX = [2.1, 5.1, 11.0, 17.9, 23.6, 27.6, 29.0, 30.0, 26.2, 20.2, 11.9, 4.2]

export function dayTempMax(date: string, forecast: Forecast | null, eventTemp: number | null): number {
  const day = forecast?.days.find((d) => d.date === date)
  if (day) return day.tempMax
  if (eventTemp !== null) return eventTemp
  return SEOUL_NORMAL_MAX[Number(date.slice(5, 7)) - 1]
}

export function autoPref(tempMax: number): SunPref {
  return tempMax < SHADE_FROM ? 'sun' : 'shade'
}

export function prefWeight(tempMax: number, chosen: boolean): number {
  if (chosen || tempMax >= HOT_FROM || tempMax < SHADE_FROM) return 0.4
  return 0.2
}

export function comfort(shadeOfDaylight: number | null, pref: SunPref): number {
  if (shadeOfDaylight === null) return 0.5
  return pref === 'shade' ? shadeOfDaylight : 1 - shadeOfDaylight
}

export function stripShade(strip: SunState[]): number | null {
  const day = strip.filter((v) => v !== 0).length
  return day ? strip.filter((v) => v === 1).length / day : null
}
