import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, InstancedMesh, Object3D } from 'three'
import { rng } from '../lib/rng'
import type { Route } from './Paths'
import { reducedMotion } from './sceneTime'
import { COOKIE, cookieParts, poseCookie } from './cookiePerson'

export const LIVELY_TONES = ['#e07b5f', '#5b8fb9', '#f0c75e', '#7fb685', '#9b7fc1', '#f2f2f2', '#3d4a5c', '#d9905a'] as const
const DOG_TONES = ['#c58c52', '#efe6d8', '#3b3430', '#a0784f'] as const


type Agent = {
  route: number
  s: number
  dir: number
  speed: number
  tone: number
  dog: number
  phase: number
}

function at(route: Route, s: number): { x: number; y: number; z: number; dx: number; dz: number } {
  const d = Math.min(route.len, Math.max(0, s))
  let lo = 0
  let hi = route.cum.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (route.cum[mid] <= d) lo = mid
    else hi = mid
  }
  const a = route.pts[lo]
  const b = route.pts[hi]
  const seg = route.cum[hi] - route.cum[lo] || 1
  const t = (d - route.cum[lo]) / seg
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, z: a[2] + (b[2] - a[2]) * t, dx: (b[0] - a[0]) / seg, dz: (b[2] - a[2]) / seg }
}

function makeAgents(routes: Route[], seed: number): Agent[] {
  const usable = routes.map((r, i) => ({ r, i })).filter(({ r }) => r.len >= 12)
  if (!usable.length) return []
  const total = usable.reduce((n, { r }) => n + r.len, 0)
  const count = Math.max(4, Math.min(16, Math.round(total / 30)))
  const rand = rng(seed)
  const agents: Agent[] = []
  for (let k = 0; k < count; k++) {
    let pick = rand() * total
    let chosen = usable[0]
    for (const u of usable) {
      pick -= u.r.len
      if (pick <= 0) {
        chosen = u
        break
      }
    }
    agents.push({
      route: chosen.i,
      s: rand() * chosen.r.len,
      dir: rand() < 0.5 ? 1 : -1,
      speed: 0.9 + rand() * 0.5,
      tone: Math.floor(rand() * LIVELY_TONES.length),
      dog: rand() < 0.3 ? Math.floor(rand() * DOG_TONES.length) : -1,
      phase: rand() * Math.PI * 2,
    })
  }
  return agents
}

export function Walkers({ routes, seed }: { routes: Route[]; seed: number }) {
  const bodies = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)
  const limbs = useRef<InstancedMesh>(null)
  const dogBodies = useRef<InstancedMesh>(null)
  const dogHeads = useRef<InstancedMesh>(null)
  const agents = useMemo(() => makeAgents(routes, seed), [routes, seed])
  const dogs = useMemo(() => agents.filter((a) => a.dog >= 0), [agents])
  const o = useMemo(() => new Object3D(), [])
  const parts = useMemo(() => cookieParts(), [])

  useLayoutEffect(() => {
    const c = new Color()
    agents.forEach((a, i) => {
      c.set(LIVELY_TONES[a.tone])
      bodies.current?.setColorAt(i, c)
      for (let k = 0; k < 4; k++) limbs.current?.setColorAt(i * 4 + k, c)
    })
    dogs.forEach((a, i) => {
      dogBodies.current?.setColorAt(i, c.set(DOG_TONES[a.dog]))
      dogHeads.current?.setColorAt(i, c.set(DOG_TONES[a.dog]))
    })
    for (const m of [bodies.current, limbs.current, dogBodies.current, dogHeads.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [agents, dogs])

  useFrame((_, dt) => {
    const step = reducedMotion ? 0 : Math.min(dt, 0.1)
    let d = 0
    agents.forEach((a, i) => {
      const r = routes[a.route]
      a.s += a.dir * a.speed * step
      if (a.s > r.len) {
        a.s = r.len
        a.dir = -1
      } else if (a.s < 0) {
        a.s = 0
        a.dir = 1
      }
      a.phase += a.speed * step * 6
      const p = at(r, a.s)
      const bob = reducedMotion ? 0 : Math.abs(Math.sin(a.phase)) * 0.05
      const fx = p.dx * a.dir
      const fz = p.dz * a.dir
      poseCookie(parts, p.x, p.y + bob, p.z, Math.atan2(fx, fz), false, reducedMotion ? 0 : Math.sin(a.phase) * 0.5)
      bodies.current?.setMatrixAt(i, parts.torso)
      heads.current?.setMatrixAt(i, parts.head)
      parts.limbs.forEach((l, k) => limbs.current?.setMatrixAt(i * 4 + k, l))
      if (a.dog >= 0) {
        const x = p.x + fx * 0.9 - fz * 0.5
        const z = p.z + fz * 0.9 + fx * 0.5
        const hop = reducedMotion ? 0 : Math.abs(Math.sin(a.phase * 1.6)) * 0.05
        o.rotation.set(0, Math.atan2(fx, fz) - Math.PI / 2, Math.PI / 2, 'YXZ')
        o.position.set(x, p.y + 0.28 + hop, z)
        o.updateMatrix()
        dogBodies.current?.setMatrixAt(d, o.matrix)
        o.rotation.set(0, 0, 0)
        o.position.set(x + fx * 0.32, p.y + 0.42 + hop, z + fz * 0.32)
        o.updateMatrix()
        dogHeads.current?.setMatrixAt(d, o.matrix)
        d++
      }
    })
    for (const m of [bodies.current, heads.current, limbs.current, dogBodies.current, dogHeads.current]) if (m) m.instanceMatrix.needsUpdate = true
  })

  if (!agents.length) return null
  return (
    <>
      <instancedMesh ref={bodies} args={[undefined, undefined, agents.length]} castShadow frustumCulled={false} raycast={() => null}>
        <capsuleGeometry args={[COOKIE.torsoR, COOKIE.torsoLen, 4, 10]} />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, agents.length]} castShadow frustumCulled={false} raycast={() => null}>
        <sphereGeometry args={[COOKIE.headR, 12, 8]} />
        <meshLambertMaterial color={COOKIE.skin} />
      </instancedMesh>
      <instancedMesh ref={limbs} args={[undefined, undefined, agents.length * 4]} castShadow frustumCulled={false} raycast={() => null}>
        <capsuleGeometry args={[COOKIE.limbR, COOKIE.limbLen, 4, 8]} />
        <meshLambertMaterial />
      </instancedMesh>
      {dogs.length > 0 && (
        <>
          <instancedMesh ref={dogBodies} args={[undefined, undefined, dogs.length]} castShadow frustumCulled={false} raycast={() => null}>
            <capsuleGeometry args={[0.13, 0.32, 4, 8]} />
            <meshLambertMaterial />
          </instancedMesh>
          <instancedMesh ref={dogHeads} args={[undefined, undefined, dogs.length]} castShadow frustumCulled={false} raycast={() => null}>
            <sphereGeometry args={[0.13, 10, 8]} />
            <meshLambertMaterial />
          </instancedMesh>
        </>
      )}
    </>
  )
}
