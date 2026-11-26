import { describe, expect, it } from 'vitest'
import type { Layout, Venue } from '../data/types'
import { rectProblem, tentProblem, type Tent } from './operator'

const venue = { id: 'lawn88', fixedStage: null, water: [[100, 100], [120, 100], [120, 120], [100, 120]] } as unknown as Venue

const layout = {
  zones: [
    { type: 'aisle', poly: [[20, 0], [24, 0], [24, 40], [20, 40]] },
    { type: 'picnic', poly: [[0, 0], [60, 0], [60, 40], [0, 40]], density: 1 },
  ],
  screens: [],
} as unknown as Layout

const stage = { x: 50, z: 30, w: 10, d: 6, azimuth: 0, deckH: 1 } as unknown as Layout['stage'] & object

describe('tentProblem', () => {
  it('잔디 위 빈 자리는 통과', () => {
    expect(tentProblem(layout, null, venue, [], 10, 10)).toBeNull()
  })

  it('관객 구역 밖은 거절', () => {
    expect(tentProblem(layout, null, venue, [], 80, 80)).not.toBeNull()
  })

  it('통로에 걸치면 거절', () => {
    expect(tentProblem(layout, null, venue, [], 18, 10)).toContain('통로')
  })

  it('무대 위는 거절', () => {
    expect(tentProblem(layout, stage, venue, [], 50, 30)).toContain('무대')
  })

  it('다른 그늘막과 겹치면 거절, 자기 자신은 무시', () => {
    const tents: Tent[] = [{ id: 1, plan: 'p', x: 10, z: 10 }]
    expect(tentProblem(layout, null, venue, tents, 13, 12)).toContain('겹쳐')
    expect(tentProblem(layout, null, venue, tents, 13, 12, 1)).toBeNull()
    expect(tentProblem(layout, null, venue, tents, 16, 10)).toBeNull()
  })
})

describe('rectProblem', () => {
  it('한 변이 너무 짧으면 거절', () => {
    expect(rectProblem([0, 0], [0.5, 10])).not.toBeNull()
    expect(rectProblem([0, 0], [3, 3])).toBeNull()
  })
})
