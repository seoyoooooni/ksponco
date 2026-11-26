import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchDetail, fetchList, fetchShows, monthRange, tags } from '../collect/kopis.ts'
import type { Get } from '../collect/kma.ts'

const KEY = 'k'
const noSleep = async () => {}
const db = (id: string, name: string, from: string, to: string) =>
  `<db><mt20id>${id}</mt20id><prfnm>${name}</prfnm><prfpdfrom>${from}</prfpdfrom><prfpdto>${to}</prfpdto></db>`
const list = (...rows: string[]) => `<?xml version="1.0"?><dbs>${rows.join('')}</dbs>`
const detail = (id: string, festival = 'Y', guidance = '토요일(14:00)', runtime = '2시간') =>
  `<dbs><db><mt20id>${id}</mt20id><festival>${festival}</festival><dtguidance>${guidance}</dtguidance><prfruntime>${runtime}</prfruntime></db></dbs>`

// url로 응답을 고르는 가짜 get. 상세 요청은 /pblprfr/<id>?, 목록은 prfplccd로 가른다.
const fake = (lists: Record<string, string>, details: Record<string, string> = {}): Get => async (url) => {
  const u = new URL(url)
  const id = u.pathname.match(/pblprfr\/(.+)$/)?.[1]
  if (id) return { status: 200, text: details[id] ?? detail(id) }
  const key = `${u.searchParams.get('stdate')}|${u.searchParams.get('prfplccd')}`
  return { status: 200, text: lists[key] ?? list() }
}

test('monthRange: 2026-01부터 오늘(KST)의 12개월 뒤까지', () => {
  const r = monthRange(new Date('2026-11-24T03:00:00Z'))
  assert.deepEqual([r[0], r.at(-1), r.length], ['2026-01', '2027-11', 23])
  assert.equal(monthRange(new Date('2026-12-31T16:00:00Z')).at(-1), '2028-01') // KST로는 다음 달
})

test('tags: 태그 내용을 공백 다듬고 엔티티를 푼다', () => {
  assert.deepEqual(tags('<a> x &amp; y </a><a>&lt;b&gt;</a>', 'a'), ['x & y', '<b>'])
})

test('fetchList: 한 달 범위·공연장 코드로 요청하고 날짜를 YYYY-MM-DD로 바꾼다', async () => {
  let sent = ''
  const rows = await fetchList(KEY, '2026-02', 'FC001247-07', async (url) => ((sent = url), { status: 200, text: list(db('PF1', '공연', '2026.02.28', '2026.03.01')) }))
  const u = new URL(sent), q = u.searchParams
  assert.equal(u.origin + u.pathname, 'https://kopis.or.kr/openApi/restful/pblprfr')
  assert.deepEqual([q.get('stdate'), q.get('eddate'), q.get('prfplccd'), q.get('service')], ['20260201', '20260228', 'FC001247-07', KEY])
  assert.deepEqual([q.get('cpage'), q.get('rows')], ['1', '100']) // rows가 줄면 공연이 조용히 잘린다
  assert.deepEqual(rows, [{ id: 'PF1', name: '공연', from: '2026-02-28', to: '2026-03-01' }])
})

test('fetchList: HTTP 오류, XML 아님, 필드 누락, 100건 이상은 에러', async () => {
  const get = (status: number, text: string): Get => async () => ({ status, text })
  await assert.rejects(fetchList(KEY, '2026-02', 'X', get(500, '')), /HTTP 500/)
  // 거절 사유는 본문 앞부분으로 남기고, 본문에 키가 있으면 가린다
  await assert.rejects(fetchList(KEY, '2026-02', 'X', get(400, `<error>bad ${KEY}</error>`)), (err: Error) =>
    err.message.includes('HTTP 400 (<error>bad ***</error>)') && !err.message.includes(KEY),
  )
  await assert.rejects(fetchList(KEY, '2026-02', 'X', get(200, '<html>')), /XML이 아닌/)
  await assert.rejects(fetchList(KEY, '2026-02', 'X', get(200, list('<db><mt20id>PF1</mt20id></db>'))), /필드/)
  await assert.rejects(fetchList(KEY, '2026-02', 'X', get(200, list(...Array(100).fill(db('PF1', 'a', '2026.02.01', '2026.02.01'))))), /100건/)
})

