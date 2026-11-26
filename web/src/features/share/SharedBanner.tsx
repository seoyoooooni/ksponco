import { CloseIcon, PinIcon } from '../../ui/icons'

type Props = {
  when: string
  onClose: () => void
}

export function SharedBanner({ when, onClose }: Props) {
  return (
    <div className="shared-banner" role="status">
      <span className="shared-banner__pin">
        <PinIcon size={18} />
      </span>
      <div className="shared-banner__text">
        <strong>친구가 잡은 자리예요</strong>
        <span>{when}</span>
      </div>
      <button type="button" className="shared-banner__close" aria-label="안내 닫기" onClick={onClose}>
        <CloseIcon size={16} />
      </button>
    </div>
  )
}
