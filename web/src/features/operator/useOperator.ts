import { useEffect, useRef, useState } from 'react'
import type { VenueBundle } from '../../data/load'
import type { Layout } from '../../data/types'
import { withClosed, type ClosedArea, type OperatorResult, type Tent, type Wet } from '../../lib/operator'

export type PlanInput = {
  key: string
  tents: Tent[]
  closed: ClosedArea[]
  palms: ClosedArea[]
  suggest: boolean
}

const WAIT = 250

let seq = 0

function spawn(): Worker {
  return new Worker(new URL('../../worker/operator.worker.ts', import.meta.url), { type: 'module' })
}

export function useOperator(args: {
  on: boolean
  bundle: VenueBundle
  baseLayout: Layout | null
  plans: PlanInput[]
  wet: Wet
  date: string
  stay: [number, number]
}): { results: Record<string, OperatorResult>; busy: boolean } {
  const { on, bundle, baseLayout, plans, wet, date, stay } = args
  const { terrain, trees, buildings, venue } = bundle
  const [results, setResults] = useState<Record<string, OperatorResult>>({})
  const [busy, setBusy] = useState(false)
  const worker = useRef<Worker | null>(null)
  const waiting = useRef(new Set<number>())
  const timer = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      worker.current?.terminate()
      worker.current = null
      waiting.current.clear()
    },
    [],
  )

  const signature = JSON.stringify(plans)
  useEffect(() => {
    window.clearTimeout(timer.current)
    if (!on || !baseLayout) {
      setBusy(false)
      return
    }
    setBusy(true)
    const stage = baseLayout.stage ?? venue.fixedStage ?? null
    timer.current = window.setTimeout(() => {
      if (waiting.current.size && worker.current) {
        worker.current.terminate()
        worker.current = null
      }
      waiting.current.clear()
      if (!worker.current) {
        const w = spawn()
        w.onmessage = (e: MessageEvent<{ id: number; key: string; result: OperatorResult }>) => {
          const { id, key, result } = e.data
          if (!waiting.current.delete(id)) return
          setResults((r) => ({ ...r, [key]: result }))
          if (waiting.current.size === 0) setBusy(false)
        }
        worker.current = w
      }
      for (const plan of plans) {
        const id = ++seq
        waiting.current.add(id)
        worker.current.postMessage({
          id,
          key: plan.key,
          args: {
            layout: withClosed(baseLayout, plan.closed),
            stage,
            terrain,
            trees,
            buildings,
            venue,
            tents: plan.tents,
            palms: plan.palms,
            wet,
            date,
            from: stay[0],
            to: stay[1],
            suggest: plan.suggest,
          },
        })
      }
    }, WAIT)
  }, [on, baseLayout, venue, terrain, trees, buildings, signature, wet?.mm, wet === null, date, stay[0], stay[1]])

  return { results, busy }
}
