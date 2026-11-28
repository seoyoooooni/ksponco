import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute } from 'three'
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js'
import type { ThreeEvent } from '@react-three/fiber'
import type { Layout, OsmFeatures, Terrain as TerrainData, Venue, ZoneType } from '../data/types'
import { pavedWeight, tuckedHeight } from '../lib/terrace'
import { TerraceSteps } from './TerraceSteps'
import { underwater, waterLevel } from '../lib/water'
import { pointInPolygon, zoneAt } from '../lib/polygon'
import { discOf, type Disc } from '../lib/diorama'
import { heightAt } from '../lib/terrainSample'
import { sceneColors } from './colors'
import { grassTexture } from './grassTexture'
import { seasonColors } from '../lib/season'
import { useScene } from '../store/sceneStore'

const zoneColor: Record<ZoneType, string> = {
  standing: sceneColors.standing,
  picnic: sceneColors.picnic,
  aisle: sceneColors.aisle,
  booth: sceneColors.booth,
  closed: sceneColors.closed,
}

export const PATH_W = 3.5
const FADE = 28
const TILE = 22

export function edgeDistance(t: TerrainData): Float32Array {
  const { nx, nz } = t
  const d = new Float32Array(nx * nz)
  for (let k = 0; k < d.length; k++) d[k] = t.src[k] === 0 ? 0 : 1e9
  const D = Math.SQRT2
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      if (i > 0) d[k] = Math.min(d[k], d[k - 1] + 1)
      if (j > 0) {
        d[k] = Math.min(d[k], d[k - nx] + 1)
        if (i > 0) d[k] = Math.min(d[k], d[k - nx - 1] + D)
        if (i < nx - 1) d[k] = Math.min(d[k], d[k - nx + 1] + D)
      }
    }
  }
  for (let j = nz - 1; j >= 0; j--) {
    for (let i = nx - 1; i >= 0; i--) {
      const k = j * nx + i
      if (i < nx - 1) d[k] = Math.min(d[k], d[k + 1] + 1)
      if (j < nz - 1) {
        d[k] = Math.min(d[k], d[k + nx] + 1)
        if (i < nx - 1) d[k] = Math.min(d[k], d[k + nx + 1] + D)
        if (i > 0) d[k] = Math.min(d[k], d[k + nx - 1] + D)
      }
    }
  }
  for (let k = 0; k < d.length; k++) d[k] *= t.cell
  return d
}

type Props = {
  terrain: TerrainData
  venue: Venue
  osm: OsmFeatures | null
  layout: Layout | null
  onPick?: (x: number, z: number) => void
  onHover?: (x: number, z: number) => void
}

const RINGS = 100
const SEGMENTS = 360
const LIP = 0.35

