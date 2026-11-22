import { PillButton, RoundButton } from '../ui/Buttons'
import { GridIcon, PauseIcon, PlayIcon } from '../ui/icons'

type Props = {
  showSeats: boolean
  seats: boolean
  onSeats: () => void
  playing: boolean
  onPlay: () => void
}

export function FloatingActions({ showSeats, seats, onSeats, playing, onPlay }: Props) {
  return (
    <div className="fabs">
      {showSeats && (
        <PillButton variant="light" aria-pressed={seats} icon={<GridIcon size={18} />} onClick={onSeats}>
          좋은 자리
        </PillButton>
      )}
      <RoundButton variant="light" label={playing ? '그림자 재생 멈춤' : '하루 그림자 재생'} aria-pressed={playing} onClick={onPlay}>
        {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
      </RoundButton>
    </div>
  )
}
