import { useEffect, useMemo, useState } from 'react'
import type { Closure, EventItem, VenueId } from '../../data/types'
import { dateLabel, parseClock, parseDate, rangeLabel, shortDateLabel } from '../../lib/format'
import { Calendar } from '../../ui/Calendar'
import { ModalSheet } from '../../ui/ModalSheet'
import { Toggle } from '../../ui/Toggle'

type Props = {
  open: boolean
  onClose: () => void
  venue: VenueId
  onVenue: (v: VenueId) => void
  venuesReady: VenueId[]
  date: string
  today: string
  events: EventItem[]
  closures: Closure[]
  onApply: (date: string) => void
}

function closedOn(closures: Closure[], date: string): Closure | null {
  return closures.find((c) => c.from <= date && date <= c.to) ?? null
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  const a = parseDate(from)
  const b = parseDate(to)
  const t0 = Date.UTC(a.y, a.m - 1, a.d)
  const t1 = Date.UTC(b.y, b.m - 1, b.d)
  for (let t = t0; t <= t1; t += 86400000) out.push(new Date(t).toISOString().slice(0, 10))
  return out
}

export function PlacePicker(p: Props) {
  const [selected, setSelected] = useState(p.date)
  const [month, setMonth] = useState(() => {
    const d = parseDate(p.date)
    return { y: d.y, m: d.m }
  })

  useEffect(() => {
    if (!p.open) return
    setSelected(p.date)
    const d = parseDate(p.date)
    setMonth({ y: d.y, m: d.m })
  }, [p.open, p.date])

  const venueEvents = useMemo(() => p.events.filter((e) => e.venue === p.venue).sort((a, b) => a.date.localeCompare(b.date)), [p.events, p.venue])
  const venueClosures = useMemo(() => p.closures.filter((c) => c.venue === p.venue), [p.closures, p.venue])
  const eventDays = useMemo(() => new Set(venueEvents.map((e) => e.date)), [venueEvents])
  const closedDays = useMemo(() => new Set(venueClosures.flatMap((c) => eachDay(c.from, c.to))), [venueClosures])

  const chips = venueEvents.filter((e) => e.date >= p.today).slice(0, 3)

  const event = venueEvents.find((e) => e.date === selected) ?? null
  const closure = closedOn(venueClosures, selected)

  const info = event
    ? { title: event.name, sub: rangeLabel(parseClock(event.start), parseClock(event.end)) }
    : closure
      ? { title: '출입 제한', sub: closure.reason }
      : { title: '공연 없는 날', sub: '' }
  const sel = parseDate(selected)
  const same = selected === p.date

  return (
    <ModalSheet label="장소와 날짜 고르기" open={p.open} onClose={p.onClose}>
      <Toggle
        label="장소"
        value={p.venue}
        options={[
          { value: 'lawn88', label: '88잔디마당', disabled: !p.venuesReady.includes('lawn88') },
          { value: 'lake', label: p.venuesReady.includes('lake') ? '88호수 수변무대' : '수변무대 · 준비 중', disabled: !p.venuesReady.includes('lake') },
        ]}
        onChange={p.onVenue}
      />
      {chips.length > 0 && (
        <div style={{ display: 'grid', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>다가오는 공연</span>
          <div className="chips">
            {chips.map((e) => (
              <button
                key={e.id}
                type="button"
                className="chip"
                aria-pressed={e.date === selected}
                onClick={() => {
                  setSelected(e.date)
                  const d = parseDate(e.date)
                  setMonth({ y: d.y, m: d.m })
                }}
              >
                <b>{shortDateLabel(e.date)}</b>
                {e.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="section">
        <Calendar
          month={month}
          selected={selected}
          today={p.today}
          eventDays={eventDays}
          closedDays={closedDays}
          onSelect={setSelected}
          onMonth={(delta) =>
            setMonth((m) => {
              const t = m.m - 1 + delta
              return { y: m.y + Math.floor(t / 12), m: ((t % 12) + 12) % 12 + 1 }
            })
          }
        />
      </div>
      <div className="day-info" aria-live="polite">
        <span className="day-info__date">{dateLabel(selected)}</span>
        <span className="day-info__text">
          <b>{info.title}</b>
          {info.sub && ` · ${info.sub}`}
        </span>
      </div>
      {!same && (
        <button type="button" className="pill-btn pill-btn--primary confirm-btn" onClick={() => p.onApply(selected)}>
          {`${sel.m}월 ${sel.d}일로 보기`}
        </button>
      )}
    </ModalSheet>
  )
}
