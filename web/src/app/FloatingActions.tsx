import { PillButton } from '../ui/Buttons'
import { EyeIcon, GridIcon } from '../ui/icons'

type Props = {
  onView: (() => void) | null
  seats: { on: boolean; toggle: () => void } | null
}

export function FloatingActions({ onView, seats }: Props) {
  if (!onView && !seats) return null
  return (
    <div className="fabs">
      {onView && (
        <button type="button" className="fab-round" aria-label="내 시점으로 보기" title="내 시점으로 보기" onClick={onView}>
          <EyeIcon size={22} />
        </button>
      )}
      {seats && (
        <PillButton variant="light" aria-pressed={seats.on} icon={<GridIcon size={18} />} onClick={seats.toggle}>
          좋은 자리
        </PillButton>
      )}
    </div>
  )
}
