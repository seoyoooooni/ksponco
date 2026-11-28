import { useMemo } from 'react'
import { sunPosition } from '../lib/sun'
import { useScene } from '../store/sceneStore'

export function nightOf(altitude: number): number {
  const t = Math.min(1, Math.max(0, (3 - altitude) / 9))
  return t * t * (3 - 2 * t)
}

export function useNight(): number {
  const date = useScene((s) => s.date)
  const hour = useScene((s) => s.hour)
  return useMemo(() => nightOf(sunPosition(date, hour).altitude), [date, hour])
}
