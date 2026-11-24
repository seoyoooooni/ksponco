import type { ReactNode } from 'react'
import { CalendarIcon, PinIcon } from './icons'

type Props = {
  place: string
  date: string
  onOpen: () => void
  right?: ReactNode
}

export function SearchBar({ place, date, onOpen, right }: Props) {
  return (
    <div className="searchbar">
      <div className="searchbar__field">
        <button type="button" className="searchbar__part searchbar__part--place" onClick={onOpen} aria-label={`장소 바꾸기. 지금 ${place}`}>
          <PinIcon size={18} />
          <b className="searchbar__place">{place}</b>
        </button>
        <i className="searchbar__divider" aria-hidden="true" />
        <button type="button" className="searchbar__part searchbar__part--date" onClick={onOpen} aria-label={`날짜 바꾸기. 지금 ${date}`}>
          <CalendarIcon size={18} />
          <span className="searchbar__date">{date}</span>
        </button>
      </div>
      {right}
    </div>
  )
}
