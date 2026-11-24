import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_ENV_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')

export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 1) continue
    const name = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (/^(".*"|'.*')$/.test(value)) value = value.slice(1, -1)
    else value = value.replace(/\s+#.*$/, '') // 줄 끝 주석. 공백 없이 붙은 #은 값으로 둔다
    out[name] = value
  }
  return out
}

// 환경변수(Actions Secrets)가 우선이고, 없으면 pipeline/.env 파일을 쓴다.
export function getKey(name: string, envPath = DEFAULT_ENV_PATH): string {
  const fromProcess = process.env[name]
  if (fromProcess) return fromProcess
  const fromFile = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8'))[name] : undefined
  if (!fromFile) throw new Error(`키가 없습니다: ${name} (환경변수 또는 pipeline/.env)`)
  return fromFile
}
