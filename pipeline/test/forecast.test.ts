import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { addDays, fetchAsosDailyRain, fetchAsosHourlyRain, fetchVilage, kstNow, vilageBase, type VilageItem } from '../collect/kma.ts'
import { buildForecast, buildRainHourly, loadAndBuildForecast, parsePcp, previousRainHourly, previousRainPrevDay } from '../clean/forecast.ts'

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
  assert.equal(parsePcp('0.0'), 0) // 단위 없는 숫자
  assert.equal(parsePcp('2.5'), 2.5)
  assert.throws(() => parsePcp('많음'))
})

test('previousRainPrevDay: 이전 파일의 오늘 값, 없거나 읽지 못하면 null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forecast-test-'))
  try {
    const file = join(dir, 'forecast.json')
    writeFileSync(file, JSON.stringify({ updated: 'u', days: [{ date: '2026-11-24', rainPrevDay: 3.5 }] }))
    assert.equal(previousRainPrevDay('2026-11-24', file), 3.5)
    assert.equal(previousRainPrevDay('2026-11-25', file), null)
    assert.equal(previousRainPrevDay('2026-11-24', join(dir, 'none.json')), null)
    writeFileSync(file, '{')
    assert.equal(previousRainPrevDay('2026-11-24', file), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('loadAndBuildForecast: ASOS 성공, 실패 시 이전 값 대체, 대체 불가, 키 없음', async () => {
  const now = new Date('2026-11-23T02:30:00Z') // KST 11:30
  const vilage = {
    response: {
      header: { resultCode: '00' },
      body: { totalCount: 3, items: { item: [it('TMX', '2026-11-23', 15, '5'), it('SKY', '2026-11-23', 12, '1'), it('PTY', '2026-11-23', 12, '0')] } },
    },
  }
  const asos = { response: { header: { resultCode: '00' }, body: { items: { item: [{ tm: '2026-11-22', sumRn: '2.5' }] } } } }
  const hourly = { response: { header: { resultCode: '00' }, body: { items: { item: [{ tm: '2026-11-22 00:00', rn: '' }] } } } }
  let asosCalls = 0
  const get = (asosOk: boolean) => async (url: string) => {
    if (url.includes('apihub.kma.go.kr')) return { status: 200, text: JSON.stringify(vilage) }
    asosCalls++
    // 시간자료는 늘 성공시켜, 종료 코드가 일자료 대체 경로에서만 나오는지 본다
    if (url.includes('AsosHourly')) return { status: 200, text: JSON.stringify(hourly) }
    return asosOk ? { status: 200, text: JSON.stringify(asos) } : { status: 500, text: '' }
  }
  const key = () => 'K'
  const dir = mkdtempSync(join(tmpdir(), 'forecast-test-'))
  const savedExit = process.exitCode
  try {
    const prev = join(dir, 'forecast.json')
    const none = join(dir, 'none.json')
    writeFileSync(prev, JSON.stringify({ updated: 'u', days: [{ date: '2026-11-23', rainPrevDay: 3.5 }] }))

    const okRun = await loadAndBuildForecast(now, get(true), prev, key)
    assert.equal(okRun.days[0].rainPrevDay, 2.5)
    assert.equal(process.exitCode, savedExit)

    const fallback = await loadAndBuildForecast(now, get(false), prev, key)
    assert.equal(fallback.days[0].rainPrevDay, 3.5)
    assert.equal(process.exitCode, 1)
    process.exitCode = savedExit

    await assert.rejects(loadAndBuildForecast(now, get(false), none, key), /ASOS 일자료: HTTP 500/)

    asosCalls = 0
    const noAsosKey = (name: string) => {
      if (name === 'ASOS_DAILY_KEY') throw new Error(`키가 없습니다: ${name}`)
      return 'K'
    }
    await assert.rejects(loadAndBuildForecast(now, get(true), prev, noAsosKey), /키가 없습니다: ASOS_DAILY_KEY/)
    assert.equal(asosCalls, 0)
  } finally {
    process.exitCode = savedExit
    rmSync(dir, { recursive: true, force: true })
  }
})

test('날짜별 대표값: TMX 있는 날만, SKY 최빈값, PTY 비, 전날 강수량', () => {
  const T = '2026-11-23'
  const T1 = '2026-11-24'
  const items = [
    it('TMX', T, 15, '10.0'),
    ...[9, 10, 11, 12].map((h) => it('SKY', T, h, '1')),
    ...[13, 14, 15].map((h) => it('SKY', T, h, '4')),
    it('SKY', T, 20, '4'), // 18시 이후라 하늘 판단에서 제외
    it('PTY', T, 12, '0'),
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
  const items = [
    it('TMX', '2026-11-22', 15, '5'),
    it('SKY', '2026-11-22', 12, '1'),
    it('TMX', '2026-11-23', 15, '6'),
    it('SKY', '2026-11-23', 12, '1'),
    it('PTY', '2026-11-23', 12, '0'),
  ]
  assert.deepEqual(buildForecast(items, '2026-11-23', 0, 'u').days.map((d) => d.date), ['2026-11-23'])
})

test('09~21시 PTY가 없으면 비 없음으로 보지 않고 오류', () => {
  const items = [it('TMX', '2026-11-23', 15, '5'), it('SKY', '2026-11-23', 12, '1'), it('PTY', '2026-11-23', 22, '1')]
  assert.throws(() => buildForecast(items, '2026-11-23', 0, 'u'), /PTY 없음/)
})

test('모르는 SKY 코드는 오류', () => {
  const items = [it('TMX', '2026-11-23', 15, '5'), it('SKY', '2026-11-23', 12, '2'), it('PTY', '2026-11-23', 12, '0')]
  assert.throws(() => buildForecast(items, '2026-11-23', 0, 'u'), /SKY 코드 오류/)
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

test('fetchVilage: 1000건을 넘으면 다음 페이지를 이어서 받는다', async () => {
  const rows = Array.from({ length: 1200 }, (_, n) => it('TMP', '2026-11-23', n % 24, String(n)))
  const pages: string[] = []
  const get = async (u: string) => {
    const page = Number(new URL(u).searchParams.get('pageNo'))
    pages.push(String(page))
    const item = rows.slice((page - 1) * 1000, page * 1000)
    return { status: 200, text: JSON.stringify({ response: { header: { resultCode: '00' }, body: { totalCount: 1200, items: { item } } } }) }
  }
  const got = await fetchVilage(new Date('2026-11-23T02:30:00Z'), get, 'K')
  assert.equal(got.length, 1200)
  assert.deepEqual(pages, ['1', '2'])
})

test('fetchAsosDailyRain: 빈 sumRn은 0, 값은 숫자, 자료 없으면 오류', async () => {
  const res = (sumRn: string) => ok({ response: { header: { resultCode: '00' }, body: { items: { item: [{ tm: '2026-11-22', sumRn }] } } } })
  assert.equal(await fetchAsosDailyRain('2026-11-22', res(''), 'K'), 0)
  assert.equal(await fetchAsosDailyRain('2026-11-22', res('12.5'), 'K'), 12.5)
  await assert.rejects(fetchAsosDailyRain('2026-11-21', res('1'), 'K'), /자료 없음/)
  const noField = ok({ response: { header: { resultCode: '00' }, body: { items: { item: [{ tm: '2026-11-22' }] } } } })
  await assert.rejects(fetchAsosDailyRain('2026-11-22', noField, 'K'), /sumRn 필드 없음/)
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

test('fetchAsosHourlyRain: 빈 rn은 0, 결측(rnQcflg 9)과 빠진 시각은 null', async () => {
  const row = (h: number, rn: string, rnQcflg = '') => ({ tm: `2026-11-22 ${String(h).padStart(2, '0')}:00`, rn, rnQcflg })
  const item = [row(0, ''), row(1, '0.0'), row(2, '3.5'), row(3, '', '9'), { tm: '2026-11-21 23:00', rn: '9' }]
  let url = ''
  const got = await fetchAsosHourlyRain('2026-11-22', async (u) => ((url = u), { status: 200, text: JSON.stringify({ response: { header: { resultCode: '00' }, body: { items: { item } } } }) }), 'K')
  assert.deepEqual(got.slice(0, 5), [0, 0, 3.5, null, null])
  assert.equal(got.length, 24)
  assert.match(url, /AsosHourlyInfoService.*dateCd=HR&startDt=20261122&startHh=00&endDt=20261122&endHh=23&stnIds=108/)
  const res = (body: unknown) => ok({ response: { header: { resultCode: '00' }, body: { items: { item: [body] } } } })
  await assert.rejects(fetchAsosHourlyRain('2026-11-22', res({ tm: '2026-11-22 00:00' }), 'K'), /rn 필드 없음/)
  await assert.rejects(fetchAsosHourlyRain('2026-11-22', res(row(0, '-1')), 'K'), /rn 값 오류/)
  await assert.rejects(fetchAsosHourlyRain('2026-11-22', ok({ response: { header: { resultCode: '03' } } }), 'K'), /resultCode 03/)
  // 정상 코드인데 그날 행이 없거나 tm 형식이 바뀌면 조용히 null로 넘기지 않는다
  await assert.rejects(fetchAsosHourlyRain('2026-11-22', ok({ response: { header: { resultCode: '00' }, body: { items: '' } } }), 'K'), /자료 없음/)
  await assert.rejects(fetchAsosHourlyRain('2026-11-22', res({ tm: '2026-11-22 00:00:00', rn: '1' }), 'K'), /자료 없음/)
})

test('buildRainHourly: 이전 파일 → 예보 → 관측 순으로 덮고, null은 앞 값을 지우지 않는다', () => {
  // 어제(22일) 00시 ~ 24일 23시 = 72칸
  const prev = { start: '2026-11-21T00:00+09:00', mm: [...Array(24).fill(9), 1, 2, null, ...Array(45).fill(3)] } // 21~23일
  const items = [
    it('PCP', '2026-11-22', 0, '8.0mm'), // 관측이 덮음
    it('PCP', '2026-11-22', 1, '6.0mm'), // 관측 null이라 예보가 남음
    it('PCP', '2026-11-23', 6, '1mm 미만'),
    it('PCP', '2026-11-24', 23, '4.0mm'),
    it('PCP', '2026-11-25', 0, '이상한값'), // 범위 밖은 해석하지 않음
    it('TMP', '2026-11-23', 7, '5'),
  ]
  const observed = [5, null, ...Array(22).fill(0)]
  const r = buildRainHourly('2026-11-22', '2026-11-24', items, prev, observed)
  assert.equal(r.start, '2026-11-22T00:00+09:00')
  assert.equal(r.mm.length, 72)
  assert.deepEqual(r.mm.slice(0, 3), [5, 6, 0]) // 관측 > 예보 > 이전 값, 관측 0
  assert.equal(r.mm[24 + 6], 0.5) // 예보가 이전 값을 덮음
  assert.equal(r.mm[24 + 7], 3) // TMP는 무시
  assert.equal(r.mm[71], 4)
  assert.deepEqual(r.mm.slice(48, 71), Array(23).fill(null)) // 이전 파일 범위 밖(24일 00~22시)
  assert.deepEqual(buildRainHourly('2026-11-22', '2026-11-22', [], null, null).mm, Array(24).fill(null))
})

test('previousRainHourly: 형식이 맞을 때만 읽고, 이상한 값은 null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'forecast-test-'))
  try {
    const file = join(dir, 'forecast.json')
    writeFileSync(file, JSON.stringify({ rainHourly: { start: '2026-11-22T00:00+09:00', mm: [1, null, -1, 'x'] } }))
    assert.deepEqual(previousRainHourly(file), { start: '2026-11-22T00:00+09:00', mm: [1, null, null, null] })
    writeFileSync(file, JSON.stringify({ updated: 'u', days: [] }))
    assert.equal(previousRainHourly(file), null)
    writeFileSync(file, JSON.stringify({ rainHourly: { start: '2026-11-22', mm: [] } }))
    assert.equal(previousRainHourly(file), null)
    assert.equal(previousRainHourly(join(dir, 'none.json')), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('loadAndBuildForecast: rainHourly는 어제 00시부터, ASOS 시간자료 실패 시 이전 값 유지하고 종료 코드 1', async () => {
  const now = new Date('2026-11-23T04:30:00Z') // KST 13:30
  const vilage = {
    response: {
      header: { resultCode: '00' },
      body: { totalCount: 4, items: { item: [it('TMX', '2026-11-23', 15, '5'), it('SKY', '2026-11-23', 12, '1'), it('PTY', '2026-11-23', 12, '0'), it('PCP', '2026-11-23', 12, '2.0mm')] } },
    },
  }
  const daily = { response: { header: { resultCode: '00' }, body: { items: { item: [{ tm: '2026-11-22', sumRn: '' }] } } } }
  const hourly = { response: { header: { resultCode: '00' }, body: { items: { item: [{ tm: '2026-11-22 05:00', rn: '1.5' }] } } } }
  const get = (hourlyOk: boolean) => async (url: string) => {
    if (url.includes('apihub.kma.go.kr')) return { status: 200, text: JSON.stringify(vilage) }
    if (url.includes('AsosHourly')) return hourlyOk ? { status: 200, text: JSON.stringify(hourly) } : { status: 500, text: '' }
    return { status: 200, text: JSON.stringify(daily) }
  }
  const dir = mkdtempSync(join(tmpdir(), 'forecast-test-'))
  const savedExit = process.exitCode
  try {
    const prev = join(dir, 'forecast.json')
    writeFileSync(prev, JSON.stringify({ rainHourly: { start: '2026-11-21T00:00+09:00', mm: [...Array(29).fill(0), 7] } })) // 22일 05시 = 7
    const okRun = await loadAndBuildForecast(now, get(true), prev, () => 'K')
    assert.equal(okRun.rainHourly.start, '2026-11-22T00:00+09:00')
    assert.equal(okRun.rainHourly.mm.length, 48)
    assert.equal(okRun.rainHourly.mm[5], 1.5)
    assert.equal(okRun.rainHourly.mm[36], 2)
    assert.equal(process.exitCode, savedExit)

    const failRun = await loadAndBuildForecast(now, get(false), prev, () => 'K')
    assert.equal(failRun.rainHourly.mm[5], 7)
    assert.equal(process.exitCode, 1)
  } finally {
    process.exitCode = savedExit
    rmSync(dir, { recursive: true, force: true })
  }
})
