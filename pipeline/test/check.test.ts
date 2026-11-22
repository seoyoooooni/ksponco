import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkClosures, checkEvents, checkForecast, checkSize, isClock, isDate, MAX_BYTES } from '../check/check.ts'

const ev = {
  id: '20250614-bml',
  name: 'A',
  venue: 'lawn88',
  date: '2025-06-14',
  start: '13:00',
  end: '21:20',
  timeSource: 'manual',
  people: 14000,
  peopleSource: 'linked',
  layout: null,
  sourceUrl: 'https://x.kr/a',
  tempMax: 32.1,
}

test('날짜와 시각 형식', () => {
  assert.ok(isDate('2025-02-28'))
  assert.ok(!isDate('2025-02-30'))
  assert.ok(!isDate('2025-6-1'))
  assert.ok(isClock('00:00') && isClock('23:59') && isClock('24:00'))
  assert.ok(!isClock('24:10') && !isClock('9:00'))
})

test('정상 events는 통과', () => {
  assert.deepEqual(checkEvents([ev, { ...ev, id: 'b', venue: 'lake', end: '24:00', people: null, tempMax: null }]), [])
})

test('events 빈 배열과 배열 아님은 실패', () => {
  assert.equal(checkEvents([]).length, 1)
  assert.equal(checkEvents({}).length, 1)
})

test('events 필드 오류를 잡는다', () => {
  const bad = (patch: object) => checkEvents([{ ...ev, ...patch }])
  assert.equal(bad({ venue: 'dome' }).length, 1)
  assert.equal(bad({ date: '2025-13-01' }).length, 1)
  assert.equal(bad({ start: '21:20' }).length, 1)
  assert.equal(bad({ timeSource: 'guess' }).length, 1)
  assert.equal(bad({ people: -1 }).length, 1)
  assert.equal(bad({ sourceUrl: '' }).length, 1)
  assert.equal(bad({ tempMax: 50 }).length, 1)
  assert.equal(bad({ layout: 'x.json' }).length, 1)
})

test('id 중복과 같은 장소·날짜 중복을 잡는다', () => {
  assert.equal(checkEvents([ev, { ...ev, venue: 'lake' }]).length, 1)
  assert.equal(checkEvents([ev, { ...ev, id: 'other' }]).length, 1)
})

test('closures: 빈 배열은 통과, from > to는 실패', () => {
  const c = { venue: 'lawn88', from: '2026-07-01', to: '2027-06-30', reason: '보수 공사', source: 'manual' }
  assert.deepEqual(checkClosures([]), [])
  assert.deepEqual(checkClosures([c]), [])
  assert.equal(checkClosures([{ ...c, from: '2027-07-01' }]).length, 1)
  assert.equal(checkClosures([{ ...c, reason: '' }]).length, 1)
})

test('forecast 검사', () => {
  const day = { date: '2026-11-23', sky: '맑음', rain: false, rainPrevDay: 0, tempMax: 10 }
  assert.deepEqual(checkForecast({ updated: '2026-11-23T05:00+09:00', days: [day] }), [])
  assert.equal(checkForecast({ updated: '2026-11-23T05:00+09:00', days: [] }).length, 1)
  assert.equal(checkForecast({ updated: 'x', days: [{ ...day, sky: '비' }, day] }).length, 3)
})

test('300KB를 넘으면 실패', () => {
  assert.deepEqual(checkSize('a'.repeat(MAX_BYTES)), [])
  assert.equal(checkSize('a'.repeat(MAX_BYTES + 1)).length, 1)
})
