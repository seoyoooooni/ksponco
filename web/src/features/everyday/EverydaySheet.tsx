import { BottomSheet, type SheetSnap } from '../../ui/BottomSheet'
import { PillButton } from '../../ui/Buttons'
import { EyeIcon } from '../../ui/icons'
import { TimeRange, type StripState } from '../../ui/TimeRange'
import { Toggle } from '../../ui/Toggle'
import { rangeLabel } from '../../lib/format'
import type { SunPref } from '../../lib/comfort'

export type SpotItem = {
  name: string
  meta: string
}

type Props = {
  snap: SheetSnap
  onSnap: (v: SheetSnap) => void
  onVisibleHeight: (h: number) => void
  closure: { title: string; sub: string } | null
  spots: SpotItem[]
  onSpot: (i: number) => void
  sunsetText: string
  duration: number | 'custom'
  onDuration: (h: number) => void
  stay: [number, number]
  strip: StripState[]
  hour: number
  headline: string
  canFirstPerson: boolean
  pref: SunPref
  onPref: (v: SunPref) => void
  onFirstPerson: () => void
  onStay: (from: number, to: number) => void
  onHour: (h: number) => void
  playing: boolean
  onPlay: () => void
}

export function EverydaySheet(p: Props) {
  if (p.closure) {
    return (
      <BottomSheet label="출입 제한 안내" snap={1} onVisibleHeight={p.onVisibleHeight}>
        <div className="closure">
          <span className="eyebrow">출입 제한</span>
          <h1 className="headline">{p.closure.title}</h1>
          <p style={{ color: 'var(--color-mute)' }}>{p.closure.sub}</p>
        </div>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet
      label="그늘 자리 찾기"
      snap={p.snap}
      onSnap={p.onSnap}
      onVisibleHeight={p.onVisibleHeight}
      more={
        <div className="section section--plain">
          <div className="section__head">
            <span>머무는 시간</span>
            <span>{rangeLabel(p.stay[0], p.stay[1])}</span>
          </div>
          <TimeRange from={p.stay[0]} to={p.stay[1]} strip={p.strip} cursor={p.hour} onChange={p.onStay} onCursor={p.onHour} playing={p.playing} onPlay={p.onPlay} />
          <PillButton
            variant="primary"
            style={{ height: 52, fontSize: 16, fontWeight: 700, marginTop: 8 }}
            icon={<EyeIcon />}
            disabled={!p.canFirstPerson}
            onClick={p.onFirstPerson}
          >
            내 시점으로 보기
          </PillButton>
        </div>
      }
    >
      <Toggle
        label="찾는 자리"
        value={p.pref}
        options={[
          { value: 'shade', label: '그늘' },
          { value: 'sun', label: '볕' },
        ]}
        onChange={p.onPref}
      />
      <h1 className="headline">{p.headline}</h1>
      {p.spots.length > 0 && (
        <div className="spot-btns" role="group" aria-label="추천 자리">
          {p.spots.map((s, i) => (
            <button key={i} type="button" className="spot-btn" aria-label={`${i + 1}번 추천 자리로 옮기기, ${s.meta}`} onClick={() => p.onSpot(i)}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
      {p.spots.length === 0 && (
        <p className="plain-line">{p.pref === 'shade' ? '이 시간엔 계속 그늘인 곳이 없어요. 시간을 바꿔 보세요.' : '이 시간엔 계속 볕이 드는 곳이 없어요. 시간을 바꿔 보세요.'}</p>
      )}
      <p className="plain-line">{p.sunsetText}</p>
      <Toggle
        label="머무는 시간"
        value={p.duration}
        options={[
          { value: 1, label: '1시간' },
          { value: 2, label: '2시간' },
          { value: 3, label: '3시간' },
          { value: 'custom', label: '직접' },
        ]}
        onChange={(v) => (v === 'custom' ? p.onSnap(2) : p.onDuration(v))}
      />
    </BottomSheet>
  )
}
