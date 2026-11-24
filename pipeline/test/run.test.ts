import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { runTarget, writeAtomic, type Target } from '../run.ts'

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

test('writeAtomic: 기존 파일을 바꿔 끼우고 임시 파일을 남기지 않는다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-test-'))
  try {
    const file = join(dir, 'out.json')
    writeFileSync(file, 'old')
    writeAtomic(file, 'new')
    assert.equal(readFileSync(file, 'utf8'), 'new')
    assert.equal(existsSync(`${file}.tmp`), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('writeAtomic: 바꿔 끼우기에 실패하면 예외를 던지고 임시 파일을 지운다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'run-test-'))
  try {
    const file = join(dir, 'out.json')
    mkdirSync(join(file, 'child'), { recursive: true }) // 대상이 비어 있지 않은 폴더라 rename 실패
    assert.throws(() => writeAtomic(file, 'new'))
    assert.equal(existsSync(`${file}.tmp`), false)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('저장 중 오류가 나면 false를 돌려주고 예외를 던지지 않는다', async () => {
  const ok = await runTarget(target(() => [1]), () => {
    throw new Error('EACCES')
  })
  assert.equal(ok, false)
})
