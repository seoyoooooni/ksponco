import { PillButton } from '../ui/Buttons'
import { GridIcon } from '../ui/icons'

type Props = {
  seats: boolean
  onSeats: () => void
}

export function FloatingActions({ seats, onSeats }: Props) {
  return (
    <div className="fabs">
      <PillButton variant="light" aria-pressed={seats} icon={<GridIcon size={18} />} onClick={onSeats}>
        좋은 자리
      </PillButton>
    </div>
  )
}
