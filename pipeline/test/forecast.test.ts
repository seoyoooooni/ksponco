import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addDays, fetchAsosDailyRain, fetchVilage, kstNow, vilageBase, type VilageItem } from '../collect/kma.ts'
import { buildForecast, parsePcp } from '../clean/forecast.ts'

const it = (category: string, date: string, hour: number, value: string): VilageItem => ({
  category,
  fcstDate: date.replaceAll('-', ''),
  fcstTime: `${String(hour).padStart(2, '0')}00`,
  fcstValue: value,
})
const ok = (body: unknown) => async () => ({ status: 200, text: JSON.stringify(body) })

test('KST 날짜: UTC 15시는 KST 다음 날 0시', () => {
  assert.deepEqual(kstNow(new Date('2026-11-22T15:00:00Z')), { date: '2026-11-23', minutes: 0 })
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
})

test('05:30 KST 전에는 전날 05시 발표분을 쓴다', () => {
  assert.equal(vilageBase(new Date('2026-11-22T20:29:00Z')).baseDate, '20261122') // KST 11/23 05:29
  assert.equal(vilageBase(new Date('2026-11-22T20:30:00Z')).baseDate, '20261123') // KST 11/23 05:30
  assert.equal(vilageBase(new Date('2026-11-23T02:30:00Z')).baseDate, '20261123') // KST 11:30 (Actions)
})

test('PCP 문자열 해석', () => {
  assert.equal(parsePcp('강수없음'), 0)
  assert.equal(parsePcp('0'), 0)
  assert.equal(parsePcp('1mm 미만'), 0.5)
  assert.equal(parsePcp('1.0mm 미만'), 0.5)
  assert.equal(parsePcp('4.0mm'), 4)
  assert.equal(parsePcp('30.0~50.0mm'), 30)
  assert.equal(parsePcp('50.0mm 이상'), 50)
  assert.throws(() => parsePcp('많음'))
})

test('날짜별 대표값: TMX 있는 날만, SKY 최빈값, PTY 비, 전날 강수량', () => {
  const T = '2026-11-23'
  const T1 = '2026-11-24'
  const items = [
    it('TMX', T, 15, '10.0'),
    ...[9, 10, 11, 12].map((h) => it('SKY', T, h, '1')),
    ...[13, 14, 15].map((h) => it('SKY', T, h, '4')),
    it('SKY', T, 20, '4'), // 18시 이후라 하늘 판단에서 제외
    it('PTY', T, 22, '1'), // 21시 이후라 비 판단에서 제외
    it('PCP', T, 7, '1mm 미만'),
    it('PCP', T, 22, '4.0mm'),
    it('TMX', T1, 15, '6.0'),
    it('SKY', T1, 9, '3'),
    it('SKY', T1, 10, '4'), // 동점이면 더 흐린 쪽
    it('PTY', T1, 12, '1'),
    it('SKY', '2026-11-27', 12, '1'), // TMX 없는 날은 제외
  ]
  const f = buildForecast(items, T, 2.5, '2026-11-23T05:00+09:00')
  assert.equal(f.updated, '2026-11-23T05:00+09:00')
  assert.deepEqual(f.days, [
    { date: T, sky: '맑음', rain: false, rainPrevDay: 2.5, tempMax: 10 },
    { date: T1, sky: '흐림', rain: true, rainPrevDay: 4.5, tempMax: 6 },
  ])
})

test('오늘 이전 날짜는 넣지 않는다', () => {
  const items = [it('TMX', '2026-11-22', 15, '5'), it('SKY', '2026-11-22', 12, '1'), it('TMX', '2026-11-23', 15, '6'), it('SKY', '2026-11-23', 12, '1')]
  assert.deepEqual(buildForecast(items, '2026-11-23', 0, 'u').days.map((d) => d.date), ['2026-11-23'])
})

test('모르는 SKY 코드는 오류', () => {
  assert.throws(() => buildForecast([it('TMX', '2026-11-23', 15, '5'), it('SKY', '2026-11-23', 12, '2')], '2026-11-23', 0, 'u'))
})

test('fetchVilage: 정상 응답과 오류 응답', async () => {
  const items = [it('TMX', '2026-11-23', 15, '10.0')]
  const body = { response: { header: { resultCode: '00' }, body: { totalCount: 1, items: { item: items } } } }
  const now = new Date('2026-11-23T02:30:00Z')
  let url = ''
  const got = await fetchVilage(now, async (u) => ((url = u), { status: 200, text: JSON.stringify(body) }), 'K')
  assert.deepEqual(got, items)
  assert.match(url, /base_date=20261123&base_time=0500&nx=62&ny=126&authKey=K/)
  await assert.rejects(fetchVilage(now, ok({ response: { header: { resultCode: '03', resultMsg: 'NO_DATA' } } }), 'K'), /resultCode 03/)
  await assert.rejects(fetchVilage(now, async () => ({ status: 200, text: '<html>' }), 'K'), /JSON이 아닌/)
  await assert.rejects(
    fetchVilage(now, ok({ response: { header: { resultCode: '00' }, body: { totalCount: 2, items: { item: items } } } }), 'K'),
    /1\/2건/,
  )
})

test('fetchAsosDailyRain: 빈 sumRn은 0, 값은 숫자, 자료 없으면 오류', async () => {
  const res = (sumRn: string) => ok({ response: { header: { resultCode: '00' }, body: { items: { item: [{ tm: '2026-11-22', sumRn }] } } } })
  assert.equal(await fetchAsosDailyRain('2026-11-22', res(''), 'K'), 0)
  assert.equal(await fetchAsosDailyRain('2026-11-22', res('12.5'), 'K'), 12.5)
  await assert.rejects(fetchAsosDailyRain('2026-11-21', res('1'), 'K'), /자료 없음/)
})

test('fetchAsosDailyRain: 이미 인코딩된 키는 다시 인코딩하지 않는다', async () => {
  const urls: string[] = []
  const get = async (u: string) => {
    urls.push(u)
    return { status: 200, text: JSON.stringify({ response: { header: { resultCode: '00' }, body: { items: { item: [{ tm: '2026-11-22', sumRn: '' }] } } } }) }
  }
  await fetchAsosDailyRain('2026-11-22', get, 'a+b/c=')
  await fetchAsosDailyRain('2026-11-22', get, 'a%2Bb')
  assert.match(urls[0], /serviceKey=a%2Bb%2Fc%3D&/)
  assert.match(urls[1], /serviceKey=a%2Bb&/)
})
