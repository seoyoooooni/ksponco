import { PillButton } from '../../ui/Buttons'
import { ChevronLeft } from '../../ui/icons'
import { Toggle } from '../../ui/Toggle'
import type { AudienceStats } from './AudienceSheet'

type Props = {
  lines: [string, string?]
  stats: AudienceStats | null
  eyeHeight: number
  onEye: (h: number) => void
  onBack: () => void
  away: boolean
  onRecenter: () => void
  recenterLabel: string
}

export function FirstPersonOverlay(p: Props) {
  return (
    <>
      <div className="fp-top">
        <button type="button" className="fab-round" aria-label="돌아가기" title="돌아가기" onClick={p.onBack}>
          <ChevronLeft size={22} />
        </button>
        {p.away && (
          <PillButton variant="light" onClick={p.onRecenter}>
            {p.recenterLabel}
          </PillButton>
        )}
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
