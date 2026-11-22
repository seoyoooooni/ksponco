import { describe, expect, it } from 'vitest'
import type { Zone } from '../data/types'
import { pointInPolygon, zoneAt } from './polygon'

const zones: Zone[] = [
  { type: 'picnic', poly: [[-10, 0], [10, 0], [10, 20], [-10, 20]], density: 0.8 },
  { type: 'aisle', poly: [[-1, 0], [1, 0], [1, 20], [-1, 20]] },
]

describe('polygon', () => {
  it('pointInPolygon', () => {
    expect(pointInPolygon(0, 10, zones[0].poly)).toBe(true)
    expect(pointInPolygon(11, 10, zones[0].poly)).toBe(false)
  })

  it('통로가 피크닉존보다 먼저 잡힌다', () => {
    expect(zoneAt(zones, 0, 10)?.type).toBe('aisle')
    expect(zoneAt(zones, 5, 10)?.type).toBe('picnic')
    expect(zoneAt(zones, 50, 10)).toBeNull()
  })
})