test('fetchDetail: 주소에 키와 인코딩한 공연 ID를 넣는다', async () => {
  let sent = ''
  await fetchDetail(KEY, 'A/B', async (url) => ((sent = url), { status: 200, text: detail('A/B') }))
  assert.equal(sent, 'https://kopis.or.kr/openApi/restful/pblprfr/A%2FB?service=k')
})

test('fetchDetail: festival 태그가 없거나 비면 페스티벌이 아님', async () => {
  const d = await fetchDetail(KEY, 'PF1', async () => ({ status: 200, text: '<dbs><db><mt20id>PF1</mt20id></db></dbs>' }))
  assert.deepEqual(d, { festival: false, guidance: '', runtime: '' })
  const e = await fetchDetail(KEY, 'PF1', async () => ({ status: 200, text: detail('PF1', '') }))
  assert.equal(e.festival, false)
})

test('fetchDetail: 페스티벌·시각·런타임을 읽고, ID가 다르면 에러', async () => {
  const d = await fetchDetail(KEY, 'PF1', async () => ({ status: 200, text: detail('PF1', 'N', '토요일 ~ 일요일(14:00)', '8시간') }))
  assert.deepEqual(d, { festival: false, guidance: '토요일 ~ 일요일(14:00)', runtime: '8시간' })
  await assert.rejects(fetchDetail(KEY, 'PF1', async () => ({ status: 200, text: detail('PF2') })), /ID가 다름/)
})

test('fetchShows: 여러 달·공연장에 나온 공연은 하나로 합쳐 공연장을 모으고 상세를 붙인다', async () => {
  const get = fake({
    '20260501|FC001247-07': list(db('PF1', '재즈', '2026.05.30', '2026.06.01')),
    '20260601|FC001247-07': list(db('PF1', '재즈', '2026.05.30', '2026.06.01')),
    '20260501|FC001247-12': list(db('PF1', '재즈', '2026.05.30', '2026.06.01')),
  })
  const shows = await fetchShows(new Date('2026-07-01T00:00:00Z'), get, noSleep, KEY)
  assert.equal(shows.length, 1)
  assert.deepEqual(shows[0].places, ['FC001247-07', 'FC001247-12'])
  assert.equal(shows[0].festival, true)
})

test('fetchShows: 공연장 목록은 들어온 순서와 상관없이 코드 순으로 정렬한다', async () => {
  const get = fake({
    '20260501|FC001247-12': list(db('PF1', '재즈', '2026.05.30', '2026.06.01')),
    '20260601|FC001247-07': list(db('PF1', '재즈', '2026.05.30', '2026.06.01')),
  })
  const [s] = await fetchShows(new Date('2026-07-01T00:00:00Z'), get, noSleep, KEY)
  assert.deepEqual(s.places, ['FC001247-07', 'FC001247-12'])
})

test('fetchShows: 첫 호출을 뺀 모든 호출 앞에서 300ms씩 쉰다', async () => {
  const waits: number[] = []
  let calls = 0
  const base = fake({ '20260501|FC001247-07': list(db('PF1', 'a', '2026.05.01', '2026.05.01'), db('PF2', 'b', '2026.05.02', '2026.05.02')) })
  const get: Get = (url) => (calls++, base(url))
  await fetchShows(new Date('2026-07-01T00:00:00Z'), get, async (ms) => void waits.push(ms), KEY)
  assert.equal(waits.length, calls - 1)
  assert.ok(waits.every((ms) => ms === 300))
})

test('fetchShows: 한 번이라도 실패하면 전체 실패, 0건이면 에러', async () => {
  let n = 0
  const failing: Get = async () => (++n === 5 ? { status: 503, text: '' } : { status: 200, text: list() })
  await assert.rejects(fetchShows(new Date('2026-07-01T00:00:00Z'), failing, noSleep, KEY), /HTTP 503/)
  await assert.rejects(fetchShows(new Date('2026-07-01T00:00:00Z'), fake({}), noSleep, KEY), /한 건도 없음/)
})
