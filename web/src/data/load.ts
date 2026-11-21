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
  return { venue, terrain, trees, buildings }
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
