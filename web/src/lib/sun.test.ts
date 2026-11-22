import { describe, expect, it } from 'vitest'
import { dayOfYear, sunPosition, sunsetHour } from './sun'

describe('sunPosition', () => {
  it('하지 정오 무렵 서울 태양 고도는 약 76도', () => {
    const s = sunPosition('2026-06-21', 12.5)
    expect(s.altitude).toBeGreaterThan(74)
    expect(s.altitude).toBeLessThan(77)
  })

  it('오후에는 해가 서쪽에 있다', () => {
    const s = sunPosition('2026-06-20', 16)
    expect(s.direction[0]).toBeLessThan(0)
    expect(s.azimuth).toBeGreaterThan(180)
  })

  it('6월 서울 해 지는 시각은 저녁 7시 36분~8시 사이', () => {
    const h = sunsetHour('2026-06-20')!
    expect(h).toBeGreaterThan(19.6)
    expect(h).toBeLessThan(20)
  })

  it('dayOfYear', () => {
    expect(dayOfYear('2026-01-01')).toBe(1)
    expect(dayOfYear('2026-06-20')).toBe(171)
  })
})
