const DOW = ['일', '월', '화', '수', '목', '금', '토']

export function parseDate(date: string): { y: number; m: number; d: number; dow: number } {
  const [y, m, d] = date.split('-').map(Number)
  return { y, m, d, dow: new Date(Date.UTC(y, m - 1, d)).getUTCDay() }
}

export function toDateString(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function dateLabel(date: string): string {
  const { m, d, dow } = parseDate(date)
  return `${m}월 ${d}일 ${DOW[dow]}`
}

export function monthDayLabel(date: string): string {
  const { m, d } = parseDate(date)
  return `${m}월 ${d}일`
}

export function chipDateLabel(date: string): string {
  const { m, d, dow } = parseDate(date)
  return `${m}/${d} ${DOW[dow]}`
}

export function shortDateLabel(date: string): string {
  const { m, d } = parseDate(date)
  return `${m}.${d}`
}

export function clock(h: number): string {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  return `${hh}:${String(mm).padStart(2, '0')}`
}

export function hourLabel(h: number): string {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  const h12 = ((hh + 11) % 12) + 1
  return mm ? `${h12}시 ${mm}분` : `${h12}시`
}

export function clockLabel(h: number): string {
  return `${h < 12 ? '오전' : '오후'} ${hourLabel(h)}`
}

export function timeLabel(h: number): string {
  const total = Math.round(h * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function rangeLabel(from: number, to: number): string {
  return `${timeLabel(from)}–${timeLabel(to)}`
}

export function parseClock(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h + (m || 0) / 60
}

export function shortDuration(hours: number): string {
  const half = Math.round(hours * 2) / 2
  return Number.isInteger(half) ? `${half}시간` : `${Math.floor(half)}시간 반`
}

export function durationLabel(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (!h) return `${m}분`
  return m ? `${h}시간 ${m}분` : `${h}시간`
}
