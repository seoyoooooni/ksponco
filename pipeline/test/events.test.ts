import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { buildEvents, kopisToManual, mergeEvents, runtimeMinutes, showTimes, type ManualEvent } from '../clean/events.ts'
import type { KopisShow } from '../collect/kopis.ts'

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

const LAWN = 'FC001247-07', LAKE = 'FC001247-08', AREA = 'FC001247-12'
const show = (id: string, places: string[], from: string, to: string, extra: Partial<KopisShow> = {}): KopisShow => ({
  id, name: `공연${id}`, places, from, to, festival: false, guidance: '', runtime: '', ...extra,
})
const quiet = <T>(f: () => T) => {
  const warn = mock.method(console, 'warn', () => {})
  try {
    return { out: f(), warns: warn.mock.callCount() }
  } finally {
    warn.mock.restore()
  }
}

const keys = (m: Map<number, unknown>) => [...m.keys()].sort()

test('showTimes: 요일 범위(주말 넘김 포함), 여러 회차는 첫·마지막, 공휴일(HOL)은 건너뜀', () => {
  const t = showTimes('화요일 ~ 금요일(20:00), 토요일(19:00,16:00), HOL(15:00), 일요일(9:30)')
  assert.deepEqual(keys(t), [0, 2, 3, 4, 5, 6])
  assert.deepEqual(t.get(6), { first: '16:00', last: '19:00' })
  assert.deepEqual(t.get(0), { first: '09:30', last: '09:30' })
  assert.deepEqual(keys(showTimes('금요일 ~ 월요일(12:00)')), [0, 1, 5, 6])
  assert.equal(showTimes('').size, 0)
})

test('showTimes: 분 60 이상, 시 24 이상은 버린다(검사 실패로 갱신이 막히지 않게)', () => {
  assert.equal(showTimes('토요일(20:60), 일요일(24:00)').size, 0)
  assert.deepEqual(showTimes('토요일(20:60,21:00)').get(6), { first: '21:00', last: '21:00' })
})

test('showTimes: 전각 물결·괄호, 대시를 반각 물결로 읽는다', () => {
  assert.deepEqual(keys(showTimes('토요일～일요일（14:00）')), [0, 6])
  assert.deepEqual(keys(showTimes('토요일 – 일요일(14:00)')), [0, 6])
  assert.deepEqual(keys(showTimes('토요일 〜 일요일(14:00)')), [0, 6])
})

test('showTimes: 매일·평일·주말을 요일로 바꾼다', () => {
  assert.deepEqual(keys(showTimes('매일(19:00)')), [0, 1, 2, 3, 4, 5, 6])
  const t = showTimes('평일(19:30), 주말(15:00)')
  assert.deepEqual(keys(t), [0, 1, 2, 3, 4, 5, 6])
  assert.equal(t.get(3)?.first, '19:30')
  assert.equal(t.get(6)?.first, '15:00')
})

test('showTimes: 모르는 표기가 하나라도 있으면 못 읽은 것으로(빈 결과) 보고 요일을 빼지 않는다', () => {
  assert.equal(showTimes('금요일(19:00), 공연당일(14:00)').size, 0)
  assert.equal(showTimes('월요일 ~ HOL(15:00)').size, 0) // 범위 끝을 모르면 무한 반복 없이 빈 결과
})

test('showTimes: 같은 요일이 여러 번 나오면 가장 이른 시작과 가장 늦은 회차로 합친다', () => {
  const t = showTimes('금요일 ~ 일요일(19:00), 토요일 ~ 일요일(14:00), 일요일(11:00)')
  assert.deepEqual(t.get(5), { first: '19:00', last: '19:00' })
  assert.deepEqual(t.get(6), { first: '14:00', last: '19:00' })
  assert.deepEqual(t.get(0), { first: '11:00', last: '19:00' })
})

test('showTimes: 시각 없는 괄호(1부 등)는 지우고 회차를 모두 읽는다', () => {
  assert.deepEqual(showTimes('토요일(14:00(1부), 18:00(2부))').get(6), { first: '14:00', last: '18:00' })
})

