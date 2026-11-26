import type { ReactNode } from 'react'
import { BottomSheet, type SheetSnap } from '../../ui/BottomSheet'
import { TimeRange, type StripState } from '../../ui/TimeRange'
import { Toggle } from '../../ui/Toggle'
import { rangeLabel } from '../../lib/format'
import type { SunPref } from '../../lib/comfort'
import { Notes, type Note } from '../../ui/Notes'

type Props = {
  snap: SheetSnap
  onSnap: (v: SheetSnap) => void
  onVisibleHeight: (h: number) => void
  closure: { title: string; sub: string } | null
  hint: string | null
  duration: number | 'custom'
  onDuration: (h: number) => void
  stay: [number, number]
  strip: StripState[]
  hour: number
  headline: string
  pref: SunPref
  onPref: (v: SunPref) => void
  onStay: (from: number, to: number) => void
  onHour: (h: number) => void
  playing: boolean
  onPlay: () => void
  sunset: { at: number; label: string } | null
  notes: Note[]
  footer?: ReactNode
}

export function EverydaySheet(p: Props) {
  if (p.closure) {
    return (
      <BottomSheet label="출입 제한 안내" snap={1} onVisibleHeight={p.onVisibleHeight} footer={p.footer}>
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
      footer={p.footer}
      more={
        <div className="section section--plain">
          <div className="section__head">
            <span>머무는 시간</span>
            <span>{rangeLabel(p.stay[0], p.stay[1])}</span>
          </div>
          <TimeRange from={p.stay[0]} to={p.stay[1]} strip={p.strip} cursor={p.hour} onChange={p.onStay} onCursor={p.onHour} playing={p.playing} onPlay={p.onPlay} sunset={p.sunset} />
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
      {p.hint && <p className="plain-line">{p.hint}</p>}
      <Notes notes={p.notes} />
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
