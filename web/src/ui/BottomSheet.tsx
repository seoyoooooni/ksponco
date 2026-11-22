import { useEffect, useRef, type ReactNode } from 'react'
import { useWide } from './useMediaQuery'

type Props = {
  label: string
  expanded: boolean
  onExpandedChange?: (expanded: boolean) => void
  children: ReactNode
  more?: ReactNode
}

export function BottomSheet({ label, expanded, onExpandedChange, children, more }: Props) {
  const ref = useRef<HTMLElement>(null)
  const wide = useWide()
  const drag = useRef<{ y: number } | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const root = document.documentElement
    const update = () => root.style.setProperty('--sheet-h', `${el.offsetHeight}px`)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.setProperty('--sheet-h', '0px')
    }
  }, [])

  const canToggle = Boolean(more && onExpandedChange) && !wide
  const open = expanded || wide

  return (
    <section ref={ref} aria-label={label} className="sheet">
      {canToggle ? (
        <button
          type="button"
          className="sheet__handle"
          aria-label={expanded ? '시트 접기' : '시트 펼치기'}
          aria-expanded={expanded}
          onClick={() => onExpandedChange?.(!expanded)}
          onPointerDown={(e) => {
            drag.current = { y: e.clientY }
          }}
          onPointerUp={(e) => {
            const start = drag.current
            drag.current = null
            if (!start) return
            const dy = e.clientY - start.y
            if (dy < -24) onExpandedChange?.(true)
            if (dy > 24) onExpandedChange?.(false)
          }}
        />
      ) : (
        !wide && <span className="sheet__handle sheet__handle--static" aria-hidden="true" />
      )}
      {children}
      {open && more}
    </section>
  )
}
