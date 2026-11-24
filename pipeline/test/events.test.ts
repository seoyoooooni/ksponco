import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { buildEvents, mergeEvents, scheduleToManual, type ManualEvent } from '../clean/events.ts'
import { venuesOf } from '../collect/olympicpark.ts'

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

const item = (evtSeq: number, plc: string, beginDt: string, endDt: string) => ({ evtSeq, title: `공연${evtSeq}`, plc, beginDt, endDt })

test('venuesOf: 88잔디마당, 수변무대 문자열로 장소를 가른다', () => {
  assert.deepEqual(venuesOf('올림픽공원 88잔디마당, 티켓링크 라이브 아레나'), ['lawn88'])
  assert.deepEqual(venuesOf('KSPO DOME, 88잔디마당, 88호수수변무대'), ['lawn88', 'lake'])
  assert.deepEqual(venuesOf('올림픽홀'), [])
})

test('scheduleToManual: 기간을 하루씩, 두 무대면 무대마다 펼치고 id·출처를 만든다', () => {
  const out = scheduleToManual([item(5148, '88잔디마당, 88호수수변무대', '2026-10-17', '2026-10-18')])
  assert.deepEqual(out.map((e) => [e.id, e.venue, e.date]), [
    ['20261017-5148', 'lawn88', '2026-10-17'],
    ['20261017-5148-lake', 'lake', '2026-10-17'],
    ['20261018-5148', 'lawn88', '2026-10-18'],
    ['20261018-5148-lake', 'lake', '2026-10-18'],
  ])
  assert.match(out[0].sourceUrl, /evtSeq=5148$/)
  assert.ok(out.every((e) => e.start === undefined && e.end === undefined))
})

test('scheduleToManual: 다른 장소, 잘못된 날짜, 31일 초과 기간은 건너뛴다', () => {
  const warn = mock.method(console, 'warn', () => {})
  const out = scheduleToManual([
    item(1, '올림픽홀', '2026-11-01', '2026-11-02'),
    item(2, '88잔디마당', '2026-13-01', '2026-13-02'),
    item(3, '88잔디마당', '2026-11-03', '2026-11-01'),
    item(4, '88잔디마당', '2026-11-28', '2027-01-03'),
    item(5, '88잔디마당', '2026-12-01', '2026-12-31'),
  ])
  warn.mock.restore()
  assert.equal(warn.mock.callCount(), 3)
  assert.equal(out.length, 31)
  assert.ok(out.every((e) => e.id.includes('-5')))
})

test('scheduleToManual: 항목이 있는데 펼친 결과가 0건이면 오류(날짜 형식 변경 대비)', () => {
  const warn = mock.method(console, 'warn', () => {})
  assert.throws(() => scheduleToManual([item(1, '88잔디마당', '2026.05.10', '2026.05.11')]), /0건/)
  warn.mock.restore()
  assert.deepEqual(scheduleToManual([]), [])
})

test('mergeEvents: 같은 장소·날짜는 manual이 이기고, 수집분끼리는 먼저 온 것이 이기며 경고한다', () => {
  const m = { ...base, id: 'm', date: '2026-09-05' }
  const a1 = { ...base, id: 'a1', date: '2026-09-05' }
  const a2 = { ...base, id: 'a2', date: '2026-09-06' }
  const a3 = { ...base, id: 'a3', date: '2026-09-06' }
  const a4 = { ...base, id: 'a4', venue: 'lake', date: '2026-09-05' }
  const warn = mock.method(console, 'warn', () => {})
  assert.deepEqual(mergeEvents([m], [a1, a2, a3, a4]).map((e) => e.id), ['m', 'a2', 'a4'])
  warn.mock.restore()
  assert.equal(warn.mock.callCount(), 1) // a3만. manual에 밀린 a1은 경고하지 않는다
})

test('긴 행사가 같은 날의 짧은 공연을 가리지 않는다(evtSeq가 더 작아도)', () => {
  const warn = mock.method(console, 'warn', () => {})
  const auto = scheduleToManual([item(5000, '88잔디마당 일대', '2026-09-01', '2026-09-30'), item(5144, '88잔디마당', '2026-09-05', '2026-09-06')])
  const merged = mergeEvents([], auto)
  warn.mock.restore()
  assert.equal(merged.find((e) => e.date === '2026-09-05')?.id, '20260905-5144')
  assert.equal(merged.find((e) => e.date === '2026-09-04')?.id, '20260904-5000')
})

test('scheduleToManual: FIRST_MONTH 이전 날짜는 버린다(2025년은 manual만)', () => {
  const out = scheduleToManual([item(7, '88잔디마당', '2025-12-31', '2026-01-01')])
  assert.deepEqual(out.map((e) => e.date), ['2026-01-01'])
})
