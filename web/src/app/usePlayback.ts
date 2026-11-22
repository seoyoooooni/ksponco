import { useEffect } from 'react'
import { sceneStore, useScene } from '../store/sceneStore'

export function usePlayback() {
  const playing = useScene((s) => s.playing)

  useEffect(() => {
    if (!playing) return
    const { stay, hour } = sceneStore.get()
    if (hour >= stay[1] - 0.05) sceneStore.set({ hour: stay[0] })
    const id = window.setInterval(() => {
      const s = sceneStore.get()
      const next = s.hour + 0.04
      if (next >= s.stay[1]) sceneStore.set({ hour: s.stay[1], playing: false })
      else sceneStore.set({ hour: next })
    }, 50)
    return () => window.clearInterval(id)
  }, [playing])
}
