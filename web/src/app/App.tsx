import { loadEvents, loadLayout, loadVenueBundle } from '../data/load'
import { useLoad } from '../data/useLoad'

export function App() {
  const state = useLoad(async () => {
    const [bundle, events] = await Promise.all([loadVenueBundle('lawn88'), loadEvents()])
    const event = events[0]
    const layout = await loadLayout(bundle.venue, event?.layout ?? null)
    return { bundle, events, layout }
  }, [])

  return (
    <main style={{ padding: 'var(--space-5)', display: 'grid', gap: 'var(--space-3)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 'var(--text-2xl)' }}>app name</h1>
      {state.status === 'loading' && <p>데이터 불러오는 중…</p>}
      {state.status === 'error' && <p style={{ color: 'var(--color-warn)' }}>{state.error.message}</p>}
      {state.status === 'ready' && (
        <ul style={{ margin: 0, paddingLeft: 'var(--space-5)', lineHeight: 1.8 }}>
          <li>장소: {state.data.bundle.venue.name}</li>
          <li>
            지형: {state.data.bundle.terrain.nx} × {state.data.bundle.terrain.nz} 칸
          </li>
          <li>나무: {state.data.bundle.trees.length}그루</li>
          <li>건물: {state.data.bundle.buildings.length}개</li>
          <li>공연: {state.data.events.length}개</li>
          <li>
            첫 공연 배치: {state.data.layout.id} ({state.data.layout.source})
          </li>
        </ul>
      )}
    </main>
  )
}