test('runtimeMinutes: 시간·분을 분으로, 괄호 안(인터미션 등)은 빼고, 없으면 null', () => {
  assert.equal(runtimeMinutes('8시간 30분'), 510)
  assert.equal(runtimeMinutes('2시간'), 120)
  assert.equal(runtimeMinutes('90분'), 90)
  assert.equal(runtimeMinutes('2시간 (인터미션 15분)'), 120)
  assert.equal(runtimeMinutes('90분 (인터미션 15분 포함)'), 90)
  assert.equal(runtimeMinutes(' '), null)
})

test('kopisToManual: 잔디·수변 코드로 무대를 정하고, 하루씩 펼쳐 id·출처를 만든다', () => {
  const out = kopisToManual([show('PF1', [LAWN, LAKE], '2026-10-17', '2026-10-18')])
  assert.deepEqual(out.map((e) => [e.id, e.venue, e.date]), [
    ['20261017-PF1', 'lawn88', '2026-10-17'],
    ['20261017-PF1-lake', 'lake', '2026-10-17'],
    ['20261018-PF1', 'lawn88', '2026-10-18'],
    ['20261018-PF1-lake', 'lake', '2026-10-18'],
  ])
  assert.match(out[0].sourceUrl, /mt20Id=PF1$/)
})

test('kopisToManual: 일대는 페스티벌만 두 무대 모두에 넣고, 아니면 제외·경고', () => {
  const { out, warns } = quiet(() =>
    kopisToManual([show('PF1', [AREA], '2026-05-22', '2026-05-22', { festival: true }), show('PF2', [AREA], '2026-05-23', '2026-05-23')]),
  )
  assert.deepEqual(out.map((e) => e.id), ['20260522-PF1', '20260522-PF1-lake'])
  assert.equal(warns, 1)
})

test('kopisToManual: 잔디 코드에도 있으면 페스티벌이 아니어도 잔디에는 넣는다', () => {
  const { out } = quiet(() => kopisToManual([show('PF1', [LAWN, AREA], '2026-09-05', '2026-09-05')]))
  assert.deepEqual(out.map((e) => e.venue), ['lawn88'])
})

test('kopisToManual: 제외 목록에 있으면 빼고 경고한다', () => {
  const { out, warns } = quiet(() => kopisToManual([show('PF1', [LAWN], '2026-09-05', '2026-09-05')], [{ id: 'PF1', reason: '평화광장 공연' }]))
  assert.deepEqual(out, [])
  assert.equal(warns, 1)
})

test('kopisToManual: 시각은 첫 회차 ~ 마지막 회차+런타임(api), 런타임 없으면 기본 종료(default), 공연시간을 못 읽으면 비움', () => {
  const out = kopisToManual([
    show('PF1', [LAWN], '2026-06-20', '2026-06-21', { guidance: '토요일(14:00), 일요일(23:00)', runtime: '8시간 30분' }),
    show('PF2', [LAKE], '2026-06-20', '2026-06-21', { guidance: '토요일(14:00), 일요일(21:30)' }),
    show('PF3', [LAKE], '2026-06-22', '2026-06-22', { guidance: '', runtime: '2시간' }),
    show('PF4', [LAKE], '2026-06-27', '2026-06-27', { guidance: '토요일(16:00,19:00)', runtime: '2시간' }),
  ])
  const t = (id: string) => {
    const e = out.find((x) => x.id === id)!
    return [e.start, e.end, e.timeSource]
  }
  assert.deepEqual(t('20260620-PF1'), ['14:00', '22:30', 'api'])
  assert.deepEqual(t('20260621-PF1'), ['23:00', '24:00', 'api'])
  assert.deepEqual(t('20260620-PF2-lake'), ['14:00', '21:00', 'default'])
  assert.deepEqual(t('20260621-PF2-lake'), ['21:30', '24:00', 'default'])
  assert.deepEqual(t('20260622-PF3-lake'), [undefined, undefined, undefined])
  assert.deepEqual(t('20260627-PF4-lake'), ['16:00', '21:00', 'api'])
})

test('kopisToManual: 공연시간에 없는 요일은 공연 없는 날로 보고 빼낸다', () => {
  // 6/5(금) ~ 6/14(일), 주말 공연 → 6/6, 6/7, 6/13, 6/14만
  const out = kopisToManual([show('PF1', [LAWN], '2026-06-05', '2026-06-14', { guidance: '토요일 ~ 일요일(14:00)' })])
  assert.deepEqual(out.map((e) => e.date), ['2026-06-06', '2026-06-07', '2026-06-13', '2026-06-14'])
})

