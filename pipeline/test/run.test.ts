import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runTarget, type Target } from '../run.ts'

const target = (build: Target['build'], errors: string[] = []): Target => ({
  name: 't',
  file: 'out.json',
  build,
  check: () => errors,
})

const capture = () => {
  const writes: [string, string][] = []
  return { writes, write: (f: string, s: string) => void writes.push([f, s]) }
}

test('검사를 통과하면 저장한다', async () => {
  const { writes, write } = capture()
  assert.equal(await runTarget(target(() => [1]), write), true)
  assert.deepEqual(writes, [['out.json', '[\n  1\n]\n']])
})

test('검사에 실패하면 저장하지 않는다', async () => {
  const { writes, write } = capture()
  assert.equal(await runTarget(target(() => [1], ['오류']), write), false)
  assert.equal(writes.length, 0)
})

test('생성 중 오류가 나면 저장하지 않는다', async () => {
  const { writes, write } = capture()
  const ok = await runTarget(
    target(() => {
      throw new Error('원본 없음')
    }),
    write,
  )
  assert.equal(ok, false)
  assert.equal(writes.length, 0)
})
