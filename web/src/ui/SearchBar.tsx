import type { ReactNode } from 'react'
import { CalendarIcon, PinIcon } from './icons'
import { RoundButton } from './Buttons'

type Props = {
  place: string
  date: string
  onOpen: () => void
  right?: ReactNode
}

export function SearchBar({ place, date, onOpen, right }: Props) {
  return (
    <div className="searchbar">
      <button type="button" className="searchbar__field" onClick={onOpen} aria-label={`장소와 날짜 바꾸기. 지금 ${place}, ${date}`}>
        <PinIcon />
        <b className="searchbar__place">{place}</b>
        <span className="searchbar__date">{date}</span>
      </button>
      {right ?? (
        <RoundButton variant="dark" label="날짜 고르기" onClick={onOpen}>
          <CalendarIcon size={22} />
        </RoundButton>
      )}
    </div>
  )
}
