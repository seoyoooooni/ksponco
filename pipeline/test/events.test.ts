import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildEvents, type ManualEvent } from '../clean/events.ts'

const base = { name: 'A', venue: 'lawn88', sourceUrl: 'https://x' } as const
const linked = {
  tempMax: { '2025-06-14': 32.1 },
  shows: [
    { date: '2025-06-14', hour: 12, show: '민트', people: 14000 },
    { date: '2025-06-14', hour: 17, show: '민트, 다른 공연', people: 16500 },
    { date: '2025-06-15', hour: 17, show: '민트, 다른 공연', people: 16500 },
  ],
}
const noLayout = () => false
const build = (m: ManualEvent[], hasLayout = noLayout) => buildEvents(m, linked, hasLayout)

test('시작과 종료가 모두 있으면 manual, 하나라도 없으면 default 시각', () => {
  const [a, b] = build([
    { ...base, id: '1', date: '2025-06-14', start: '13:00', end: '21:20' },
    { ...base, id: '2', date: '2025-06-15', start: '12:50' },
  ])
  assert.deepEqual([a.start, a.end, a.timeSource], ['13:00', '21:20', 'manual'])
  assert.deepEqual([b.start, b.end, b.timeSource], ['12:00', '21:00', 'default'])
})

test('관객 수는 linkedName만 있는 행에서 가져오고, 겹친 행은 쓰지 않는다', () => {
  const [a, b] = build([
    { ...base, id: '1', date: '2025-06-14', linkedName: '민트' },
    { ...base, id: '2', date: '2025-06-15', linkedName: '민트' },
  ])
  assert.deepEqual([a.people, a.peopleSource], [14000, 'linked'])
  assert.deepEqual([b.people, b.peopleSource], [null, 'default'])
})

test('manual 관객 수가 연계 값보다 우선한다', () => {
  const [a] = build([{ ...base, id: '1', date: '2025-06-14', linkedName: '민트', people: 9000 }])
  assert.deepEqual([a.people, a.peopleSource], [9000, 'manual'])
})

test('linkedName이 없으면 관객 수는 default', () => {
  const [a] = build([{ ...base, id: '1', date: '2025-06-14' }])
  assert.deepEqual([a.people, a.peopleSource], [null, 'default'])
})

test('tempMax는 날짜로 연계 스냅샷에서 가져오고 없으면 null', () => {
  const [a, b] = build([
    { ...base, id: '1', date: '2025-06-14' },
    { ...base, id: '2', date: '2026-06-14' },
  ])
  assert.equal(a.tempMax, 32.1)
  assert.equal(b.tempMax, null)
})

test('layout 파일이 있으면 연결하고 없으면 null', () => {
  const [a, b] = build(
    [
      { ...base, id: 'has', date: '2025-06-14' },
      { ...base, id: 'none', date: '2025-06-15' },
    ],
    (venue, file) => venue === 'lawn88' && file === 'layout_has.json',
  )
  assert.equal(a.layout, 'layout_has.json')
  assert.equal(b.layout, null)
})

test('note, linkedName은 출력에 없고 날짜·장소 순으로 정렬한다', () => {
  const out = build([
    { ...base, id: 'b', date: '2025-06-15', note: '메모' },
    { ...base, id: 'c', venue: 'lake', date: '2025-06-14' },
    { ...base, id: 'a', date: '2025-06-14', linkedName: '민트' },
  ])
  assert.deepEqual(out.map((e) => e.id), ['c', 'a', 'b'])
  assert.ok(out.every((e) => !('note' in e) && !('linkedName' in e)))
})
