import { useEffect, type ReactNode } from 'react'
import { CloseIcon } from './icons'

type Props = {
  label: string
  open: boolean
  onClose: () => void
  children: ReactNode
  placement?: 'panel' | 'center'
  closeButton?: boolean
}

export function ModalSheet({ label, open, onClose, children, placement = 'panel', closeButton = false }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  const center = placement === 'center'
  return (
    <>
      <button type="button" className={`modal-backdrop${center ? ' modal-backdrop--dim' : ''}`} aria-label="닫기" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-label={label} className={`modal-sheet${center ? ' modal-sheet--center' : ''}`}>
        {!closeButton && <span className="sheet__handle sheet__handle--static" aria-hidden="true" />}
        {closeButton && (
          <button type="button" className="modal-close" aria-label="닫기" onClick={onClose}>
            <CloseIcon size={18} />
          </button>
        )}
        {children}
      </section>
    </>
  )
}
