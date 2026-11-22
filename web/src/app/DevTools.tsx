import { useState } from 'react'
import { MAX_CROWD_SCALE } from '../lib/crowd'
import { personStyleIds, personStyles, type PersonStyleId } from '../scene/personStyles'
import { sceneStore, useScene } from '../store/sceneStore'

export function DevTools() {
  const [open, setOpen] = useState(false)
  const crowdScale = useScene((s) => s.crowdScale)
  const crowdCount = useScene((s) => s.crowdCount)
  const personStyle = useScene((s) => s.personStyle)

  return (
    <div className="dev">
      <button type="button" className="fp-tag" style={{ border: 'none' }} onClick={() => setOpen(!open)} aria-expanded={open}>
        개발 도구
      </button>
      {open && (
        <div className="dev__panel">
          <label style={{ display: 'grid', gap: 4, fontWeight: 700 }}>
            <span>사람 모양</span>
            <select
              value={personStyle}
              onChange={(e) => sceneStore.set({ personStyle: e.target.value as PersonStyleId })}
              style={{ height: 40, borderRadius: 10, border: '1.5px solid var(--color-line)', padding: '0 8px', background: 'var(--color-surface)' }}
            >
              {personStyleIds.map((id) => (
                <option key={id} value={id}>
                  {personStyles[id].label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: 'grid', gap: 4, fontWeight: 700 }}>
            <span style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>관객 밀도 {Math.round(crowdScale * 100)}%</span>
              <span style={{ fontWeight: 400, color: 'var(--color-mute)' }}>약 {crowdCount.toLocaleString()}명</span>
            </span>
            <input
              className="range"
              type="range"
              min={0}
              max={MAX_CROWD_SCALE}
              step={0.05}
              value={crowdScale}
              onChange={(e) => sceneStore.set({ crowdScale: Number(e.target.value) })}
            />
          </label>
        </div>
      )}
    </div>
  )
}
