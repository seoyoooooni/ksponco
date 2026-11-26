import type { ReactNode } from 'react'
import { EyeIcon, GridIcon, ShareIcon } from '../ui/icons'

type Props = {
  onView: (() => void) | null
  onShare: (() => void) | null
  seats: { on: boolean; toggle: () => void; legend?: ReactNode } | null
}

export function FloatingActions({ onView, onShare, seats }: Props) {
  if (!onView && !onShare && !seats) return null
  return (
    <div className="fabs">
      {onShare && (
        <button type="button" className="fab-round" aria-label="자리 공유" title="자리 공유" onClick={onShare}>
          <ShareIcon size={21} />
        </button>
      )}
      {onView && (
        <button type="button" className="fab-round" aria-label="내 시점으로 보기" title="내 시점으로 보기" onClick={onView}>
          <EyeIcon size={22} />
        </button>
      )}
      {seats && (
        <div className="fab-row">
          {seats.on && seats.legend}
          <button type="button" className="fab-round" aria-label="좋은 자리" title="좋은 자리" aria-pressed={seats.on} onClick={seats.toggle}>
            <GridIcon size={21} />
          </button>
        </div>
      )}
    </div>
  )
}
