import { BottomSheet, type SheetSnap } from '../../ui/BottomSheet'
import { ChevronRight } from '../../ui/icons'
import { TimeRange, type StripState } from '../../ui/TimeRange'
import { Toggle } from '../../ui/Toggle'
import { rangeLabel } from '../../lib/format'

export type SpotItem = {
  name: string
  meta: string
}

type Props = {
  snap: SheetSnap
  onSnap: (v: SheetSnap) => void
  onVisibleHeight: (h: number) => void
  closure: { title: string; sub: string } | null
  headline: string
  spots: SpotItem[]
  onSpot: (i: number) => void
  sunsetText: string
  duration: number | 'custom'
  onDuration: (h: number) => void
  stay: [number, number]
  strip: StripState[]
  hour: number
  myMatText: string | null
  onStay: (from: number, to: number) => void
  onHour: (h: number) => void
  onSources: () => void
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
        <button type="button" className="link-small" onClick={p.onSources}>
          데이터 출처
        </button>
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
        <div className="section">
          <div className="section__head">
            <span>머무는 시간</span>
            <span>{rangeLabel(p.stay[0], p.stay[1])}</span>
          </div>
          <TimeRange from={p.stay[0]} to={p.stay[1]} strip={p.strip} cursor={p.hour} onChange={p.onStay} onCursor={p.onHour} />
          {p.myMatText && <p style={{ fontSize: 13 }}>{p.myMatText}</p>}
        </div>
      }
    >
      <h1 className="headline" style={{ marginTop: -4 }}>
        {p.headline}
      </h1>
      {p.spots.length > 0 ? (
        <ol className="spot-list">
          {p.spots.map((s, i) => (
            <li key={i}>
              <button type="button" className="spot" onClick={() => p.onSpot(i)}>
                <span className="spot__no">{i + 1}</span>
                <span className="spot__text">
                  <b>{s.name}</b>
                  <span>{s.meta}</span>
                </span>
                <ChevronRight size={16} />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="plain-line">이 시간엔 계속 그늘인 곳이 없어요. 시간을 바꿔 보세요.</p>
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
      <button type="button" className="link-small" onClick={p.onSources}>
        데이터 출처
      </button>
    </BottomSheet>
  )
}
