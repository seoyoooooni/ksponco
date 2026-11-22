import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseItems, toRow, toSnapshot } from '../collect/linked.ts'

const xml = `<response><header><resultCode>0000</resultCode></header><body><items>
<item><TITLE>공연명:,공연관람객수:0</TITLE><ISSUED_DATE>2025-06-14 10:00:00</ISSUED_DATE><DESCRIPTION><![CDATA[주차대수:457,방문객:2285, 기온:28.2, 풍향:1.6, 강수량:, 습도:66,휴일:]]></DESCRIPTION></item>
<item><TITLE>공연명:뷰티풀 민트 라이프 2025,공연관람객수:14000</TITLE><ISSUED_DATE>2025-06-14 12:00:00</ISSUED_DATE><DESCRIPTION><![CDATA[기온:31.6, 강수량:]]></DESCRIPTION></item>
<item><TITLE>공연명:뷰티풀 민트 라이프 2025, 2025 IRENE &amp; SEULGI Concert,공연관람객수:16500</TITLE><ISSUED_DATE>2025-06-14 17:00:00</ISSUED_DATE><DESCRIPTION><![CDATA[기온:, 강수량:]]></DESCRIPTION></item>
</items><totalCount>3</totalCount></body></response>`

test('parseItems는 item 태그와 CDATA를 풀어 객체로 만든다', () => {
  const items = parseItems(xml)
  assert.equal(items.length, 3)
  assert.equal(items[0].ISSUED_DATE, '2025-06-14 10:00:00')
  assert.ok(items[0].DESCRIPTION.startsWith('주차대수:457'))
})

test('toRow는 공연명(엔티티 해제), 관객 수, 시각, 기온을 뽑는다', () => {
  const [a, b, c] = parseItems(xml).map(toRow)
  assert.deepEqual(a, { date: '2025-06-14', hour: 10, show: '', people: 0, temp: 28.2 })
  assert.deepEqual(b, { date: '2025-06-14', hour: 12, show: '뷰티풀 민트 라이프 2025', people: 14000, temp: 31.6 })
  assert.equal(c.show, '뷰티풀 민트 라이프 2025, 2025 IRENE & SEULGI Concert')
  assert.equal(c.temp, null)
})

test('toRow는 공연명 안의 쉼표를 자르지 않는다', () => {
  const row = toRow({ TITLE: '공연명:A, B,공연관람객수:5', ISSUED_DATE: '2025-01-01 09:00:00' })
  assert.equal(row.show, 'A, B')
  assert.equal(row.people, 5)
})

test('toRow는 ISSUED_DATE 형식이 틀리면 오류를 낸다', () => {
  assert.throws(() => toRow({ TITLE: '', ISSUED_DATE: '20250101' }))
})

test('toSnapshot은 날짜별 최고기온과 공연 행만 남긴다', () => {
  const snap = toSnapshot(parseItems(xml).map(toRow), '2026-11-23T00:00:00.000Z')
  assert.deepEqual(snap.tempMax, { '2025-06-14': 31.6 })
  assert.equal(snap.shows.length, 2)
  assert.deepEqual(snap.shows[0], { date: '2025-06-14', hour: 12, show: '뷰티풀 민트 라이프 2025', people: 14000 })
})

test('toSnapshot은 2025년이 아닌 행이 있으면 오류를 낸다', () => {
  assert.throws(() => toSnapshot([{ date: '2026-01-01', hour: 0, show: '', people: 0, temp: 1 }], 'x'))
})
