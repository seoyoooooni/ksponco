import { loadEvents, loadLayout, loadVenueBundle } from '../data/load'
import { useLoad } from '../data/useLoad'
import { SceneCanvas } from '../scene/SceneCanvas'

export function App() {
  const state = useLoad(async () => {
    const [bundle, events] = await Promise.all([loadVenueBundle('lawn88'), loadEvents()])
    const event = events[0]
    const layout = await loadLayout(bundle.venue, event?.layout ?? null)
    return { bundle, events, layout }
  }, [])

  return (
    <>
      <SceneCanvas />
      <p
        style={{
          position: 'fixed',
          left: 'var(--space-3)',
          bottom: 'calc(var(--space-3) + var(--safe-bottom))',
          padding: 'var(--space-2) var(--space-3)',
          borderRadius: 'var(--radius-pill)',
          background: 'var(--color-surface)',
          fontSize: 'var(--text-sm)',
          pointerEvents: 'none',
        }}
      >
        {state.status === 'loading' && '데이터 불러오는 중…'}
        {state.status === 'error' && state.error.message}
        {state.status === 'ready' &&
          `${state.data.bundle.venue.name} · 나무 ${state.data.bundle.trees.length} · 배치 ${state.data.layout.id}`}
      </p>
    </>
  )
}
