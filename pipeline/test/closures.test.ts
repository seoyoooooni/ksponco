import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildClosures } from '../clean/closures.ts'

test('근거와 메모는 빼고 source를 manual로 채운다', () => {
  const [c] = buildClosures([
    { venue: 'lawn88', from: '2026-07-01', to: '2027-06-30', reason: '보수 공사', sourceUrl: 'https://x', note: '메모' },
  ])
  assert.deepEqual(c, { venue: 'lawn88', from: '2026-07-01', to: '2027-06-30', reason: '보수 공사', source: 'manual' })
})

test('장소, 시작일 순으로 정렬한다', () => {
  const out = buildClosures([
    { venue: 'lawn88', from: '2026-08-01', to: '2026-08-02', reason: 'b', sourceUrl: 'x' },
    { venue: 'lake', from: '2026-09-01', to: '2026-09-01', reason: 'c', sourceUrl: 'x' },
    { venue: 'lawn88', from: '2026-07-01', to: '2026-07-02', reason: 'a', sourceUrl: 'x' },
  ])
  assert.deepEqual(out.map((c) => c.reason), ['c', 'a', 'b'])
})

test('빈 목록은 빈 배열', () => {
  assert.deepEqual(buildClosures([]), [])
})
