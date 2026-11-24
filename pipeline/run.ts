// 생성 → 검사 → 통과한 파일만 저장. 실패한 대상은 이전 파일을 그대로 두고 종료 코드 1.
// 실행: node run.ts            (전체)
//       node run.ts closures   (일부만)
import { renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkClosures, checkEvents, checkForecast, checkSize } from './check/check.ts'
import { loadAndBuildClosures } from './clean/closures.ts'
import { loadAndBuild as loadAndBuildEvents } from './clean/events.ts'
import { loadAndBuildForecast } from './clean/forecast.ts'

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'public', 'data')

export type Target = {
  name: string
  file: string
  build: () => unknown | Promise<unknown>
  check: (data: unknown) => string[]
}

// 매일 바뀌는 forecast를 먼저. events는 요청할 달이 계속 늘어 가장 느리다.
export const TARGETS: Target[] = [
  { name: 'forecast', file: join(DATA, 'forecast.json'), build: () => loadAndBuildForecast(), check: checkForecast },
  { name: 'closures', file: join(DATA, 'closures.json'), build: loadAndBuildClosures, check: checkClosures },
  { name: 'events', file: join(DATA, 'events.json'), build: loadAndBuildEvents, check: checkEvents },
]

const MAX_SHOWN = 20

// 쓰는 도중 실패해도 기존 파일이 깨지지 않게 임시 파일에 쓴 뒤 바꿔 끼운다.
export function writeAtomic(file: string, text: string) {
  const tmp = `${file}.tmp`
  try {
    writeFileSync(tmp, text)
    renameSync(tmp, file)
  } catch (err) {
    rmSync(tmp, { force: true })
    throw err
  }
}

export async function runTarget(t: Target, write: (file: string, text: string) => void = writeAtomic): Promise<boolean> {
  let data: unknown
  try {
    data = await t.build()
  } catch (err) {
    console.error(`[${t.name}] 생성 실패: ${(err as Error).message}`)
    return false
  }
  const text = JSON.stringify(data, null, 2) + '\n'
  const errors = [...t.check(data), ...checkSize(text)]
  if (errors.length) {
    console.error(`[${t.name}] 검사 실패 ${errors.length}건, 이전 파일 유지`)
    for (const e of errors.slice(0, MAX_SHOWN)) console.error(`  - ${e}`)
    if (errors.length > MAX_SHOWN) console.error(`  … 외 ${errors.length - MAX_SHOWN}건`)
    return false
  }
  try {
    write(t.file, text)
  } catch (err) {
    console.error(`[${t.name}] 저장 실패: ${(err as Error).message}`)
    return false
  }
  console.log(`[${t.name}] 저장 (${Array.isArray(data) ? `${data.length}건, ` : ''}${Buffer.byteLength(text)}B)`)
  return true
}

if (import.meta.main) {
  const names = process.argv.slice(2)
  const unknown = names.filter((n) => !TARGETS.some((t) => t.name === n))
  if (unknown.length) {
    console.error(`알 수 없는 대상: ${unknown.join(', ')} (가능: ${TARGETS.map((t) => t.name).join(', ')})`)
    process.exit(2)
  }
  const selected = names.length ? TARGETS.filter((t) => names.includes(t.name)) : TARGETS
  let ok = true
  for (const t of selected) ok = (await runTarget(t)) && ok
  if (!ok) process.exitCode = 1
}
