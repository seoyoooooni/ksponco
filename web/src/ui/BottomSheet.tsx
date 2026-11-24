import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useWide } from './useMediaQuery'

export type SheetSnap = 0 | 1 | 2

type Props = {
  label: string
  snap: SheetSnap
  onSnap?: (snap: SheetSnap) => void
  onVisibleHeight?: (h: number) => void
  children: ReactNode
  more?: ReactNode
}

const TAP = 6
const FLICK = 0.5
const TEASE = 28

type Heights = [number, number, number]

function nearest(heights: Heights, h: number): SheetSnap {
  let best: SheetSnap = 0
  heights.forEach((v, i) => {
    if (Math.abs(v - h) < Math.abs(heights[best] - h)) best = i as SheetSnap
  })
  return best
}

export function BottomSheet({ label, snap, onSnap, onVisibleHeight, children, more }: Props) {
  const ref = useRef<HTMLElement>(null)
  const handleRef = useRef<HTMLButtonElement>(null)
  const moreRef = useRef<HTMLDivElement>(null)
  const wide = useWide()
  const [heights, setHeights] = useState<Heights | null>(null)
  const [drag, setDrag] = useState<number | null>(null)

  const snappable = Boolean(more && onSnap) && !wide

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const cs = getComputedStyle(el)
    const maxH = parseFloat(cs.maxHeight)
    const full = Math.min(el.scrollHeight, Number.isFinite(maxH) ? maxH : Infinity)
    if (!snappable) {
      setHeights([full, full, full])
      return
    }
    const padBottom = parseFloat(cs.paddingBottom) || 0
    const gap = parseFloat(cs.rowGap) || 0
    const safe = Math.max(0, padBottom - 12)
    const first = handleRef.current?.nextElementSibling as HTMLElement | null
    const next = first?.nextElementSibling as HTMLElement | null
    const peek = next ? next.offsetTop + TEASE + safe : first ? first.offsetTop + first.offsetHeight + gap + padBottom : full
    const base = moreRef.current ? moreRef.current.offsetTop + TEASE + safe : full
    setHeights([Math.min(peek, full), Math.min(base, full), full])
  }, [snappable])

  useLayoutEffect(() => {
    measure()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const c of Array.from(el.children)) ro.observe(c)
    return () => ro.disconnect()
  }, [measure])

  const full = heights?.[2] ?? 0
  const settled = heights ? heights[snappable ? snap : 2] : 0
  const visible = drag ?? settled

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--sheet-h', `${wide ? 0 : visible}px`)
  }, [visible, wide])

  useEffect(() => {
    onVisibleHeight?.(wide ? 0 : settled)
  }, [settled, wide, onVisibleHeight])

  useEffect(() => () => document.documentElement.style.setProperty('--sheet-h', '0px'), [])

  useEffect(() => {
    if (snap < 2 && ref.current) ref.current.scrollTop = 0
  }, [snap])

  const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (!snappable || !heights || e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('input, [role="slider"], .range')) return
    const inHeader = Boolean(target.closest('.sheet__handle')) || Boolean(handleRef.current?.nextElementSibling?.contains(target))
    if (snap === 2 && !inHeader && (ref.current?.scrollHeight ?? 0) > (ref.current?.clientHeight ?? 0) + 1) return

    const startY = e.clientY
    const startH = heights[snap]
    let moved = false
    let lastY = startY
    let lastT = performance.now()
    let vel = 0

    const move = (ev: PointerEvent) => {
      const dy = ev.clientY - startY
      if (!moved && Math.abs(dy) < TAP) return
      moved = true
      const now = performance.now()
      const dt = Math.max(1, now - lastT)
      vel = (ev.clientY - lastY) / dt
      lastY = ev.clientY
      lastT = now
      const h = startH - dy
      const min = heights[0]
      const max = heights[2]
      const soft = h < min ? min - (min - h) * 0.3 : h > max ? max + (h - max) * 0.3 : h
      setDrag(soft)
    }

    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!moved) {
        setDrag(null)
        return
      }
      const swallow = (c: MouseEvent) => {
        c.stopPropagation()
        c.preventDefault()
      }
      window.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0)
      const h = startH - (ev.clientY - startY)
      let next = nearest(heights, h)
      if (vel < -FLICK) next = Math.min(2, Math.max(next, snap + 1)) as SheetSnap
      if (vel > FLICK) next = Math.max(0, Math.min(next, snap - 1)) as SheetSnap
      setDrag(null)
      onSnap?.(next)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const style = snappable && heights
    ? { transform: `translateY(${Math.max(0, full - visible)}px)`, transition: drag === null ? undefined : 'none' }
    : undefined

  return (
    <>
      <section
        ref={ref}
        aria-label={label}
        className={`sheet${snappable ? ' sheet--snap' : ''}${snappable && snap === 2 ? ' is-full' : ''}`}
        style={style}
        onPointerDown={onPointerDown}
      >
        {snappable ? (
          <button
            ref={handleRef}
            type="button"
            className="sheet__handle"
            aria-label={snap === 2 ? '시트 접기' : '시트 펼치기'}
            aria-expanded={snap === 2}
            data-dir={drag !== null ? 'flat' : snap === 2 ? 'down' : 'up'}
            onClick={() => onSnap?.(snap === 2 ? 1 : ((snap + 1) as SheetSnap))}
          />
        ) : (
          !wide && <span className="sheet__handle sheet__handle--static" aria-hidden="true" />
        )}
        {children}
        {more && (
          <div ref={moreRef} className="sheet__more" inert={snappable && snap < 2 ? true : undefined}>
            {more}
          </div>
        )}
      </section>
      {snappable && snap < 2 && (
        <button
          type="button"
          className="sheet__tease"
          aria-label="시트 더 펼치기"
          tabIndex={-1}
          style={{ opacity: drag === null ? 1 : 0 }}
          onPointerDown={onPointerDown}
          onClick={() => onSnap?.((snap + 1) as SheetSnap)}
        />
      )}
    </>
  )
}
