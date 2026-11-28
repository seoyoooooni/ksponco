import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute, InstancedMesh, MeshLambertMaterial, Object3D, Vector3 } from 'three'
import type { Building, Layout, OsmFeatures, Terrain, Venue } from '../data/types'
import { rng } from '../lib/rng'
import { discOf } from '../lib/diorama'
import { heightAt } from '../lib/terrainSample'
import { terraceHeight } from '../lib/terrace'
import { onStage, offLimits } from '../lib/offLimits'
import { pointInPolygon, zoneAt } from '../lib/polygon'
import { seasonColors } from '../lib/season'
import { useScene } from '../store/sceneStore'
import { makeGroups } from './Picnickers'
import type { Route } from './Paths'
import { edgeDistance, PATH_W } from './Terrain'
import { sceneTime } from './sceneTime'

const SPACING = 6
const KEEP_LAWN = 0.3
const KEEP_PARK = 0.4
const CLUSTER = 1.8
const MIX = 0.6
const SATURATE = 2.4

function vivid(c: Color): Color {
  const hsl = { h: 0, s: 0, l: 0 }
  c.getHSL(hsl)
  return c.setHSL(hsl.h, Math.min(1, hsl.s * SATURATE), hsl.l)
}
const PATH_CLEAR = 0.6
const MAT_CLEAR = 2
const AVOID = 12

const BLADES = 11
const SEGS = 4

function tuftGeometry(): BufferGeometry {
  const rand = rng(11)
  const pos: number[] = []
  const col: number[] = []
  const nor: number[] = []
  const index: number[] = []
  for (let b = 0; b < BLADES; b++) {
    const t = b / (BLADES - 1) - 0.5
    const around = (b % 3) * (Math.PI / 3) + (rand() - 0.5) * 0.4
    const fan = t * 1.2 + (rand() - 0.5) * 0.3
    const h = 0.85 + rand() * 0.25 - Math.abs(t) * 0.3
    const w = 0.11 + rand() * 0.04
    const bend = 0.25 + rand() * 0.25
    const ox = t * 0.3
    const shade = b % 2 === 0 ? 1.22 : 0.72
    const ca = Math.cos(around)
    const sa = Math.sin(around)
    const base = pos.length / 3
    for (let k = 0; k <= SEGS; k++) {
      const u = k / SEGS
      const lean = Math.sin(fan) * (u * 0.2 + u * u * bend * 0.9)
      const y = h * (u - u * u * bend * 0.35)
      const half = w * (1 - u) * (k === SEGS ? 0 : 1)
      for (const side of [-1, 1]) {
        const lx = ox + lean + side * half
        pos.push(lx * ca, y, lx * sa)
        nor.push(0, 1, 0)
        const k2 = shade * (0.88 + 0.12 * u)
        col.push(k2, k2, k2)
      }
    }
    for (let k = 0; k < SEGS; k++) {
      const a = base + k * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2, a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  g.setIndex(index)
  g.computeBoundingSphere()
  return g
}

type Spot = { x: number; z: number; y: number; s: number; h: number; yaw: number; tone: number; lawn: boolean }

type Props = {
  terrain: Terrain
  venue: Venue
  osm: OsmFeatures | null
  layout: Layout | null
  buildings: Building[]
  routes: Route[]
  picnicSeed: number | null
  avoid: { x: number; z: number }[]
  flat: boolean
}

const MASK = 0.5

function routeMask(routes: Route[], x0: number, z0: number, size: number): (x: number, z: number) => boolean {
  const n = Math.ceil(size / MASK)
  const mask = new Uint8Array(n * n)
  for (const r of routes) {
    const reach = r.half + PATH_CLEAR
    const k = Math.ceil(reach / MASK)
    for (const p of r.pts) {
      const ci = Math.round((p[0] - x0) / MASK)
      const cj = Math.round((p[2] - z0) / MASK)
      for (let dj = -k; dj <= k; dj++) {
        for (let di = -k; di <= k; di++) {
          const i = ci + di
          const j = cj + dj
          if (i < 0 || j < 0 || i >= n || j >= n) continue
          if (Math.hypot(di * MASK, dj * MASK) <= reach) mask[j * n + i] = 1
        }
      }
    }
  }
  return (x, z) => {
    const i = Math.round((x - x0) / MASK)
    const j = Math.round((z - z0) / MASK)
    return i >= 0 && j >= 0 && i < n && j < n && mask[j * n + i] === 1
  }
}

function spots(terrain: Terrain, venue: Venue, osm: OsmFeatures | null, layout: Layout | null, buildings: Building[], routes: Route[], picnicSeed: number | null): Spot[] {
  const disc = discOf(terrain)
  const dist = edgeDistance(terrain)
  const rand = rng(20261128)
  const mats = picnicSeed === null ? [] : makeGroups(terrain, venue, routes, picnicSeed)
  const onRoute = routeMask(routes, disc.x - disc.r, disc.z - disc.r, disc.r * 2)
  const edgeAt = (x: number, z: number): number | null => {
    if (Math.hypot(x - disc.x, z - disc.z) > disc.r - 1.2) return null
    const gi = Math.min(terrain.nx - 1, Math.max(0, Math.round((x - terrain.x0) / terrain.cell)))
    const gj = Math.min(terrain.nz - 1, Math.max(0, Math.round((z - terrain.z0) / terrain.cell)))
    const e = dist[gj * terrain.nx + gi]
    if (e > 0 && e <= PATH_W + 0.5) return null
    if (onRoute(x, z)) return null
    if (offLimits(venue, x, z)) return null
    if (venue.water && pointInPolygon(x, z, venue.water)) return null
    if (terrain.terrace && terraceHeight(terrain.terrace, x, z) !== null) return null
    if (layout && zoneAt(layout.zones, x, z)) return null
    if (layout?.stage && onStage(layout.stage, x, z, 1.5)) return null
    if (osm?.areas.some((a) => pointInPolygon(x, z, a.poly))) return null
    if (buildings.some((b) => pointInPolygon(x, z, b.footprint))) return null
    if (mats.some((m) => Math.hypot(m.x - x, m.z - z) < MAT_CLEAR)) return null
    return e
  }
  const out: Spot[] = []
  const n = Math.ceil((disc.r * 2) / SPACING)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const cx = disc.x - disc.r + (i + rand()) * SPACING
      const cz = disc.z - disc.r + (j + rand()) * SPACING
      const keep = rand()
      const count = 3 + Math.floor(rand() * 3)
      const ce = edgeAt(cx, cz)
      if (ce === null || keep > (ce === 0 ? KEEP_LAWN : KEEP_PARK)) continue
      for (let k = 0; k < count; k++) {
        const a = rand() * Math.PI * 2
        const d = Math.sqrt(rand()) * CLUSTER
        const size = rand()
        const tall = rand()
        const yaw = rand()
        const tone = rand()
        const x = cx + Math.cos(a) * d
        const z = cz + Math.sin(a) * d
        const e = edgeAt(x, z)
        if (e === null) continue
        const big = 1 - (d / CLUSTER) * 0.5
        out.push({
          x,
          z,
          y: heightAt(terrain, x, z),
          s: (1.3 + size * 0.55) * big,
          h: (2 + tall * 1) * big,
          yaw: yaw * Math.PI * 2,
          tone: 0.94 + tone * 0.12,
          lawn: e === 0,
        })
      }
    }
  }
  return out
}

