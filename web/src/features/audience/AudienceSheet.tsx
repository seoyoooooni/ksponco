import type { ReactNode } from 'react'
import { BottomSheet, type SheetSnap } from '../../ui/BottomSheet'
import { TimeRange, type StripState } from '../../ui/TimeRange'
import { rangeLabel } from '../../lib/format'
import type { SunPref } from '../../lib/comfort'
import { Toggle } from '../../ui/Toggle'
import { Notes, type Note } from '../../ui/Notes'

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
  pref: SunPref
  onPref: (v: SunPref) => void
  stats: AudienceStats | null
  stay: [number, number]
  strip: StripState[]
  hour: number
  onStay: (from: number, to: number) => void
  onHour: (h: number) => void
  playing: boolean
  onPlay: () => void
  sunset: { at: number; label: string } | null
  notes: Note[]
  hours: [number, number]
  footer?: ReactNode
}

export function AudienceSheet(p: Props) {
  return (
    <BottomSheet
      label="내 자리 결과"
      snap={p.snap}
      onSnap={p.onSnap}
      onVisibleHeight={p.onVisibleHeight}
      footer={p.footer}
      more={
        <>
          <div className="section section--plain">
            <div className="section__head">
              <span>머무는 시간</span>
              <span>{rangeLabel(p.stay[0], p.stay[1])}</span>
            </div>
            <TimeRange
              min={p.hours[0]}
              max={p.hours[1]}
              from={p.stay[0]}
              to={p.stay[1]}
              strip={p.strip}
              cursor={p.hour}
              onChange={p.onStay}
              onCursor={p.onHour}
              playing={p.playing}
              onPlay={p.onPlay}
              sunset={p.sunset}
            />
          </div>
        </>
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
      <Notes notes={p.notes} />
    </BottomSheet>
  )
}
