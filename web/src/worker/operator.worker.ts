import { indexHeads } from '../lib/analysis'
import { buildCrowd } from '../lib/crowd'
import { analyzeOperator, type OperatorArgs } from '../lib/operator'

type Request = { id: number; key: string; args: Omit<OperatorArgs, 'heads'> }

self.onmessage = (e: MessageEvent<Request>) => {
  const { id, key, args } = e.data
  const heads = indexHeads(buildCrowd(args.layout, args.terrain.terrace ?? null), args.terrain, 1)
  const result = analyzeOperator({ ...args, heads })
  self.postMessage({ id, key, result })
}
