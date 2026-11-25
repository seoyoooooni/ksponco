import { useRef } from 'react'
import { PauseIcon, PlayIcon, SunsetIcon } from './icons'

export type StripState = 0 | 1 | 2

type Props = {
  min?: number
  max?: number
  step?: number
  from: number
  to: number
  strip: StripState[]
  cursor?: number | null
  minSpan?: number
  onChange: (from: number, to: number) => void
  onCursor?: (hour: number) => void
  playing?: boolean
  onPlay?: () => void
  sunset?: { at: number; label: string } | null
}

const STATE_CLASS = ['is-night', 'is-shade', 'is-sun'] as const

function runs(strip: StripState[]): { state: StripState; n: number }[] {
  const out: { state: StripState; n: number }[] = []
  for (const s of strip) {
    const last = out[out.length - 1]
    if (last && last.state === s) last.n++
    else out.push({ state: s, n: 1 })
  }
  return out
}

export function TimeRange({
  min = 9,
  max = 22,
  step = 0.25,
  from,
  to,
  strip,
  cursor = null,
  minSpan = 0.5,
  onChange,
  onCursor,
  playing = false,
  onPlay,
  sunset = null,
}: Props) {
  const track = useRef<HTMLDivElement>(null)
  const span = max - min
  const pct = (h: number) => `${((h - min) / span) * 100}%`

  const valueAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect()
    const raw = min + ((clientX - r.left) / r.width) * span
    return Math.min(max, Math.max(min, Math.round(raw / step) * step))
  }

  const dragHandle = (which: 'from' | 'to') => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const move = (ev: PointerEvent) => {
      const v = valueAt(ev.clientX)
      if (which === 'from') onChange(Math.min(v, to - minSpan), to)
      else onChange(from, Math.max(v, from + minSpan))
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
  }

  const nudge = (which: 'from' | 'to') => (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : 0
    if (!d) return
    e.preventDefault()
    if (which === 'from') onChange(Math.max(min, Math.min(from + d, to - minSpan)), to)
    else onChange(from, Math.min(max, Math.max(to + d, from + minSpan)))
  }

  return (
    <div className={`timerange${sunset ? ' timerange--marked' : ''}`}>
      {onPlay && (
        <button
          type="button"
          className="timerange__play"
          aria-label={playing ? '그림자 재생 멈춤' : '하루 그림자 재생'}
          aria-pressed={playing}
          onClick={onPlay}
        >
          {playing ? <PauseIcon size={14} /> : <PlayIcon size={14} />}
        </button>
      )}
      <div
        ref={track}
        className="timerange__track"
        onClick={(e) => {
          if (!onCursor) return
          const v = valueAt(e.clientX)
          if (v >= from && v <= to) onCursor(v)
        }}
      >
        <div className="timerange__bar">
          <i className="timerange__seg is-off" style={{ flex: (from - min) / step }} />
          {runs(strip).map((r, i) => (
            <i key={i} className={`timerange__seg ${STATE_CLASS[r.state]}`} style={{ flex: r.n }} />
          ))}
          <i className="timerange__seg is-off" style={{ flex: (max - to) / step }} />
        </div>
        {sunset && sunset.at > min && sunset.at < max && (
          <>
            <i className="timerange__dusk" style={{ left: pct(sunset.at) }} aria-hidden="true" />
            <span className="timerange__mark" style={{ left: pct(sunset.at) }} aria-label={`해 지는 시각 ${sunset.label}`}>
              <SunsetIcon size={12} />
              {sunset.label}
            </span>
          </>
        )}
        {cursor !== null && cursor >= from && cursor <= to && (
          <i className="timerange__cursor" style={{ left: pct(cursor) }} aria-hidden="true" />
        )}
        <button
          type="button"
          role="slider"
          aria-label="머무는 시작 시각"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={from}
          className="timerange__handle"
          style={{ left: pct(from) }}
          onPointerDown={dragHandle('from')}
          onKeyDown={nudge('from')}
        />
        <button
          type="button"
          role="slider"
          aria-label="머무는 끝 시각"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={to}
          className="timerange__handle"
          style={{ left: pct(to) }}
          onPointerDown={dragHandle('to')}
          onKeyDown={nudge('to')}
        />
      </div>
    </div>
  )
}