test('buildEvents: api 시각은 그대로, start만 있는 항목은 default 시각', () => {
  const [a, b] = build([
    { ...base, id: '1', date: '2026-06-20', start: '14:00', end: '22:30', timeSource: 'api' },
    { ...base, id: '2', date: '2026-06-21', start: '14:00', end: '21:00', timeSource: 'default' },
  ])
  assert.deepEqual([a.start, a.end, a.timeSource], ['14:00', '22:30', 'api'])
  assert.deepEqual([b.start, b.end, b.timeSource], ['14:00', '21:00', 'default'])
})

test('kopisToManual: 잘못된 날짜, 31일 초과 기간은 건너뛴다', () => {
  const { out, warns } = quiet(() =>
    kopisToManual([
      show('PF2', [LAWN], '2026-13-01', '2026-13-02'),
      show('PF3', [LAWN], '2026-11-03', '2026-11-01'),
      show('PF4', [LAWN], '2026-11-28', '2027-01-03'),
      show('PF5', [LAWN], '2026-12-01', '2026-12-31'),
      show('PF6', [LAWN], '2026-12-01', '2027-01-01'), // 32일
    ]),
  )
  assert.equal(warns, 4)
  assert.equal(out.length, 31)
  assert.ok(out.every((e) => e.id.endsWith('-PF5')))
})

test('kopisToManual: 남은 공연의 날짜를 하나도 못 읽으면 오류(날짜 형식 변경 대비), 그 외 0건은 정상', () => {
  assert.throws(() => quiet(() => kopisToManual([show('PF1', [LAWN], '2026.05.10', '2026.05.11')])), /날짜를 하나도/)
  assert.deepEqual(kopisToManual([]), [])
  assert.deepEqual(quiet(() => kopisToManual([show('PF1', [AREA], '2026-05-10', '2026-05-10')])).out, []) // 전부 걸러짐
  assert.deepEqual(quiet(() => kopisToManual([show('PF1', [LAWN], '2026-05-01', '2026-07-31')])).out, []) // 31일 초과뿐
  assert.deepEqual(kopisToManual([show('PF1', [LAWN], '2026-06-22', '2026-06-22', { guidance: '토요일(14:00)' })]), []) // 공연 요일 아님
})

test('mergeEvents: 같은 장소·날짜는 manual이 이기고, 수집분끼리는 먼저 온 것이 이기며 경고한다', () => {
  const m = { ...base, id: 'm', date: '2026-09-05' }
  const a1 = { ...base, id: 'a1', date: '2026-09-05' }
  const a2 = { ...base, id: 'a2', date: '2026-09-06' }
  const a3 = { ...base, id: 'a3', date: '2026-09-06' }
  const a4 = { ...base, id: 'a4', venue: 'lake', date: '2026-09-05' }
  const { out, warns } = quiet(() => mergeEvents([m], [a1, a2, a3, a4]))
  assert.deepEqual(out.map((e) => e.id), ['m', 'a2', 'a4'])
  assert.equal(warns, 1) // a3만. manual에 밀린 a1은 경고하지 않는다
})

test('긴 행사가 같은 날의 짧은 공연을 가리지 않는다(id가 더 앞서도)', () => {
  const { out: merged } = quiet(() =>
    mergeEvents([], kopisToManual([show('PF1', [LAWN], '2026-09-01', '2026-09-30'), show('PF9', [LAWN], '2026-09-05', '2026-09-06')])),
  )
  assert.equal(merged.find((e) => e.date === '2026-09-05')?.id, '20260905-PF9')
  assert.equal(merged.find((e) => e.date === '2026-09-04')?.id, '20260904-PF1')
})

test('kopisToManual: FIRST_MONTH 이전 날짜는 버린다(2025년은 manual만)', () => {
  const out = kopisToManual([show('PF7', [LAWN], '2025-12-31', '2026-01-01')])
  assert.deepEqual(out.map((e) => e.date), ['2026-01-01'])
})
