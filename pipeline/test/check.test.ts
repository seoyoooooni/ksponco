import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { checkClosures, checkEvents, checkForecast, checkShrink, checkSize, isClock, isDate, MAX_BYTES } from '../check/check.ts'
import { addDays } from '../collect/kma.ts'

test('checkShrink: 10% 넘게, 그리고 10건 넘게 줄면 오류, 이전 파일이 없거나 깨지면 통과', () => {
  const dir = mkdtempSync(join(tmpdir(), 'check-test-'))
  try {
    const prev = join(dir, 'events.json')
    writeFileSync(prev, JSON.stringify(Array(40).fill(0)))
    assert.deepEqual(checkShrink(Array(30).fill(0), prev), []) // 25% 줄었지만 10건
    assert.equal(checkShrink(Array(29).fill(0), prev).length, 1)
    assert.match(checkShrink(Array(29).fill(0), prev)[0], /40건에서 29건/)
    writeFileSync(prev, JSON.stringify(Array(200).fill(0)))
    assert.deepEqual(checkShrink(Array(185).fill(0), prev), []) // 15건 줄었지만 10% 미만
    assert.equal(checkShrink(Array(179).fill(0), prev).length, 1)
    assert.deepEqual(checkShrink([], join(dir, 'none.json')), [])
    writeFileSync(prev, '{')
    assert.deepEqual(checkShrink([], prev), [])
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

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
  const days = ['2026-11-23', '2026-11-24', '2026-11-25'].map((date) => ({ ...day, date }))
  const rainHourly = { start: '2026-11-22T00:00+09:00', mm: Array(96).fill(0) }
  assert.deepEqual(checkForecast({ updated: '2026-11-23T05:00+09:00', days, rainHourly }), [])
  assert.equal(checkForecast({ updated: '2026-11-23T05:00+09:00', days: [] }).length, 1)
  // updated 형식, sky 값, 날짜 중복, 3일 미만, rainHourly 없음
  assert.equal(checkForecast({ updated: 'x', days: [{ ...day, sky: '비' }, day] }).length, 5)
})

test('forecast 검사: rainHourly 시작 시각, 길이, 값', () => {
  const days = ['2026-11-23', '2026-11-24', '2026-11-25'].map((date) => ({ date, sky: '맑음', rain: false, rainPrevDay: 0, tempMax: 10 }))
  const f = (start: string, mm: unknown[]) => checkForecast({ updated: '2026-11-23T05:00+09:00', days, rainHourly: { start, mm } })
  const mm = Array(96).fill(null)
  assert.deepEqual(f('2026-11-22T00:00+09:00', mm), []) // null만 있어도 통과
  assert.equal(f('2026-11-23T00:00+09:00', mm).length, 1)
  assert.equal(f('2026-11-22T00:00+09:00', mm.slice(1)).length, 1)
  assert.match(f('2026-11-22T00:00+09:00', [-1, '1', 301, ...mm.slice(3)])[0], /값 오류 3칸/)
  assert.deepEqual(f('2026-11-22T00:00+09:00', [300, ...mm.slice(1)]), [])
})

test('forecast 검사: 날짜가 빠지거나, 3일 미만이거나, 첫날이 발표일과 맞지 않으면 실패', () => {
  const day = (date: string) => ({ date, sky: '맑음', rain: false, rainPrevDay: 0, tempMax: 10 })
  const f = (updated: string, ...dates: string[]) =>
    checkForecast({ updated, days: dates.map(day), rainHourly: { start: `${addDays(dates[0], -1)}T00:00+09:00`, mm: Array((dates.length + 1) * 24).fill(0) } })
  // 05:30 전 실행: 전날 발표분이라 첫날이 발표일 다음 날
  assert.deepEqual(f('2026-11-22T05:00+09:00', '2026-11-23', '2026-11-24', '2026-11-25'), [])
  assert.equal(f('2026-11-23T05:00+09:00', '2026-11-23', '2026-11-25', '2026-11-26').length, 1)
  assert.equal(f('2026-11-23T05:00+09:00', '2026-11-23', '2026-11-24').length, 1)
  assert.equal(f('2026-11-20T05:00+09:00', '2026-11-23', '2026-11-24', '2026-11-25').length, 1)
})

test('300KB를 넘으면 실패', () => {
  assert.deepEqual(checkSize('a'.repeat(MAX_BYTES)), [])
  assert.equal(checkSize('a'.repeat(MAX_BYTES + 1)).length, 1)
})
