import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, InstancedMesh } from 'three'
import type { Terrain } from '../data/types'
import { countShown, isShown, type Crowd } from '../lib/crowd'
import { heightAt } from '../lib/terrainSample'
import { sceneStore, type MatPosition } from '../store/sceneStore'
import { COOKIE, cookieParts, poseCookie } from './cookiePerson'
import { PEOPLE_TONES } from './Walkers'

type Props = {
  crowd: Crowd
  terrain: Terrain
  myMat: MatPosition | null
  scale: number
  facing: { x: number; z: number } | null
  faded?: boolean
}

const HIDE_R = 2.2
const SHOWN = 0.55
const HIDDEN_Y = -999

export function CookieCrowd({ crowd, terrain, myMat, scale, facing, faded = false }: Props) {
  const torsos = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)
  const limbs = useRef<InstancedMesh>(null)
  const parts = useMemo(() => cookieParts(), [])
  const ground = useMemo(() => crowd.people.map((p) => heightAt(terrain, p.x, p.z)), [crowd, terrain])

  useLayoutEffect(() => {
    const c = new Color()
    crowd.people.forEach((p, i) => {
      c.set(PEOPLE_TONES[p.tone % PEOPLE_TONES.length])
      torsos.current?.setColorAt(i, c)
      for (let k = 0; k < 4; k++) limbs.current?.setColorAt(i * 4 + k, c)
    })
    for (const m of [torsos.current, limbs.current]) if (m?.instanceColor) m.instanceColor.needsUpdate = true
  }, [crowd])

  useLayoutEffect(() => {
    const hidden = new Set<number>()
    if (myMat) crowd.mats.forEach((m, i) => Math.hypot(m.x - myMat.x, m.z - myMat.z) < HIDE_R && hidden.add(i))

    crowd.people.forEach((p, i) => {
      const off = (p.mat >= 0 && hidden.has(p.mat)) || !isShown(p, scale * SHOWN)
      const yaw = facing ? Math.atan2(facing.x - p.x, facing.z - p.z) : 0
      poseCookie(parts, p.x, off ? HIDDEN_Y : ground[i], p.z, yaw, p.seated, 0)
      torsos.current?.setMatrixAt(i, parts.torso)
      heads.current?.setMatrixAt(i, parts.head)
      parts.limbs.forEach((l, k) => limbs.current?.setMatrixAt(i * 4 + k, l))
    })
    for (const m of [torsos.current, heads.current, limbs.current]) {
      if (!m) continue
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
    }
    sceneStore.set({ crowdCount: countShown(crowd, scale) })
  }, [crowd, ground, myMat, scale, facing, parts])

  const n = crowd.people.length
  if (n === 0) return null
  const opacity = faded ? 0.18 : 1
  return (
    <>
      <instancedMesh ref={torsos} args={[undefined, undefined, n]} castShadow raycast={() => null} userData={{ noAO: faded }}>
        <capsuleGeometry args={[COOKIE.torsoR, COOKIE.torsoLen, 4, 10]} />
        <meshLambertMaterial transparent={faded} opacity={opacity} depthWrite={!faded} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, n]} castShadow raycast={() => null} userData={{ noAO: faded }}>
        <sphereGeometry args={[COOKIE.headR, 12, 8]} />
        <meshLambertMaterial color={COOKIE.skin} transparent={faded} opacity={opacity} depthWrite={!faded} />
      </instancedMesh>
      <instancedMesh ref={limbs} args={[undefined, undefined, n * 4]} castShadow raycast={() => null} userData={{ noAO: faded }}>
        <capsuleGeometry args={[COOKIE.limbR, COOKIE.limbLen, 4, 8]} />
        <meshLambertMaterial transparent={faded} opacity={opacity} depthWrite={!faded} />
      </instancedMesh>
    </>
  )
}
