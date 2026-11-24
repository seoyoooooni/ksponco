import { BottomSheet, type SheetSnap } from '../../ui/BottomSheet'
import { PillButton } from '../../ui/Buttons'
import { EyeIcon } from '../../ui/icons'
import { TimeRange, type StripState } from '../../ui/TimeRange'
import { rangeLabel } from '../../lib/format'

export type AudienceStats = {
  stage: string
  distance: string
  screen: string
  sun: string
}

type Props = {
  snap: SheetSnap
  onSnap: (v: SheetSnap) => void
  onVisibleHeight: (h: number) => void
  headline: string
  stats: AudienceStats | null
  stay: [number, number]
  strip: StripState[]
  hour: number
  onStay: (from: number, to: number) => void
  onHour: (h: number) => void
  canFirstPerson: boolean
  onFirstPerson: () => void
  playing: boolean
  onPlay: () => void
}

export function AudienceSheet(p: Props) {
  return (
    <BottomSheet
      label="내 자리 결과"
      snap={p.snap}
      onSnap={p.onSnap}
      onVisibleHeight={p.onVisibleHeight}
      more={
        <>
          <div className="section section--plain">
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
              playing={p.playing}
              onPlay={p.onPlay}
            />
          </div>
          <PillButton
            variant="primary"
            style={{ height: 52, fontSize: 16, fontWeight: 700 }}
            icon={<EyeIcon />}
            disabled={!p.canFirstPerson}
            onClick={p.onFirstPerson}
          >
            내 시점으로 보기
          </PillButton>
        </>
      }
    >
      <h1 className="headline">{p.headline}</h1>
      <div className="stats">
        <div className="stat">
          <span className="stat__label">무대</span>
          <span className="stat__value">{p.stats?.stage ?? '—'}</span>
        </div>
        <div className="stat">
          <span className="stat__label">스크린</span>
          <span className="stat__value">{p.stats?.screen ?? '—'}</span>
        </div>
        <div className="stat">
          <span className="stat__label">햇볕</span>
          <span className="stat__value">{p.stats?.sun ?? '—'}</span>
        </div>
      </div>
    </BottomSheet>
  )
}
