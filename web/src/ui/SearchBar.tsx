import type { ReactNode } from 'react'
import { ChevronDown, PinIcon } from './icons'

type Props = {
  place: string
  date: string
  dateShort: string
  onOpen: () => void
  right?: ReactNode
}

export function SearchBar({ place, date, dateShort, onOpen, right }: Props) {
  return (
    <div className="searchbar">
      <button type="button" className="placechip" onClick={onOpen} aria-label={`장소와 날짜 바꾸기. 지금 ${place}, ${date}`}>
        <PinIcon size={16} />
        <b className="placechip__place">{place}</b>
        <span className="placechip__date">{dateShort}</span>
        <ChevronDown size={14} className="placechip__caret" />
      </button>
      {right}
    </div>
  )
}
