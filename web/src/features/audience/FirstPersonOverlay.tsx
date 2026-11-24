import { PillButton } from '../../ui/Buttons'
import { ChevronLeft } from '../../ui/icons'
import { Toggle } from '../../ui/Toggle'
import { timeLabel } from '../../lib/format'
import type { AudienceStats } from './AudienceSheet'

type Props = {
  lines: [string, string?]
  stats: AudienceStats | null
  hour: number
  range: [number, number]
  onHour: (h: number) => void
  eyeHeight: number
  onEye: (h: number) => void
  onBack: () => void
}

export function FirstPersonOverlay(p: Props) {
  return (
    <>
      <div className="fp-top">
        <PillButton variant="light" icon={<ChevronLeft size={18} />} onClick={p.onBack}>
          돌아가기
        </PillButton>
        <span className="fp-tag">내 돗자리 · {p.eyeHeight < 1 ? '앉은' : '선'} 눈높이 {p.eyeHeight}m</span>
      </div>
      <section aria-label="이 시점에서 보이는 것" className="fp-card">
        <h1 className="headline">
          {p.lines[0]}
          {p.lines[1] && (
            <>
              <br />
              {p.lines[1]}
            </>
          )}
        </h1>
        {p.stats && (
          <div className="stats">
            <div className="stat">
              <span className="stat__label">무대</span>
              <span className="stat__value">{p.stats.stage}</span>
            </div>
            <div className="stat">
              <span className="stat__label">스크린</span>
              <span className="stat__value">{p.stats.screen}</span>
            </div>
            <div className="stat">
              <span className="stat__label">거리</span>
              <span className="stat__value">{p.stats.distance}</span>
            </div>
          </div>
        )}
        <label style={{ display: 'grid', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 700 }}>
          <span style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>그림자 시각</span>
            <span style={{ color: 'var(--color-mute)' }}>{timeLabel(p.hour)}</span>
          </span>
          <input
            className="range"
            type="range"
            min={p.range[0]}
            max={p.range[1]}
            step={0.25}
            value={p.hour}
            onChange={(e) => p.onHour(Number(e.target.value))}
          />
        </label>
        <Toggle
          label="눈높이"
          value={p.eyeHeight < 1 ? 'sit' : 'stand'}
          options={[
            { value: 'sit', label: '앉아서 0.8m' },
            { value: 'stand', label: '서서 1.6m' },
          ]}
          onChange={(v) => p.onEye(v === 'sit' ? 0.8 : 1.6)}
        />
      </section>
    </>
  )
}