function discGeometry(disc: Disc) {
  const pos: number[] = [disc.x, 0, disc.z]
  const uv: number[] = [disc.x / TILE, disc.z / TILE]
  const index: number[] = []
  for (let i = 1; i <= RINGS; i++) {
    const r = (disc.r * i) / RINGS
    for (let j = 0; j < SEGMENTS; j++) {
      const a = (j / SEGMENTS) * Math.PI * 2
      const x = disc.x + Math.cos(a) * r
      const z = disc.z + Math.sin(a) * r
      pos.push(x, 0, z)
      uv.push(x / TILE, z / TILE)
    }
  }
  const at = (i: number, j: number) => (i === 0 ? 0 : 1 + (i - 1) * SEGMENTS + (j % SEGMENTS))
  for (let j = 0; j < SEGMENTS; j++) index.push(0, at(1, j + 1), at(1, j))
  for (let i = 1; i < RINGS; i++) {
    for (let j = 0; j < SEGMENTS; j++) {
      const a = at(i, j)
      const b = at(i, j + 1)
      const c = at(i + 1, j)
      const d = at(i + 1, j + 1)
      index.push(a, b, c, b, d, c)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(index)
  return g
}

const SOIL = 8
const DROP = 140
const CLIFF = 0.22
const RINGS_BELOW = 18
const ROCK_SEGMENTS = SEGMENTS

const RIM_PULL = 0.7

function inward(disc: Disc, x: number, z: number): [number, number] {
  const r = Math.hypot(x - disc.x, z - disc.z)
  const k = r > disc.r - RIM_PULL ? (disc.r - RIM_PULL) / r : 1
  return [disc.x + (x - disc.x) * k, disc.z + (z - disc.z) * k]
}

function islandGeometry(disc: Disc, terrain: TerrainData, venue: Venue, rim: Color[], drapeHex: string) {
  const level = venue.water ? waterLevel(terrain, venue.water) : null
  const tops: number[] = []
  const wet: boolean[] = []
  for (let j = 0; j < SEGMENTS; j++) {
    const a = (j / SEGMENTS) * Math.PI * 2
    const x = disc.x + Math.cos(a) * disc.r
    const z = disc.z + Math.sin(a) * disc.r
    const [px, pz] = inward(disc, x, z)
    const inWater = level !== null && venue.water ? pointInPolygon(px, pz, venue.water) : false
    const y = heightAt(terrain, x, z)
    tops.push(inWater && level !== null ? level : y)
    wet.push(inWater)
  }
  const base = Math.min(...tops) - LIP - SOIL
  let seed = 88
  const noise = new SimplexNoise({
    random: () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 4294967296
    },
  })
  const soilTop = new Color(sceneColors.soilTop)
  const soilBottom = new Color(sceneColors.soilBottom)
  const rockTop = new Color(sceneColors.rockTop)
  const rockBottom = new Color(sceneColors.rockBottom)
  const deep = new Color(sceneColors.waterDeep)
  const surface = new Color(sceneColors.water)
  const bedDeep = new Color(sceneColors.lakeBed)
  const c = new Color()
  const ring = (a: number) => [Math.cos(a), Math.sin(a)]
  const soilY = (a: number) => base + noise.noise3d(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0.3) * 0.6

  const band = { pos: [] as number[], col: [] as number[], index: [] as number[] }
  const ROWS = 6
  const drapeGrass = new Color(drapeHex)
  for (let j = 0; j <= SEGMENTS; j++) {
    const k = j % SEGMENTS
    const a = (k / SEGMENTS) * Math.PI * 2
    const [ca, sa] = ring(a)
    const put = (r: number, y: number, color: Color) => {
      band.pos.push(disc.x + ca * r, y, disc.z + sa * r)
      band.col.push(color.r, color.g, color.b)
    }
    const top = tops[k]
    if (wet[k]) {
      put(disc.r, top, surface)
      put(disc.r, top - 0.8, deep)
      put(disc.r, top - 3.5, c.copy(deep).lerp(bedDeep, 0.5))
      put(disc.r, top - 6.5, bedDeep)
      put(disc.r * 0.995, top - 6.6, soilTop)
    } else {
      const scallop = noise.noise3d(ca * 9, sa * 9, 1.7) * 0.5 + noise.noise3d(ca * 23, sa * 23, 4.1) * 0.5
      const drape = 1.5 + (scallop + 1) * 1.05
      put(disc.r, top, rim[k])
      put(disc.r + 0.55, top - 0.3, c.copy(rim[k]).multiplyScalar(0.94))
      put(disc.r + 0.45, top - drape * 0.55, c.copy(rim[k]).lerp(drapeGrass, 0.6))
      put(disc.r + 0.15, top - drape, c.copy(drapeGrass).multiplyScalar(0.82))
      put(disc.r, top - drape - 0.05, soilTop)
    }
    put(disc.r * 0.985, soilY(a), soilBottom)
  }
  for (let j = 0; j < SEGMENTS; j++) {
    for (let r = 0; r < ROWS - 1; r++) {
      const p = j * ROWS + r
      const q = (j + 1) * ROWS + r
      band.index.push(p, q, p + 1, q, q + 1, p + 1)
    }
  }

  const rock = { pos: [] as number[], col: [] as number[], index: [] as number[] }
  const step = SEGMENTS / ROCK_SEGMENTS
  for (let j = 0; j <= SEGMENTS; j++) {
    const a = ((j % SEGMENTS) / SEGMENTS) * Math.PI * 2
    const [ca, sa] = ring(a)
    rock.pos.push(disc.x + ca * disc.r * 0.985, soilY(a), disc.z + sa * disc.r * 0.985)
    rock.col.push(soilBottom.r, soilBottom.g, soilBottom.b)
  }
  const first = rock.pos.length / 3
  for (let i = 1; i <= RINGS_BELOW; i++) {
    const u = i / RINGS_BELOW
    const cliff = u < CLIFF
    for (let j = 0; j <= ROCK_SEGMENTS; j++) {
      const a = ((j % ROCK_SEGMENTS) / ROCK_SEGMENTS) * Math.PI * 2 + (i % 2) * (Math.PI / ROCK_SEGMENTS) * 0.6
      const [ca, sa] = ring(a)
      const n = noise.noise3d(ca * 1.4, sa * 1.4, u * 2.6) + 0.45 * noise.noise3d(ca * 3.6, sa * 3.6, u * 7)
      const f = cliff ? 0.985 - 0.07 * (u / CLIFF) : 0.915 * Math.pow(1 - (u - CLIFF) / (1 - CLIFF), 1.35)
      const r = disc.r * f * (1 + n * (cliff ? 0.045 : 0.16))
      const y = base - Math.pow(u, 1.15) * DROP + n * 3 * (1 - u)
      const stripe = Math.floor((base - y) / 7) % 2 === 0 ? 1 : 0.9
      c.copy(rockTop).lerp(rockBottom, Math.pow(u, 0.8)).multiplyScalar(stripe * (0.94 + n * 0.06))
      if (i === 1) c.lerp(soilBottom, 0.45)
      rock.pos.push(disc.x + ca * Math.max(0.5, r), y, disc.z + sa * Math.max(0.5, r))
      rock.col.push(c.r, c.g, c.b)
    }
  }
  const at = (i: number, j: number) => first + (i - 1) * (ROCK_SEGMENTS + 1) + j
  for (let b = 0; b < ROCK_SEGMENTS; b++) {
    const s0 = b * step
    rock.index.push(s0, s0 + 1, at(1, b), s0 + 1, at(1, b + 1), at(1, b))
  }
  for (let i = 1; i < RINGS_BELOW; i++) {
    for (let j = 0; j < ROCK_SEGMENTS; j++) {
      const p = at(i, j)
      const q = at(i, j + 1)
      const u = at(i + 1, j)
      const v = at(i + 1, j + 1)
      rock.index.push(p, q, u, q, v, u)
    }
  }
  const tip = rock.pos.length / 3
  rock.pos.push(disc.x, base - DROP - 1.5, disc.z)
  c.copy(rockBottom).multiplyScalar(0.85)
  rock.col.push(c.r, c.g, c.b)
  for (let j = 0; j < ROCK_SEGMENTS; j++) rock.index.push(at(RINGS_BELOW, j), at(RINGS_BELOW, j + 1), tip)

  const make = (m: { pos: number[]; col: number[]; index: number[] }) => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(m.pos, 3))
    g.setAttribute('color', new Float32BufferAttribute(m.col, 3))
    g.setIndex(m.index)
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }
  return { band: make(band), rock: make(rock) }
}

