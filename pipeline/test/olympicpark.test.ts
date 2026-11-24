import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { fetchMonth, fetchSchedule, monthRange, type Post } from '../collect/olympicpark.ts'

const row = (evtSeq: number, extra = {}) => ({ evtSeq, title: ` 공연${evtSeq} `, plc: '88잔디마당', beginDt: '2026-09-05', endDt: '2026-09-06', ...extra })
const ok = (body: unknown): Post => async () => ({ status: 200, text: JSON.stringify(body) })
const noSleep = async () => {}

test('monthRange: 2026-01부터 오늘(KST)의 12개월 뒤까지', () => {
  const r = monthRange(new Date('2026-11-24T03:00:00Z'))
  assert.equal(r[0], '2026-01')
  assert.equal(r.at(-1), '2027-11')
  assert.equal(r.length, 23)
})

test('monthRange: KST 자정을 넘긴 UTC 시각은 다음 달로 본다', () => {
  assert.equal(monthRange(new Date('2026-12-31T16:00:00Z')).at(-1), '2028-01')
})

test('fetchMonth: 예정·지난 공연을 합치고 제목 공백을 다듬는다', async () => {
  const items = await fetchMonth('2026-09', ok([[row(1)], [row(2)]]))
  assert.deepEqual(items.map((i) => [i.evtSeq, i.title]), [[1, '공연1'], [2, '공연2']])
})

test('fetchMonth: nowYM은 하이픈 없이 보낸다', async () => {
  let sent = ''
  await fetchMonth('2026-09', async (b) => ((sent = b), { status: 200, text: '[[],[]]' }))
  assert.equal(JSON.parse(sent).nowYM, '202609')
})

test('fetchMonth: HTTP 오류, JSON 아님, 구조 다름, 필드 누락은 에러', async () => {
  await assert.rejects(fetchMonth('2026-09', async () => ({ status: 500, text: '' })), /HTTP 500/)
  await assert.rejects(fetchMonth('2026-09', async () => ({ status: 200, text: '<html>' })), /JSON이 아닌/)
  await assert.rejects(fetchMonth('2026-09', ok({ a: 1 })), /구조가 다름/)
  await assert.rejects(fetchMonth('2026-09', ok([[row(1)]])), /구조가 다름/) // 지난 공연 목록 없음
  await assert.rejects(fetchMonth('2026-09', ok([[row(1)], null])), /구조가 다름/)
  await assert.rejects(fetchMonth('2026-09', ok([[{ ...row(1), title: undefined }], []])), /필드/)
  await assert.rejects(fetchMonth('2026-09', ok([[{ ...row(1), evtSeq: 'x' }], []])), /필드/)
})

test('fetchSchedule: 같은 evtSeq는 한 번만 담고 evtSeq 순으로 돌려준다', async () => {
  const items = await fetchSchedule(new Date('2026-03-01T00:00:00Z'), ok([[row(9), row(3)], []]), noSleep)
  assert.deepEqual(items.map((i) => i.evtSeq), [3, 9])
})

test('fetchSchedule: 한 달이라도 실패하면 전체 실패', async () => {
  let n = 0
  const post: Post = async () => (++n === 3 ? { status: 503, text: '' } : { status: 200, text: '[[],[]]' })
  await assert.rejects(fetchSchedule(new Date('2026-11-24T00:00:00Z'), post, noSleep), /HTTP 503/)
})

test('fetchMonth: 잔디·수변이 아닌 행은 형식이 이상해도 무시한다', async () => {
  const bad = { evtSeq: null, title: null, plc: '올림픽홀', beginDt: null }
  const items = await fetchMonth('2026-09', ok([[bad, null, { title: 'x' }, row(1)], []]))
  assert.deepEqual(items.map((i) => i.evtSeq), [1])
})

test('fetchMonth: 잔디·수변 행의 evtSeq가 null, 빈 문자열, 0, 음수, 소수면 에러, 숫자 문자열은 허용', async () => {
  for (const evtSeq of [null, '', 0, -3, 1.5, 'x'])
    await assert.rejects(fetchMonth('2026-09', ok([[row(1, { evtSeq })], []])), /필드/)
  const [a] = await fetchMonth('2026-09', ok([[row(1, { evtSeq: '5144' })], []]))
  assert.equal(a.evtSeq, 5144)
})

test('fetchMonth: 잔디·수변 행의 제목이 비면 건너뛰고 경고한다', async () => {
  const warn = mock.method(console, 'warn', () => {})
  const items = await fetchMonth('2026-09', ok([[row(1, { title: '   ' }), row(2)], []]))
  warn.mock.restore()
  assert.equal(warn.mock.callCount(), 1)
  assert.deepEqual(items.map((i) => i.evtSeq), [2])
})

test('fetchSchedule: 잔디·수변 공연이 한 건도 없으면 에러', async () => {
  const indoorOnly = ok([[row(1, { plc: '올림픽홀' })], []])
  await assert.rejects(fetchSchedule(new Date('2026-11-24T00:00:00Z'), indoorOnly, noSleep), /한 건도 없음/)
})
