import { describe, expect, it } from 'vitest'
import { dayOfYearOf, lift, seasonColors, seasonHex } from './season'

describe('seasonHex', () => {
  it('계절 기준일에는 팔레트 색 그대로', () => {
    expect(seasonHex('lawn88', '2025-01-30')).toBe('#c4af9e')
    expect(seasonHex('forestCenter', '2025-08-01')).toBe('#60705d')
  })

  it('기준일 사이는 앞뒤 계절을 섞고, 연말은 늦가을과 겨울 사이', () => {
    const dec = seasonHex('lawnHill', '2025-12-20')
    expect(dec).not.toBe('#a99c83')
    expect(dec).not.toBe('#ceb29e')
    expect(seasonHex('lawnHill', '2026-01-01')).toBe(seasonHex('lawnHill', '2025-01-01'))
  })

  it('한여름 숲은 겨울 숲보다 푸르다', () => {
    const g = (hex: string) => parseInt(hex.slice(3, 5), 16) - parseInt(hex.slice(1, 3), 16)
    expect(g(seasonHex('forestNE', '2025-07-20'))).toBeGreaterThan(g(seasonHex('forestNE', '2025-02-01')))
  })
})

describe('seasonColors', () => {
  it('위성 색을 밝혀 쓴다', () => {
    expect(lift('#808080')).toBe('#939393')
    expect(seasonColors('lawn88', '2025-01-30').lawn).toBe(lift('#c4af9e'))
    expect(seasonColors('lake', '2025-08-01').trees).toHaveLength(5)
  })

  it('연중 일수', () => {
    expect(dayOfYearOf('2025-01-01')).toBe(1)
    expect(dayOfYearOf('2025-12-31')).toBe(365)
  })
})
