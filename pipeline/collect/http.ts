export interface FetchOptions {
  retries?: number
  retryWaitMs?: number
  spacingMs?: number
  timeoutMs?: number
  fetchFn?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

export interface TextResponse {
  status: number
  text: string
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

// 429, 5xx, 네트워크 오류·타임아웃은 retryWaitMs만큼 기다린 뒤 최대 retries번 다시 시도한다.
// 오류 메시지에는 URL을 넣지 않는다(쿼리에 키가 있음). 키가 다른 곳으로 넘어가지 않게 리다이렉트는 오류로 본다.
export async function fetchText(url: string, options: FetchOptions = {}): Promise<TextResponse> {
  const { retries = 2, retryWaitMs = 30_000, timeoutMs = 30_000, fetchFn = fetch, sleep = realSleep } = options
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'error' })
      const retryable = res.status === 429 || res.status >= 500
      if (!retryable || attempt >= retries) return { status: res.status, text: await res.text() }
    } catch (err) {
      if (attempt >= retries) {
        const e = err as Error
        throw new Error(`요청 실패 (${e.name}: ${e.message})`)
      }
    }
    await sleep(retryWaitMs)
  }
}

// 연속 호출 사이에 spacingMs 간격을 둔다.
export function createSpacedFetch(options: FetchOptions = {}) {
  const { spacingMs = 5_000, sleep = realSleep } = options
  let last = 0
  return async (url: string): Promise<TextResponse> => {
    const wait = last + spacingMs - Date.now()
    if (last && wait > 0) await sleep(wait)
    try {
      return await fetchText(url, options)
    } finally {
      last = Date.now()
    }
  }
}
