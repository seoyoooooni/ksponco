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

let worker: Worker | null = null
let seq = 0

function getWorker(): Worker {
  if (!worker) worker = new Worker(new URL('../../worker/operator.worker.ts', import.meta.url), { type: 'module' })
  return worker
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
  const [pending, setPending] = useState(0)
  const latest = useRef<Record<string, number>>({})

  useEffect(() => {
    const w = getWorker()
    const onMessage = (e: MessageEvent<{ id: number; key: string; result: OperatorResult }>) => {
      const { id, key, result } = e.data
      if (latest.current[key] !== id) return
      setResults((r) => ({ ...r, [key]: result }))
      setPending((n) => Math.max(0, n - 1))
    }
    w.addEventListener('message', onMessage)
    return () => w.removeEventListener('message', onMessage)
  }, [])

  const signature = JSON.stringify(plans)
  useEffect(() => {
    if (!on || !baseLayout) return
    const w = getWorker()
    const stage = baseLayout.stage ?? venue.fixedStage ?? null
    let sent = 0
    for (const plan of plans) {
      const id = ++seq
      latest.current[plan.key] = id
      sent++
      w.postMessage({
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
    setPending(sent)
  }, [on, baseLayout, venue, terrain, trees, buildings, signature, wet?.mm, wet === null, date, stay[0], stay[1]])

  return { results, busy: pending > 0 }
}
