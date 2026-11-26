import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseEnv } from '../collect/env.ts'
import { createSpacedFetch, fetchText } from '../collect/http.ts'

const res = (status: number, body = '') => new Response(body, { status })
const noSleep = async () => {}

test('429 뒤 재시도해서 성공하면 성공 응답을 돌려준다', async () => {
  const statuses = [429, 429, 200]
  const waits: number[] = []
  const out = await fetchText('http://x', {
    fetchFn: async () => res(statuses.shift()!, 'ok'),
    sleep: async (ms) => void waits.push(ms),
    retryWaitMs: 30_000,
  })
  assert.equal(out.status, 200)
  assert.equal(out.text, 'ok')
  assert.deepEqual(waits, [30_000, 30_000])
})

test('재시도 횟수를 넘으면 마지막 429를 그대로 돌려준다', async () => {
  let calls = 0
  const out = await fetchText('http://x', {
    fetchFn: async () => (calls++, res(429)),
    sleep: noSleep,
    retries: 2,
  })
  assert.equal(out.status, 429)
  assert.equal(calls, 3)
})

test('404 같은 4xx는 재시도하지 않는다', async () => {
  let calls = 0
  const out = await fetchText('http://x', { fetchFn: async () => (calls++, res(404)), sleep: noSleep })
  assert.equal(out.status, 404)
  assert.equal(calls, 1)
})

test('네트워크 오류는 재시도하고, 성공하면 응답을 돌려준다', async () => {
  let calls = 0
  const out = await fetchText('http://x', {
    fetchFn: async () => {
      if (calls++ === 0) throw new TypeError('fetch failed')
      return res(200, 'ok')
    },
    sleep: noSleep,
  })
  assert.equal(out.status, 200)
  assert.equal(calls, 2)
})

test('재시도 한도를 넘은 오류는 URL 없이 던진다', async () => {
  const url = 'http://x?serviceKey=SECRET'
  await assert.rejects(
    fetchText(url, {
      fetchFn: async () => {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
      },
      sleep: noSleep,
    }),
    (err: Error) => err.message.includes('TimeoutError') && !err.message.includes('SECRET'),
  )
})

test('연결 오류는 cause의 코드만 붙이고 cause 메시지는 넣지 않는다', async () => {
  const fail = (cause: unknown) =>
    fetchText('http://x', {
      fetchFn: async () => {
        throw new TypeError('fetch failed', { cause })
      },
      sleep: noSleep,
    })
  await assert.rejects(fail({ code: 'ETIMEDOUT', message: 'connect ETIMEDOUT 1.2.3.4:443' }), (err: Error) =>
    err.message === '요청 실패 (TypeError: fetch failed, ETIMEDOUT)',
  )
  await assert.rejects(fail(undefined), (err: Error) => err.message === '요청 실패 (TypeError: fetch failed)')
})

test('리다이렉트는 따라가지 않도록 요청한다', async () => {
  let init: RequestInit | undefined
  await fetchText('http://x', { fetchFn: async (_u, i) => ((init = i), res(200)), sleep: noSleep })
  assert.equal(init?.redirect, 'error')
})

test('연속 호출 사이에 간격을 둔다', async () => {
  const waits: number[] = []
  const get = createSpacedFetch({
    fetchFn: async () => res(200),
    sleep: async (ms) => void waits.push(ms),
    spacingMs: 5_000,
  })
  await get('http://x')
  assert.equal(waits.length, 0)
  await get('http://x')
  assert.equal(waits.length, 1)
  assert.ok(waits[0] > 0 && waits[0] <= 5_000)
})

test('parseEnv는 KEY=값, 주석, 따옴표, 값 안의 =를 처리한다', () => {
  const env = parseEnv('# 주석\nA=1\n\nB = "x y"\nC=a=b%3D\r\nbad line\nD=k1   # 설명\nE=a#b\n')
  assert.deepEqual(env, { A: '1', B: 'x y', C: 'a=b%3D', D: 'k1', E: 'a#b' })
})
