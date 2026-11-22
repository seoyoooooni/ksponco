import { useSyncExternalStore } from 'react'

export const WIDE_QUERY = '(min-width: 900px)'

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query)
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

export function useWide(): boolean {
  return useMediaQuery(WIDE_QUERY)
}
