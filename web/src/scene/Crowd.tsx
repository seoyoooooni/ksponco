import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, InstancedMesh, Object3D } from 'three'
import type { Layout, Terrain } from '../data/types'
import { countShown, isShown, type Crowd as CrowdData } from '../lib/crowd'
import { heightAt } from '../lib/terrainSample'
import { sceneStore, type MatPosition } from '../store/sceneStore'
import { clothTones, matTones } from './colors'
import { personStyles, type PersonStyleId } from './personStyles'

type Props = {
  crowd: CrowdData
  layout: Layout
  terrain: Terrain
  myMat: MatPosition | null
  scale: number
  styleId: PersonStyleId
}

const HIDE_R = 2.2

export function Crowd({ crowd, layout, terrain, myMat, scale, styleId }: Props) {
  const bodies = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)
  const mats = useRef<InstancedMesh>(null)
  const style = personStyles[styleId]

  const ground = useMemo(
    () => ({
      people: crowd.people.map((p) => heightAt(terrain, p.x, p.z)),
      mats: crowd.mats.map((m) => heightAt(terrain, m.x, m.z)),
    }),
    [crowd, terrain],
  )

  useLayoutEffect(() => {
    const c = new Color()
    crowd.people.forEach((p, i) => {
      c.set(clothTones[p.tone % clothTones.length])
      bodies.current?.setColorAt(i, c)
      if (style.head && !style.head.color) heads.current?.setColorAt(i, c)
    })
    crowd.mats.forEach((m, i) => mats.current?.setColorAt(i, c.set(matTones[m.tone % matTones.length])))
    for (const mesh of [bodies.current, heads.current, mats.current]) {
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
      }
    })

    crowd.mats.forEach((m, i) => {
      const s = hidden.has(i) || !isShown(m, scale) ? 0.0001 : 1
      o.position.set(m.x, ground.mats[i] + 0.03, m.z)
      o.scale.set(s, 1, s)
      o.updateMatrix()
      mats.current?.setMatrixAt(i, o.matrix)
    })

    for (const mesh of [bodies.current, heads.current, mats.current]) {
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
    sceneStore.set({ crowdCount: countShown(crowd, scale) })
  }, [crowd, ground, myMat, scale, style])

  const n = crowd.people.length
  const m = crowd.mats.length
  const body = style.body

  return (
    <>
      {n > 0 && (
        <instancedMesh key={`b-${styleId}`} ref={bodies} args={[undefined, undefined, n]}>
          {body.kind === 'cylinder' ? (
            <cylinderGeometry args={[body.top, body.bottom, 1, body.segments]} />
          ) : (
            <capsuleGeometry args={[body.radius, body.length, 4, 10]} />
          )}
          <meshLambertMaterial />
        </instancedMesh>
      )}
      {n > 0 && style.head && (
        <instancedMesh key={`h-${styleId}`} ref={heads} args={[undefined, undefined, n]}>
          <sphereGeometry args={[style.head.radius, 12, 8]} />
          <meshLambertMaterial color={style.head.color ?? '#ffffff'} />
        </instancedMesh>
      )}
      {m > 0 && (
        <instancedMesh ref={mats} args={[undefined, undefined, m]} receiveShadow renderOrder={1}>
          <boxGeometry args={[layout.mat.w, 0.04, layout.mat.d]} />
          <meshLambertMaterial transparent />
        </instancedMesh>
      )}
    </>
  )
}
