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

const zoneColor: Record<ZoneType, string> = {
  standing: sceneColors.standing,
  picnic: sceneColors.picnic,
  aisle: sceneColors.aisle,
  booth: sceneColors.booth,
  closed: sceneColors.closed,
}

const PATH_W = 3.5
const FADE = 28
const TILE = 22

function edgeDistance(t: TerrainData): Float32Array {
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

const SOIL = 3
const DROP = 120
const CUT = 0.9
const RINGS_BELOW = 14
const ROCK_SEGMENTS = 60

function islandGeometry(disc: Disc, terrain: TerrainData, venue: Venue, rim: Color[]) {
  const level = venue.water ? waterLevel(terrain, venue.water) : null
  const tops: number[] = []
  const wet: boolean[] = []
  for (let j = 0; j < SEGMENTS; j++) {
    const a = (j / SEGMENTS) * Math.PI * 2
    const x = disc.x + Math.cos(a) * disc.r
    const z = disc.z + Math.sin(a) * disc.r
    const inWater = level !== null && venue.water ? pointInPolygon(x, z, venue.water) : false
    const y = heightAt(terrain, x, z)
    tops.push(inWater && level !== null ? Math.max(y, level) : y)
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
  const c = new Color()
  const ring = (a: number) => [Math.cos(a), Math.sin(a)]
  const soilY = (a: number) => base + noise.noise3d(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0.3) * 0.6

  const band = { pos: [] as number[], col: [] as number[], index: [] as number[] }
  const ROWS = 4
  for (let j = 0; j <= SEGMENTS; j++) {
    const k = j % SEGMENTS
    const a = (k / SEGMENTS) * Math.PI * 2
    const [ca, sa] = ring(a)
    const lip = wet[k] ? 1.4 : LIP
    const put = (r: number, y: number, color: Color) => {
      band.pos.push(disc.x + ca * r, y, disc.z + sa * r)
      band.col.push(color.r, color.g, color.b)
    }
    put(disc.r, tops[k], wet[k] ? deep : rim[k])
    put(disc.r, tops[k] - lip, wet[k] ? deep : c.copy(rim[k]).multiplyScalar(0.82))
    put(disc.r, tops[k] - lip - 0.02, soilTop)
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
    const t = (i / RINGS_BELOW) * CUT
    for (let j = 0; j <= ROCK_SEGMENTS; j++) {
      const a = ((j % ROCK_SEGMENTS) / ROCK_SEGMENTS) * Math.PI * 2 + (i % 2) * (Math.PI / ROCK_SEGMENTS) * 0.6
      const [ca, sa] = ring(a)
      const n = noise.noise3d(ca * 1.4, sa * 1.4, t * 2.6) + 0.45 * noise.noise3d(ca * 3.2, sa * 3.2, t * 6)
      const r = disc.r * 0.97 * Math.pow(1 - t, 1.15) * (1 - 0.35 * t * t) * (1 + n * 0.2)
      const y = base - Math.pow(t, 1.25) * DROP + n * 4 * (1 - t)
      c.copy(rockTop).lerp(rockBottom, Math.pow(t, 0.8)).multiplyScalar(i % 2 ? 1 : 0.94)
      if (i === 1) c.lerp(soilBottom, 0.45)
      rock.pos.push(disc.x + ca * Math.max(0.5, r), y, disc.z + sa * Math.max(0.5, r))
      rock.col.push(c.r, c.g, c.b)
    }
  }
  const at = (i: number, j: number) => first + (i - 1) * (ROCK_SEGMENTS + 1) + j
  for (let b = 0; b < ROCK_SEGMENTS; b++) {
    for (let k = 0; k < step; k++) {
      const s0 = b * step + k
      rock.index.push(s0, s0 + 1, k < step / 2 ? at(1, b) : at(1, b + 1))
    }
    rock.index.push(b * step + step / 2, at(1, b + 1), at(1, b))
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
  rock.pos.push(disc.x, base - Math.pow(CUT, 1.25) * DROP - 1.2, disc.z)
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

export function Terrain({ terrain, venue, osm, layout, onPick }: Props) {
  const terrace = terrain.terrace ?? null
  const disc = useMemo(() => discOf(terrain), [terrain])

  const { geometry, rim } = useMemo(() => {
    const g = discGeometry(disc)
    const pos = g.attributes.position
    const colors: number[] = []
    const rim: Color[] = []
    const c = new Color()
    const stone = new Color(sceneColors.paving)
    const outer = new Color(sceneColors.outerGrass)
    const park = new Color(sceneColors.parkGrass)
    const path = new Color(sceneColors.path)
    const dist = edgeDistance(terrain)
    const firstRim = pos.count - SEGMENTS
    const lake = venue.water ?? null
    const level = lake ? waterLevel(terrain, lake) : null
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const tucked = terrace ? tuckedHeight(terrace, x, z) : null
      const y = tucked ?? heightAt(terrain, x, z)
      const sunk = lake && level !== null && pointInPolygon(x, z, lake) && underwater(terrain, lake, level, x, z, y)
      pos.setY(i, sunk && level !== null ? Math.min(y, level - 0.5) : y)
      const zone = layout ? zoneAt(layout.zones, x, z) : null
      const gi = Math.min(terrain.nx - 1, Math.max(0, Math.round((x - terrain.x0) / terrain.cell)))
      const gj = Math.min(terrain.nz - 1, Math.max(0, Math.round((z - terrain.z0) / terrain.cell)))
      const e = dist[gj * terrain.nx + gi] + Math.max(0, Math.abs(x - terrain.x0 - (gi * terrain.cell)) + Math.abs(z - terrain.z0 - (gj * terrain.cell)) - 1)
      if (zone) c.set(zoneColor[zone.type])
      else if (e === 0) c.set(sceneColors.lawn)
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
  }, [terrain, layout, terrace, venue, disc, osm])

  const skirt = useMemo(() => islandGeometry(disc, terrain, venue, rim), [disc, terrain, venue, rim])

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

  return (
    <>
      <mesh name="terrain" geometry={geometry} receiveShadow onClick={handleClick}>
        <meshLambertMaterial vertexColors map={texture} />
      </mesh>
      <mesh geometry={skirt.band} raycast={() => null}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh geometry={skirt.rock} raycast={() => null} userData={{ noAO: true }}>
        <meshLambertMaterial vertexColors flatShading side={DoubleSide} />
      </mesh>
      {terrace && <TerraceSteps terrace={terrace} />}
    </>
  )
}
