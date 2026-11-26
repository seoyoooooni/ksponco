export type VenueId = 'lawn88' | 'lake'

export type Vec2 = [number, number]

export type StageSpec = {
  shape?: 'rect' | 'circle'
  x: number
  z: number
  w: number
  d: number
  r?: number
  deckH: number
  roofH: number | null
  azimuth: number
}

export type Venue = {
  id: VenueId
  name: string
  origin5186: Vec2
  originNote: string
  stage: 'temporary' | 'fixed'
  fixedStage: StageSpec | null
  seating: string
  defaultLayout: string
  water?: Vec2[]
}

export type Performer = {
  x: number
  z: number
  h: number
}

export type ScreenSpec = {
  x: number
  z: number
  w: number
  h: number
  bottom: number
  azimuth: number
}

export type ZoneType = 'standing' | 'picnic' | 'aisle' | 'booth' | 'closed'

export type Zone = {
  type: ZoneType
  poly: Vec2[]
  density?: number
}

export type MatSpec = {
  w: number
  d: number
  people: number
}

export type LayoutSource = 'official_map' | 'default' | 'operator'

export type Layout = {
  id: string
  venue: VenueId
  source: LayoutSource
  sourceNote?: string
  stage?: StageSpec
  performer?: Performer
  screens: ScreenSpec[]
  zones: Zone[]
  mat: MatSpec
}

export type GridMeta = {
  x0: number
  z0: number
  cell: number
  nx: number
  nz: number
}

export type TerrainSource = 0 | 1 | 2

export type Terrace = {
  x: number
  z: number
  mid: number
  half: number
  rIn: number
  depth: number
  n: number
  rise: number
  walk: number
  floor: number
  top: number
}

export type Terrain = GridMeta & {
  h: number[]
  src: TerrainSource[]
  terrace?: Terrace | null
  water?: Vec2[] | null
}

export type TreeSource = 'scan' | 'satellite'

export type Tree = {
  x: number
  z: number
  h: number
  base: number
  r: number
  source: TreeSource
}

export type BuildingSource = 'scan' | 'model' | 'gis'

export type Building = {
  name: string
  base: number
  height: number
  footprint: Vec2[]
  source: BuildingSource
}

export type ValueSource = 'api' | 'manual' | 'linked' | 'default'

export type EventItem = {
  id: string
  name: string
  venue: VenueId
  date: string
  start: string
  end: string
  timeSource: ValueSource
  people: number | null
  peopleSource: ValueSource
  layout: string | null
  sourceUrl: string
  tempMax: number | null
}

export type Closure = {
  venue: VenueId
  from: string
  to: string
  reason: string
  source: string
}

export type Sky = string

export type ForecastDay = {
  date: string
  sky: Sky
  rain: boolean
  rainPrevDay: number
  tempMax: number
}

export type Forecast = {
  updated: string
  days: ForecastDay[]
}

export type OsmPath = {
  kind: string
  width: number
  surface: string
  pts: Vec2[]
}

export type OsmFeatures = {
  source: string
  paths: OsmPath[]
  areas: { kind: string; poly: Vec2[] }[]
  water: { name: string; poly: Vec2[] }[]
  points: { kind: string; x: number; z: number }[]
}
