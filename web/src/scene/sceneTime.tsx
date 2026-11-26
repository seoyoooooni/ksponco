import { useFrame } from '@react-three/fiber'

export const sceneTime = { value: 0 }

export const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function SceneClock() {
  useFrame(({ clock }) => {
    if (!reducedMotion) sceneTime.value = clock.elapsedTime
  })
  return null
}
