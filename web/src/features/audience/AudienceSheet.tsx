import { BottomSheet } from '../../ui/BottomSheet'
import { PillButton } from '../../ui/Buttons'
import { EyeIcon } from '../../ui/icons'
import { TimeRange, type StripState } from '../../ui/TimeRange'
import { Toggle } from '../../ui/Toggle'
import { rangeLabel } from '../../lib/format'

export type AudienceStats = {
  stage: string
  stageLabel: string
  screen: string
  sun: string
}

type Props = {
  expanded: boolean
  onExpandedChange: (v: boolean) => void
  headline: string
  notes: string[]
  stats: AudienceStats | null
  stay: [number, number]
  strip: StripState[]
  hour: number
  onStay: (from: number, to: number) => void
  onHour: (h: number) => void
  eyeHeight: number
  onEye: (h: number) => void
  canFirstPerson: boolean
  onFirstPerson: () => void
  onSources: () => void
}

export function AudienceSheet(p: Props) {
  return (
    <BottomSheet
      label="내 자리 결과"
      expanded={p.expanded}
      onExpandedChange={p.onExpandedChange}
      more={
        <>
          <div className="section">
            <div className="section__head">
              <span>머무는 시간</span>
              <span>{rangeLabel(p.stay[0], p.stay[1])}</span>
            </div>
            <TimeRange
              from={p.stay[0]}
              to={p.stay[1]}
              strip={p.strip}
              cursor={p.hour}
              onChange={p.onStay}
              onCursor={p.onHour}
            />
          </div>
          <div className="row">
            <Toggle
              label="눈높이"
              value={p.eyeHeight < 1 ? 'sit' : 'stand'}
              options={[
                { value: 'sit', label: '앉아서' },
                { value: 'stand', label: '서서' },
              ]}
              onChange={(v) => p.onEye(v === 'sit' ? 0.8 : 1.6)}
            />
            <PillButton
              variant="primary"
              className="grow"
              style={{ height: 50, fontSize: 17 }}
              icon={<EyeIcon />}
              disabled={!p.canFirstPerson}
              onClick={p.onFirstPerson}
            >
              내 눈높이로 보기
            </PillButton>
          </div>
        </>
      }
    >
      <div className="headline-block">
        <h1 className="headline">{p.headline}</h1>
        {p.notes.map((n) => (
          <p key={n} className="headline-note">
            {n}
          </p>
        ))}
      </div>
      <div className="stats">
        <div className="stat">
          <span className="stat__label">{p.stats?.stageLabel ?? '무대'}</span>
          <span className="stat__value">{p.stats?.stage ?? '—'}</span>
        </div>
        <div className="stat">
          <span className="stat__label">스크린</span>
          <span className="stat__value is-shade">{p.stats?.screen ?? '—'}</span>
        </div>
        <div className="stat">
          <span className="stat__label">햇볕</span>
          <span className="stat__value">{p.stats?.sun ?? '—'}</span>
        </div>
      </div>
      <button type="button" className="link-small" onClick={p.onSources} style={{ order: 99 }}>
        데이터 출처
      </button>
    </BottomSheet>
  )
}
