import type {
  Building,
  Closure,
  EventItem,
  Forecast,
  Layout,
  Terrain,
  Tree,
  Venue,
  VenueId,
} from './types'
import { rng } from '../lib/rng'

export class DataError extends Error {
  readonly path: string
  readonly status: number

  constructor(path: string, status: number) {
    super(`데이터를 불러오지 못했어요: ${path} (${status})`)
    this.path = path
    this.status = status
  }
}

const version: string = import.meta.env.VITE_DATA_VERSION ?? ''

export function dataUrl(path: string): string {
  const url = `${import.meta.env.BASE_URL}data/${path}`
  return version ? `${url}?v=${encodeURIComponent(version)}` : url
}

const cache = new Map<string, Promise<unknown>>()

export function fetchJson<T>(path: string): Promise<T> {
  const hit = cache.get(path)
  if (hit) return hit as Promise<T>
  const req = fetch(dataUrl(path)).then(async (res) => {
    if (!res.ok) throw new DataError(path, res.status)
    return (await res.json()) as T
  })
  req.catch(() => cache.delete(path))
  cache.set(path, req)
  return req
}

export type VenueBundle = {
  venue: Venue
  terrain: Terrain
  trees: Tree[]
  buildings: Building[]
}

export async function loadVenueBundle(id: VenueId): Promise<VenueBundle> {
  const [venue, terrain, trees, buildings] = await Promise.all([
    fetchJson<Venue>(`${id}/venue.json`),
    fetchJson<Terrain>(`${id}/terrain.json`),
    fetchJson<Tree[]>(`${id}/trees.json`),
    fetchJson<Building[]>(`${id}/buildings.json`),
  ])
  return grounded({ venue, terrain, trees, buildings })
}

function smoothed(t: Terrain): number[] {
  const { nx, nz, h } = t
  const at = (i: number, j: number) => h[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))]
  const med = new Array<number>(h.length)
  const win: number[] = []
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      win.length = 0
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) win.push(at(i + a, j + b))
      win.sort((p, q) => p - q)
      med[j * nx + i] = win[4]
    }
  }
  const out = new Array<number>(h.length)
  const W = [1, 2, 1]
  const m = (i: number, j: number) => med[Math.min(nz - 1, Math.max(0, j)) * nx + Math.min(nx - 1, Math.max(0, i))]
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      let sum = 0
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) sum += W[a + 1] * W[b + 1] * m(i + a, j + b)
      out[j * nx + i] = sum / 16
    }
  }
  return out
}

function grounded(raw: VenueBundle): VenueBundle {
  const bundle = { ...raw, terrain: { ...raw.terrain, h: smoothed(raw.terrain) } }
  let low = Infinity
  for (const v of bundle.terrain.h) if (v < low) low = v
  if (!Number.isFinite(low) || low === 0) return { ...bundle, trees: natural(bundle.trees) }
  return {
    ...bundle,
    terrain: { ...bundle.terrain, h: bundle.terrain.h.map((v) => v - low) },
    trees: natural(bundle.trees),
    buildings: bundle.buildings.map((b) => ({ ...b, base: b.base - low })),
  }
}

function natural(trees: Tree[]): Tree[] {
  const r = rng(29)
  return trees.map((t) => {
    if (t.source !== 'satellite') return t
    const k = 0.82 + r() * 0.36
    return {
      ...t,
      x: t.x + (r() - 0.5) * 4,
      z: t.z + (r() - 0.5) * 4,
      r: t.r * (0.66 + r() * 0.3),
      h: t.h * k,
      base: t.base * (0.85 + r() * 0.3),
    }
  })
}

export async function loadLayout(venue: Venue, file: string | null): Promise<Layout> {
  if (file) {
    try {
      return await fetchJson<Layout>(`${venue.id}/${file}`)
    } catch (err) {
      if (!(err instanceof DataError) || err.status !== 404) throw err
    }
  }
  return fetchJson<Layout>(`${venue.id}/${venue.defaultLayout}`)
}

export function loadEvents(): Promise<EventItem[]> {
  return fetchJson<EventItem[]>('events.json')
}

export function loadClosures(): Promise<Closure[]> {
  return fetchJson<Closure[]>('closures.json')
}

export function loadForecast(): Promise<Forecast> {
  return fetchJson<Forecast>('forecast.json')
}
