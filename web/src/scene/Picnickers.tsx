import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute, InstancedMesh } from 'three'
import type { Terrain, Venue } from '../data/types'
import { rng } from '../lib/rng'
import { offLimits } from '../lib/offLimits'
import { scanBounds } from '../lib/shadeGrid'
import { heightAt, sourceAt } from '../lib/terrainSample'
import { terraceHeight } from '../lib/terrace'
import type { Route } from './Paths'
import { PEOPLE_TONES } from './Walkers'
import { COOKIE, cookieParts, poseCookie } from './cookiePerson'
import { MAT_LIFT } from './MyMat'

const MAT_TONES = ['#f2c6b4', '#c9dfe9', '#f4e3a1', '#d8c8e8', '#cfe5c4', '#f6f1e7'] as const
const MAT = 1.5
const MAT_SEG = 6
const GAP = 7
const PATH_CLEAR = 1.6
const AVOID = 5
const TARGET = 10

type Group = {
  x: number
  z: number
  y: number
  yaw: number
  tone: number
  people: { x: number; z: number; y: number; yaw: number; tone: number }[]
}

function nearRoute(routes: Route[], x: number, z: number): boolean {
  for (const r of routes) {
    const reach = r.half + PATH_CLEAR
    for (const p of r.pts) if (Math.hypot(p[0] - x, p[2] - z) < reach) return true
  }
  return false
}

function makeGroups(terrain: Terrain, venue: Venue, routes: Route[], seed: number): Group[] {
  const area = scanBounds(terrain)
  const rand = rng(seed)
  const out: Group[] = []
  for (let tries = 0; tries < 600 && out.length < TARGET; tries++) {
    const x = area.x0 + rand() * (area.x1 - area.x0)
    const z = area.z0 + rand() * (area.z1 - area.z0)
    if (sourceAt(terrain, x, z) !== 0 || offLimits(venue, x, z)) continue
    if (terrain.terrace && terraceHeight(terrain.terrace, x, z) !== null) continue
    if (nearRoute(routes, x, z) || out.some((g) => Math.hypot(g.x - x, g.z - z) < GAP)) continue
    const yaw = rand() * Math.PI
    const y = heightAt(terrain, x, z)
    const n = 1 + Math.floor(rand() * 3)
    const people = Array.from({ length: n }, (_, k) => {
      const a = yaw + (k / n) * Math.PI * 2 + rand() * 0.6
      const px = x + Math.cos(a) * 0.4
      const pz = z + Math.sin(a) * 0.4
      return { x: px, z: pz, y: heightAt(terrain, px, pz), yaw: Math.atan2(x - px, z - pz), tone: Math.floor(rand() * PEOPLE_TONES.length) }
    })
    out.push({ x, z, y, yaw, tone: Math.floor(rand() * MAT_TONES.length), people })
  }
  return out
}

function matGeometry(terrain: Terrain, groups: Group[], hidden: boolean[]): BufferGeometry {
  const pos: number[] = []
  const col: number[] = []
  const index: number[] = []
  const c = new Color()
  const edge = new Color()
  groups.forEach((g, gi) => {
    if (hidden[gi]) return
    c.set(MAT_TONES[g.tone])
    edge.copy(c).multiplyScalar(0.8)
    const base = pos.length / 3
    const cos = Math.cos(g.yaw)
    const sin = Math.sin(g.yaw)
    for (let j = 0; j <= MAT_SEG; j++) {
      for (let i = 0; i <= MAT_SEG; i++) {
        const u = (i / MAT_SEG - 0.5) * MAT
        const v = (j / MAT_SEG - 0.5) * MAT
        const x = g.x + u * cos + v * sin
        const z = g.z - u * sin + v * cos
        pos.push(x, heightAt(terrain, x, z) + MAT_LIFT, z)
        const rim = i === 0 || j === 0 || i === MAT_SEG || j === MAT_SEG
        const k = rim ? edge : c
        col.push(k.r, k.g, k.b)
      }
    }
    const row = MAT_SEG + 1
    for (let j = 0; j < MAT_SEG; j++) {
      for (let i = 0; i < MAT_SEG; i++) {
        const a0 = base + j * row + i
        index.push(a0, a0 + row, a0 + 1, a0 + 1, a0 + row, a0 + row + 1)
      }
    }
  })
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('color', new Float32BufferAttribute(col, 3))
  geo.setIndex(index)
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

type Props = {
  terrain: Terrain
  venue: Venue
  routes: Route[]
  seed: number
  avoid: { x: number; z: number }[]
}

export function Picnickers({ terrain, venue, routes, seed, avoid }: Props) {
  const bodies = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)
  const limbs = useRef<InstancedMesh>(null)
  const groups = useMemo(() => makeGroups(terrain, venue, routes, seed), [terrain, venue, routes, seed])
  const people = useMemo(() => groups.flatMap((g, gi) => g.people.map((p) => ({ ...p, group: gi }))), [groups])
  const avoidKey = avoid.map((p) => `${p.x.toFixed(1)},${p.z.toFixed(1)}`).join('|')
  const hidden = useMemo(() => groups.map((g) => avoid.some((p) => Math.hypot(p.x - g.x, p.z - g.z) < AVOID)), [groups, avoidKey])
  const mats = useMemo(() => matGeometry(terrain, groups, hidden), [terrain, groups, hidden])
  useEffect(() => () => mats.dispose(), [mats])

  useLayoutEffect(() => {
    const c = new Color()
    people.forEach((p, i) => {
      c.set(PEOPLE_TONES[p.tone])
      bodies.current?.setColorAt(i, c)
      for (let k = 0; k < 4; k++) limbs.current?.setColorAt(i * 4 + k, c)
    })
    for (const m of [bodies.current, limbs.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [people])

  useLayoutEffect(() => {
    const parts = cookieParts()
    people.forEach((p, i) => {
      poseCookie(parts, p.x, hidden[p.group] ? -999 : p.y + MAT_LIFT, p.z, p.yaw, true, 0)
      bodies.current?.setMatrixAt(i, parts.torso)
      heads.current?.setMatrixAt(i, parts.head)
      parts.limbs.forEach((l, k) => limbs.current?.setMatrixAt(i * 4 + k, l))
    })
    for (const m of [bodies.current, heads.current, limbs.current]) {
      if (!m) continue
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
    }
  }, [people, hidden])

  if (!groups.length) return null
  return (
    <>
      <mesh geometry={mats} receiveShadow raycast={() => null}>
        <meshLambertMaterial vertexColors polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-2} />
      </mesh>
      <instancedMesh ref={bodies} args={[undefined, undefined, people.length]} castShadow raycast={() => null}>
        <capsuleGeometry args={[COOKIE.torsoR, COOKIE.torsoLen, 4, 10]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, people.length]} castShadow raycast={() => null}>
        <sphereGeometry args={[COOKIE.headR, 12, 8]} />
        <meshLambertMaterial color={COOKIE.skin} />
      </instancedMesh>
      <instancedMesh ref={limbs} args={[undefined, undefined, people.length * 4]} castShadow raycast={() => null}>
        <capsuleGeometry args={[COOKIE.limbR, COOKIE.limbLen, 4, 8]} />
        <meshLambertMaterial />
      </instancedMesh>
    </>
  )
}
