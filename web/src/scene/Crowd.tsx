import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, InstancedMesh, Object3D } from 'three'
import type { Terrain } from '../data/types'
import { countShown, isShown, type Crowd as CrowdData } from '../lib/crowd'
import { heightAt } from '../lib/terrainSample'
import { sceneStore, type MatPosition } from '../store/sceneStore'
import { clothTones } from './colors'
import { personStyles, type PersonStyleId } from './personStyles'

type Props = {
  crowd: CrowdData
  terrain: Terrain
  myMat: MatPosition | null
  scale: number
  styleId: PersonStyleId
  faded?: boolean
}

const HIDE_R = 2.2

export function Crowd({ crowd, terrain, myMat, scale, styleId, faded = false }: Props) {
  const bodies = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)
  const ears = useRef<InstancedMesh>(null)
  const style = personStyles[styleId]

  const ground = useMemo(
    () => ({
      people: crowd.people.map((p) => heightAt(terrain, p.x, p.z)),
    }),
    [crowd, terrain],
  )

  useLayoutEffect(() => {
    const c = new Color()
    crowd.people.forEach((p, i) => {
      const tones = style.tones ?? clothTones
      c.set(tones[p.tone % tones.length])
      bodies.current?.setColorAt(i, c)
      if (style.head && !style.head.color) heads.current?.setColorAt(i, c)
      if (style.ears) {
        ears.current?.setColorAt(i * 2, c)
        ears.current?.setColorAt(i * 2 + 1, c)
      }
    })
    for (const mesh of [bodies.current, heads.current, ears.current]) {
      if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }, [crowd, style])

  useLayoutEffect(() => {
    const o = new Object3D()
    const hidden = new Set<number>()
    if (myMat) {
      crowd.mats.forEach((m, i) => {
        if (Math.hypot(m.x - myMat.x, m.z - myMat.z) < HIDE_R) hidden.add(i)
      })
    }

    crowd.people.forEach((p, i) => {
      const g = ground.people[i]
      const off = (p.mat >= 0 && hidden.has(p.mat)) || !isShown(p, scale)
      const s = off ? 0.0001 : 1
      const [b0, b1] = style.span(p.seated)
      const len = b1 - b0
      o.position.set(p.x, g + b0 + len / 2, p.z)
      o.scale.set(s, (len / style.bodyUnit) * s, s)
      o.updateMatrix()
      bodies.current?.setMatrixAt(i, o.matrix)
      if (style.head) {
        o.position.set(p.x, g + style.head.y(p.seated), p.z)
        o.scale.set(s, s, s)
        o.updateMatrix()
        heads.current?.setMatrixAt(i, o.matrix)
        if (style.ears) {
          const e = style.ears
          for (const k of [0, 1]) {
            o.position.set(p.x + (k ? e.spread : -e.spread), g + style.head.y(p.seated) + e.lift, p.z)
            o.updateMatrix()
            ears.current?.setMatrixAt(i * 2 + k, o.matrix)
          }
        }
      }
    })

    for (const mesh of [bodies.current, heads.current, ears.current]) {
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    sceneStore.set({ crowdCount: countShown(crowd, scale) })
  }, [crowd, ground, myMat, scale, style])

  const n = crowd.people.length
  const body = style.body

  return (
    <>
      {n > 0 && (
        <instancedMesh key={`b-${styleId}`} ref={bodies} args={[undefined, undefined, n]} userData={{ noAO: faded }}>
          {body.kind === 'cylinder' ? (
            <cylinderGeometry args={[body.top, body.bottom, 1, body.segments]} />
          ) : (
            <capsuleGeometry args={[body.radius, body.length, 4, 10]} />
          )}
          <meshLambertMaterial transparent opacity={faded ? 0.18 : 1} depthWrite={!faded} />
        </instancedMesh>
      )}
      {n > 0 && style.head && (
        <instancedMesh key={`h-${styleId}`} ref={heads} args={[undefined, undefined, n]} userData={{ noAO: faded }}>
          <sphereGeometry args={[style.head.radius, 12, 8]} />
          <meshLambertMaterial color={style.head.color ?? '#ffffff'} transparent opacity={faded ? 0.18 : 1} depthWrite={!faded} />
        </instancedMesh>
      )}
      {n > 0 && style.head && style.ears && (
        <instancedMesh key={`e-${styleId}`} ref={ears} args={[undefined, undefined, n * 2]} userData={{ noAO: faded }}>
          <coneGeometry args={[style.ears.radius, style.ears.height, 4]} />
          <meshLambertMaterial transparent opacity={faded ? 0.18 : 1} depthWrite={!faded} />
        </instancedMesh>
      )}
    </>
  )
}
