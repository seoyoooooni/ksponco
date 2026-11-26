import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { matScreen } from '../../scene/matScreen'
import { ChevronLeft, ChevronRight } from '../../ui/icons'
import type { SheetSnap } from '../../ui/BottomSheet'
import { sceneStore } from '../../store/sceneStore'

export const MAT_TARGET = '@mat'

export type TourStep = {
  target: string | string[] | null
  title: string
  body: string
  sheet?: SheetSnap
}

type Props = {
  steps: TourStep[]
  onDone: () => void
}

type Box = { x: number; y: number; w: number; h: number; r: number }

const PAD = 6
const GAP = 12
const EDGE = 12

function targets(step: TourStep | undefined): string[] {
  if (!step || step.target === null) return []
  return Array.isArray(step.target) ? step.target : [step.target]
}

function present(selector: string): boolean {
  return selector === MAT_TARGET ? matScreen.ok : Boolean(document.querySelector(selector))
}

function measure(selector: string): Box | null {
  if (selector === MAT_TARGET) {
    if (!matScreen.ok) return null
    const d = Math.max(matScreen.w, matScreen.h, 40) + 20
    return { x: matScreen.x + matScreen.w / 2 - d / 2, y: matScreen.y + matScreen.h / 2 - d / 2, w: d, h: d, r: d / 2 }
  }
  const el = document.querySelector(selector)
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12
  const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1
  const w = rect.width + PAD * 2
  const h = rect.height + PAD * 2
  return { x: rect.left - PAD, y: rect.top - PAD, w, h, r: Math.min(radius * zoom + PAD, h / 2) }
}

function sameBoxes(a: Box[], b: Box[]) {
  if (a.length !== b.length) return false
  return a.every((p, i) => {
    const q = b[i]
    return Math.abs(p.x - q.x) < 0.5 && Math.abs(p.y - q.y) < 0.5 && Math.abs(p.w - q.w) < 0.5 && Math.abs(p.h - q.h) < 0.5
  })
}

export function Tour({ steps: all, onDone }: Props) {
  const steps = useMemo(() => all.filter((s) => s.target === null || targets(s).some(present)), [all])
  const [index, setIndex] = useState(0)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [card, setCard] = useState({ w: 0, h: 0 })
  const cardRef = useRef<HTMLDivElement>(null)
  const step = steps[index]

  useEffect(() => {
    const before = sceneStore.get().sheetSnap
    return () => sceneStore.set({ sheetSnap: before })
  }, [])

  useEffect(() => {
    if (step?.sheet !== undefined) sceneStore.set({ sheetSnap: step.sheet })
  }, [step])

  useEffect(() => {
    let raf = 0
    const list = targets(step)
    const tick = () => {
      const next = list.map(measure).filter((b): b is Box => b !== null)
      setBoxes((prev) => (sameBoxes(prev, next) ? prev : next))
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [step])

  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setCard((prev) => (Math.abs(prev.w - r.width) < 0.5 && Math.abs(prev.h - r.height) < 0.5 ? prev : { w: r.width, h: r.height }))
  })

  const next = useCallback(() => (index + 1 < steps.length ? setIndex(index + 1) : onDone()), [index, steps.length, onDone])
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
      else if (e.key === 'ArrowRight') next()
      else if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, onDone])

  if (!step) return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const box = boxes[0] ?? null
  let left = (vw - card.w) / 2
  let top = (vh - card.h) / 2
  if (box) {
    left = Math.min(Math.max(EDGE, box.x + box.w / 2 - card.w / 2), vw - card.w - EDGE)
    const below = box.y + box.h + GAP
    const above = box.y - GAP - card.h
    const fitsBelow = below + card.h <= vh - EDGE
    const fitsAbove = above >= EDGE
    const lower = box.y + box.h / 2 > vh / 2
    top = lower ? (fitsAbove ? above : below) : fitsBelow || !fitsAbove ? below : above
    top = Math.min(Math.max(EDGE, top), vh - card.h - EDGE)
  }
  const last = index === steps.length - 1

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label="사용법 안내">
      <svg className="tour__shade" width={vw} height={vh} aria-hidden="true">
        <defs>
          <mask id="tour-holes">
            <rect width={vw} height={vh} fill="#fff" />
            {boxes.map((b, i) => (
              <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={b.r} fill="#000" />
            ))}
          </mask>
        </defs>
        <rect width={vw} height={vh} fill="rgba(0, 0, 0, 0.45)" mask="url(#tour-holes)" />
        {boxes.map((b, i) => (
          <rect key={i} x={b.x - 1.5} y={b.y - 1.5} width={b.w + 3} height={b.h + 3} rx={b.r + 1.5} fill="none" stroke="#fff" strokeWidth={3} />
        ))}
      </svg>
      <div className="tour__pos" style={{ left, top, visibility: card.w ? 'visible' : 'hidden' }}>
        <div className="tour__card" ref={cardRef}>
          <div className="tour__progress" aria-hidden="true">
            <i style={{ width: `${((index + 1) / steps.length) * 100}%` }} />
          </div>
          <h2 className="tour__title">{step.title}</h2>
          <p className="tour__body">{step.body}</p>
          <div className="tour__actions">
            {!last && (
              <button type="button" className="tour__skip" onClick={onDone}>
                건너뛰기
              </button>
            )}
            <span className="tour__grow" />
            {index > 0 && (
              <button type="button" className="tour__arrow" aria-label="이전" onClick={prev}>
                <ChevronLeft size={20} />
              </button>
            )}
            {last ? (
              <button type="button" className="tour__next" onClick={next}>
                시작하기
              </button>
            ) : (
              <button type="button" className="tour__arrow tour__arrow--next" aria-label="다음" onClick={next}>
                <ChevronRight size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
