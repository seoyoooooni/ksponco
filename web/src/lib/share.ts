import type { VenueId } from '../data/types'
import type { SunPref } from './comfort'
import { clockLabel, dateLabel } from './format'

export type SharedSpot = {
  venue: VenueId
  date: string
  mat: { x: number; z: number }
  stay: [number, number] | null
  pref: SunPref | null
}

const VENUES: VenueId[] = ['lawn88', 'lake']

export const SITE_URL = 'https://seoyoooooni.github.io/ksponco/'
export const OG_TITLE = 'SunSeat'
export const OG_DESC = '그늘·볕·무대 보임을 3D로 미리 보고 같이 앉을 자리를 골라요'
export const OG_IMAGE = `${SITE_URL}og.png`

function parse(search: string): SharedSpot | null {
  const q = new URLSearchParams(search)
  const venue = q.get('venue') as VenueId | null
  const date = q.get('date')
  const at = q.get('mat')?.split(',').map(Number)
  if (!venue || !VENUES.includes(venue) || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  if (!at || at.length !== 2 || !at.every(Number.isFinite)) return null
  const s = q.get('stay')?.split(',').map(Number)
  const stay: [number, number] | null = s && s.length === 2 && s.every(Number.isFinite) && s[0] >= 0 && s[0] < s[1] && s[1] <= 24 ? [s[0], s[1]] : null
  const p = q.get('pref')
  const pref: SunPref | null = p === 'shade' || p === 'sun' ? p : null
  return { venue, date, mat: { x: at[0], z: at[1] }, stay, pref }
}

let pending: SharedSpot | null = parse(window.location.search)

if (pending) window.history.replaceState(null, '', window.location.pathname + window.location.hash)

export const initialShare = pending

export function takeSharedStay(venue: VenueId, date: string): SharedSpot | null {
  if (!pending) return null
  if (pending.venue !== venue || pending.date !== date) {
    pending = null
    return null
  }
  return pending
}

export function forgetShare() {
  pending = null
}

export function sameSpot(a: { x: number; z: number } | null, b: { x: number; z: number }): boolean {
  return a !== null && Math.abs(a.x - b.x) < 0.05 && Math.abs(a.z - b.z) < 0.05
}

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100

export type ShareInput = { venue: VenueId; date: string; mat: { x: number; z: number }; stay: [number, number]; pref: SunPref | null }

export function shareUrl(s: ShareInput): string {
  const q = new URLSearchParams({ venue: s.venue, date: s.date, mat: `${r1(s.mat.x)},${r1(s.mat.z)}`, stay: `${r2(s.stay[0])},${r2(s.stay[1])}` })
  if (s.pref) q.set('pref', s.pref)
  return `${window.location.origin}${window.location.pathname}?${q.toString()}`
}

export function shareMessage(place: string, date: string, today: string, from: number): string {
  const day = date === today ? '오늘' : dateLabel(date)
  return `${day} ${clockLabel(from)}, ${place} 여기로 와요`
}

export function canNativeShare(): boolean {
  return typeof navigator.share === 'function'
}

export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed'

export async function nativeShare(url: string, title: string, text: string): Promise<ShareResult> {
  try {
    await navigator.share({ title, text, url })
    return 'shared'
  } catch (e) {
    return e instanceof DOMException && e.name === 'AbortError' ? 'cancelled' : 'failed'
  }
}

export async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    try {
      const area = document.createElement('textarea')
      area.value = url
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      const ok = document.execCommand('copy')
      area.remove()
      return ok
    } catch {
      return false
    }
  }
}

type KakaoSdk = {
  isInitialized: () => boolean
  init: (key: string) => void
  Share: { sendDefault: (o: unknown) => void }
}

const KAKAO_KEY = import.meta.env.VITE_KAKAO_JS_KEY
const KAKAO_SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'
let kakaoLoading: Promise<KakaoSdk | null> | null = null

function loadKakao(): Promise<KakaoSdk | null> {
  if (!KAKAO_KEY) return Promise.resolve(null)
  if (!kakaoLoading) {
    kakaoLoading = new Promise((resolve) => {
      const ready = () => {
        const k = (window as unknown as { Kakao?: KakaoSdk }).Kakao
        if (!k) return resolve(null)
        if (!k.isInitialized()) k.init(KAKAO_KEY)
        resolve(k)
      }
      if ((window as unknown as { Kakao?: KakaoSdk }).Kakao) return ready()
      const script = document.createElement('script')
      script.src = KAKAO_SDK
      script.async = true
      script.onload = ready
      script.onerror = () => {
        kakaoLoading = null
        resolve(null)
      }
      document.head.appendChild(script)
    })
  }
  return kakaoLoading
}

export function preloadKakao() {
  void loadKakao()
}

function publicUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${SITE_URL}${u.search}`
  } catch {
    return SITE_URL
  }
}

export async function kakaoShare(localUrl: string, title: string, text: string): Promise<ShareResult> {
  const kakao = await loadKakao()
  if (kakao) {
    const url = publicUrl(localUrl)
    try {
      kakao.Share.sendDefault({
        objectType: 'feed',
        content: { title: text, description: title, imageUrl: OG_IMAGE, link: { mobileWebUrl: url, webUrl: url } },
        buttons: [{ title: '자리 보기', link: { mobileWebUrl: url, webUrl: url } }],
      })
      return 'shared'
    } catch {
      return 'failed'
    }
  }
  if (canNativeShare() && window.matchMedia('(pointer: coarse)').matches) return nativeShare(localUrl, title, text)
  return (await copyLink(`${text}\n${localUrl}`)) ? 'copied' : 'failed'
}
