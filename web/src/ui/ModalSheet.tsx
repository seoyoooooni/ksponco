import { useEffect, type ReactNode } from 'react'

type Props = {
  label: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function ModalSheet({ label, open, onClose, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <>
      <button type="button" className="modal-backdrop" aria-label="닫기" onClick={onClose} />
      <section role="dialog" aria-modal="true" aria-label={label} className="modal-sheet">
        <span className="sheet__handle sheet__handle--static" aria-hidden="true" />
        {children}
      </section>
    </>
  )
}
