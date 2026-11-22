import { toDateString } from '../lib/format'
import { ChevronLeft, ChevronRight } from './icons'

type Props = {
  month: { y: number; m: number }
  selected: string
  today: string
  eventDays: Set<string>
  closedDays: Set<string>
  onSelect: (date: string) => void
  onMonth: (delta: number) => void
}

const DOW = ['일', '월', '화', '수', '목', '금', '토']

export function Calendar({ month, selected, today, eventDays, closedDays, onSelect, onMonth }: Props) {
  const first = new Date(Date.UTC(month.y, month.m - 1, 1)).getUTCDay()
  const days = new Date(Date.UTC(month.y, month.m, 0)).getUTCDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < first; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)
  while (cells.length % 7) cells.push(null)

  return (
    <div className="calendar">
      <div className="calendar__head">
        <button type="button" className="calendar__nav" aria-label="이전 달" onClick={() => onMonth(-1)}>
          <ChevronLeft />
        </button>
        <span className="calendar__title">
          {month.y}년 {month.m}월
        </span>
        <button type="button" className="calendar__nav" aria-label="다음 달" onClick={() => onMonth(1)}>
          <ChevronRight />
        </button>
      </div>
      <div className="calendar__grid calendar__dow" aria-hidden="true">
        {DOW.map((d, i) => (
          <span key={d} className={i === 0 ? 'is-sun' : undefined}>
            {d}
          </span>
        ))}
      </div>
      <div className="calendar__grid" role="grid" aria-label={`${month.y}년 ${month.m}월`}>
        {cells.map((d, i) => {
          if (d === null) return <span key={i} />
          const date = toDateString(month.y, month.m, d)
          const ev = eventDays.has(date)
          const closed = closedDays.has(date)
          const cls = [
            'calendar__day',
            date === selected && 'is-selected',
            date === today && 'is-today',
            closed && 'is-closed',
            i % 7 === 0 && 'is-sun',
          ]
            .filter(Boolean)
            .join(' ')
          const aria = `${month.m}월 ${d}일${ev ? ', 공연' : ''}${closed ? ', 출입 제한' : ''}${date === today ? ', 오늘' : ''}`
          return (
            <button key={i} type="button" className={cls} aria-label={aria} aria-pressed={date === selected} onClick={() => onSelect(date)}>
              {d}
              {ev && <i className="calendar__dot" />}
            </button>
          )
        })}
      </div>
      <div className="calendar__legend">
        <span>
          <i className="calendar__dot calendar__dot--static" />
          공연
        </span>
        <span>
          <i className="calendar__swatch is-closed" />
          출입 제한
        </span>
        <span>
          <i className="calendar__swatch is-today" />
          오늘
        </span>
      </div>
    </div>
  )
}
