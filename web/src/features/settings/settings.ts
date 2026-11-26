export type ThemeMode = 'system' | 'light' | 'dark'
export type Quality = 'high' | 'low'

export type Settings = {
  theme: ThemeMode
  quality: Quality
}

const KEY = 'sunseat.settings.v1'

export const DEFAULT_SETTINGS: Settings = { theme: 'system', quality: 'high' }

export const FEEDBACK_URL = `mailto:se0yn11016@gmail.com?subject=${encodeURIComponent('SunSeat 의견')}`

export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULT_SETTINGS
    const s = JSON.parse(raw) as Partial<Settings>
    return {
      theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
      quality: s.quality === 'low' ? 'low' : 'high',
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: Settings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    return
  }
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export function resolvedTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') return darkQuery().matches ? 'dark' : 'light'
  return mode
}

export function applyTheme(mode: ThemeMode) {
  const theme = resolvedTheme(mode)
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1b1f26' : '#ffffff')
}

export function watchSystemTheme(mode: ThemeMode): () => void {
  if (mode !== 'system') return () => {}
  const q = darkQuery()
  const on = () => applyTheme('system')
  q.addEventListener('change', on)
  return () => q.removeEventListener('change', on)
}
