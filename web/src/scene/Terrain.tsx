import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { Layout, Terrain as TerrainData, Venue, ZoneType } from '../data/types'
import { pavedWeight, tuckedHeight } from '../lib/terrace'
import { TerraceSteps } from './TerraceSteps'
import { waterLevel } from './Water'
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
  layout: Layout | null
  onPick?: (x: number, z: number) => void
}

const RINGS = 100
const SEGMENTS = 360
const LIP = 0.35
const DEPTH = 8

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

function skirtGeometry(disc: Disc, terrain: TerrainData, venue: Venue, rim: Color[]) {
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
  const bottom = Math.min(...tops) - DEPTH
  const soilTop = new Color(sceneColors.soilTop)
  const soilBottom = new Color(sceneColors.soilBottom)
  const deep = new Color(sceneColors.waterDeep)
  const pos: number[] = []
  const col: number[] = []
  const index: number[] = []
  const c = new Color()
  for (let j = 0; j <= SEGMENTS; j++) {
    const k = j % SEGMENTS
    const a = (k / SEGMENTS) * Math.PI * 2
    const x = disc.x + Math.cos(a) * disc.r
    const z = disc.z + Math.sin(a) * disc.r
    const top = tops[k]
    const lip = wet[k] ? 1.4 : LIP
    const rows: [number, Color][] = [
      [top, wet[k] ? deep : rim[k]],
      [top - lip, wet[k] ? deep : rim[k].clone().multiplyScalar(0.82)],
      [top - lip - 0.02, soilTop],
      [bottom, soilBottom],
    ]
    for (const [y, color] of rows) {
      pos.push(x, y, z)
      c.copy(color)
      col.push(c.r, c.g, c.b)
    }
  }
  for (let j = 0; j < SEGMENTS; j++) {
    for (let r = 0; r < 3; r++) {
      const a = j * 4 + r
      const b = (j + 1) * 4 + r
      index.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

export function Terrain({ terrain, venue, layout, onPick }: Props) {
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
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const tucked = terrace ? tuckedHeight(terrace, x, z) : null
      pos.setY(i, tucked ?? heightAt(terrain, x, z))
      const zone = layout ? zoneAt(layout.zones, x, z) : null
      const gi = Math.min(terrain.nx - 1, Math.max(0, Math.round((x - terrain.x0) / terrain.cell)))
      const gj = Math.min(terrain.nz - 1, Math.max(0, Math.round((z - terrain.z0) / terrain.cell)))
      const e = dist[gj * terrain.nx + gi] + Math.max(0, Math.abs(x - terrain.x0 - (gi * terrain.cell)) + Math.abs(z - terrain.z0 - (gj * terrain.cell)) - 1)
      if (zone) c.set(zoneColor[zone.type])
      else if (e === 0) c.set(sceneColors.lawn)
      else if (e <= PATH_W) c.copy(path)
      else c.copy(park).lerp(outer, Math.min(1, (e - PATH_W) / FADE))
      const pw = terrace ? pavedWeight(terrace, venue, pos.getY(i), x, z) : 0
      if (pw > 0) c.lerp(stone, zone ? pw * 0.55 : pw)
      colors.push(c.r, c.g, c.b)
      if (i >= firstRim) rim.push(c.clone())
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return { geometry: g, rim }
  }, [terrain, layout, terrace, venue, disc])

  const skirt = useMemo(() => skirtGeometry(disc, terrain, venue, rim), [disc, terrain, venue, rim])

  const texture = useMemo(() => grassTexture(1, 1), [])

  useEffect(
    () => () => {
      geometry.dispose()
      skirt.dispose()
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
      <mesh geometry={skirt} receiveShadow raycast={() => null}>
        <meshLambertMaterial vertexColors />
      </mesh>
      {terrace && <TerraceSteps terrace={terrace} />}
    </>
  )
}