export function Terrain({ terrain, venue, osm, layout, onPick, onHover }: Props) {
  const terrace = terrain.terrace ?? null
  const disc = useMemo(() => discOf(terrain), [terrain])
  const date = useScene((s) => s.date)
  const seasonKey = JSON.stringify(seasonColors(venue.id, date))
  const season = useMemo(() => JSON.parse(seasonKey) as ReturnType<typeof seasonColors>, [seasonKey])

  const { geometry, rim } = useMemo(() => {
    const g = discGeometry(disc)
    const pos = g.attributes.position
    const colors: number[] = []
    const rim: Color[] = []
    const c = new Color()
    const stone = new Color(sceneColors.paving)
    const outer = new Color(season.outer)
    const park = new Color(season.park)
    const path = new Color(sceneColors.path)
    const bed = new Color(sceneColors.waterDeep)
    const bedDeep = new Color(sceneColors.lakeBed)
    const dist = edgeDistance(terrain)
    const firstRim = pos.count - SEGMENTS
    const lake = venue.water ?? null
    const level = lake ? waterLevel(terrain, lake) : null
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const tucked = terrace ? tuckedHeight(terrace, x, z) : null
      const y = tucked ?? heightAt(terrain, x, z)
      const [px, pz] = inward(disc, x, z)
      const sunk = lake && level !== null && pointInPolygon(px, pz, lake) && underwater(terrain, lake, level, px, pz, y)
      pos.setY(i, sunk && level !== null ? Math.min(y, level - 0.5) : y)
      const zone = layout ? zoneAt(layout.zones, x, z) : null
      const gi = Math.min(terrain.nx - 1, Math.max(0, Math.round((x - terrain.x0) / terrain.cell)))
      const gj = Math.min(terrain.nz - 1, Math.max(0, Math.round((z - terrain.z0) / terrain.cell)))
      const e = dist[gj * terrain.nx + gi] + Math.max(0, Math.abs(x - terrain.x0 - (gi * terrain.cell)) + Math.abs(z - terrain.z0 - (gj * terrain.cell)) - 1)
      if (sunk && level !== null) c.copy(bed).lerp(bedDeep, Math.min(1, Math.max(0, level - y) / 4))
      else if (zone) c.set(zone.type === 'picnic' ? season.picnic : zoneColor[zone.type])
      else if (e === 0) c.set(season.lawn)
      else if (e <= PATH_W) c.copy(path)
      else c.copy(park).lerp(outer, Math.min(1, (e - PATH_W) / FADE))
      const pw = terrace ? pavedWeight(terrace, venue, pos.getY(i), x, z) : 0
      const plaza = osm?.areas.some((a) => pointInPolygon(x, z, a.poly)) ? 1 : 0
      const paved = Math.max(pw, plaza)
      if (paved > 0) c.lerp(stone, zone ? paved * 0.55 : paved)
      colors.push(c.r, c.g, c.b)
      if (i >= firstRim) rim.push(c.clone())
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return { geometry: g, rim }
  }, [terrain, layout, terrace, venue, disc, osm, season])

  const skirt = useMemo(() => islandGeometry(disc, terrain, venue, rim, season.drape), [disc, terrain, venue, rim, season.drape])

  const texture = useMemo(() => grassTexture(1, 1), [])

  useEffect(
    () => () => {
      geometry.dispose()
      skirt.band.dispose()
      skirt.rock.dispose()
    },
    [geometry, skirt],
  )
  useEffect(() => () => texture.dispose(), [texture])

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!onPick || e.delta > 6) return
    e.stopPropagation()
    onPick(e.point.x, e.point.z)
  }

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    if (onHover) onHover(e.point.x, e.point.z)
  }

  return (
    <>
      <mesh name="terrain" geometry={geometry} receiveShadow onClick={handleClick} onPointerMove={onHover ? handleMove : undefined}>
        <meshLambertMaterial vertexColors map={texture} />
      </mesh>
      <mesh geometry={skirt.band} raycast={() => null}>
        <meshLambertMaterial vertexColors side={DoubleSide} />
      </mesh>
      <mesh geometry={skirt.rock} raycast={() => null} userData={{ noAO: true }}>
        <meshLambertMaterial vertexColors flatShading side={DoubleSide} />
      </mesh>
      {terrace && <TerraceSteps terrace={terrace} />}
    </>
  )
}
