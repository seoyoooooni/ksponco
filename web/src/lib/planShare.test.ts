import { describe, expect, it } from 'vitest'
import { decodePlanParam, parsePlanFile, planFileText, planUrl, type PlanFile } from './planShare'

const plan: PlanFile = {
  venue: 'lawn88',
  date: '2026-11-27',
  sold: 1200,
  plans: {
    A: { tents: [[10.123, -4.56], [20, 30]], zones: [[0, 0, 5, 8]], palms: [] },
    B: { tents: [], zones: [], palms: [[1, 2, 3, 4]] },
  },
}

describe('planShare', () => {
  it('링크로 갔다 와도 같은 계획', () => {
    const url = planUrl(plan, 'https://x.test/ksponco/')
    const value = new URL(url).searchParams.get('op') ?? ''
    const back = decodePlanParam(value)
    expect(back?.venue).toBe('lawn88')
    expect(back?.sold).toBe(1200)
    expect(JSON.stringify(back?.plans.A.tents)).toBe('[[10.1,-4.6],[20,30]]')
    expect(JSON.stringify(back?.plans.B.palms)).toBe('[[1,2,3,4]]')
  })

  it('파일로 갔다 와도 같은 계획', () => {
    expect(JSON.stringify(parsePlanFile(planFileText(plan)))).toBe(JSON.stringify(plan))
  })

  it('이상한 값은 거절', () => {
    expect(decodePlanParam('abc')).toBeNull()
    expect(parsePlanFile('{"venue":"seoul","date":"2026-11-27"}')).toBeNull()
    expect(parsePlanFile('{"venue":"lawn88","date":"2026-11-27","plans":{"A":{"tents":[[1,"x"]]}}}')).toBeNull()
  })
})