function grassMaterial(uniforms: Record<string, { value: unknown }>): MeshLambertMaterial {
  const m = new MeshLambertMaterial({ color: '#ffffff', vertexColors: true })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, { uTime: sceneTime })
    shader.vertexShader =
      `uniform float uTime;\nuniform float uFlat;\nuniform vec3 uAvoid[${AVOID}];\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec2 grassAt = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
  float grassHide = 1.0;
  for (int i = 0; i < ${AVOID}; i++) {
    if (uAvoid[i].z > 0.0 && distance(grassAt, uAvoid[i].xy) < uAvoid[i].z) grassHide = 0.0;
  }
  transformed *= grassHide;
  transformed.y *= uFlat;
  float grassPhase = grassAt.x * 0.21 + grassAt.y * 0.27;
  float grassK = clamp(position.y, 0.0, 1.5);
  transformed.x += sin(uTime * 1.6 + grassPhase) * 0.06 * grassK * grassK;
  transformed.z += cos(uTime * 1.3 + grassPhase * 1.3) * 0.045 * grassK * grassK;
#endif`,
      )
  }
  m.customProgramCacheKey = () => 'grass-tuft'
  return m
}

export function Grass({ terrain, venue, osm, layout, buildings, routes, picnicSeed, avoid, flat }: Props) {
  const ref = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => tuftGeometry(), [])
  const uniforms = useMemo(() => ({ uFlat: { value: 1 }, uAvoid: { value: Array.from({ length: AVOID }, () => new Vector3()) } }), [])
  const material = useMemo(() => grassMaterial(uniforms), [uniforms])
  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  const list = useMemo(() => spots(terrain, venue, osm, layout, buildings, routes, picnicSeed), [terrain, venue, osm, layout, buildings, routes, picnicSeed])

  const date = useScene((s) => s.date)
  const season = seasonColors(venue.id, date)
  const colorKey = `${season.lawn}|${season.park}|${season.trees[2]}`

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new Object3D()
    list.forEach((p, i) => {
      o.position.set(p.x, p.y, p.z)
      o.rotation.set(0, p.yaw, 0)
      o.scale.set(p.s, p.h, p.s)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [list])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const [lawnHex, parkHex, leafHex] = colorKey.split('|')
    const leaf = new Color(leafHex)
    const lawn = vivid(new Color(lawnHex).lerp(leaf, MIX))
    const park = vivid(new Color(parkHex).lerp(leaf, MIX))
    const c = new Color()
    list.forEach((p, i) => mesh.setColorAt(i, c.copy(p.lawn ? lawn : park).multiplyScalar(p.tone)))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [list, colorKey])

  const avoidKey = avoid.map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`).join('|')
  useEffect(() => {
    const slots = uniforms.uAvoid.value
    slots.forEach((v, i) => {
      const p = avoid[i]
      v.set(p?.x ?? 0, p?.z ?? 0, p ? MAT_CLEAR + 0.4 : 0)
    })
  }, [avoidKey, uniforms])

  useEffect(() => {
    uniforms.uFlat.value = flat ? 0.3 : 1
  }, [flat, uniforms])

  if (list.length === 0) return null
  return (
    <instancedMesh key={list.length} ref={ref} args={[geometry, material, list.length]} receiveShadow raycast={() => null} userData={{ noAO: true }} />
  )
}
