import { useLayoutEffect, useRef } from 'react'
import { Color, InstancedMesh, Object3D } from 'three'
import type { Terrain, Tree } from '../data/types'
import { heightAt } from '../lib/terrainSample'
import { sceneColors } from './colors'

type Props = {
  trees: Tree[]
  terrain: Terrain
}

const TONES = ['#a3cf80', '#8cc070', '#78b062', '#669e54', '#578c49']

function Canopies({ trees, terrain }: Props) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new Object3D()
    const c = new Color()
    trees.forEach((t, i) => {
      const g = heightAt(terrain, t.x, t.z)
      const half = Math.max(0.5, (t.h - t.base) / 2)
      o.position.set(t.x, g + t.base + half, t.z)
      o.scale.set(t.r, half, t.r)
      o.rotation.set(0, ((i * 2.399) % (Math.PI * 2)), 0)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      const tone = Math.abs(Math.floor(t.x * 7.3 + t.z * 3.1)) % TONES.length
      mesh.setColorAt(i, c.set(TONES[tone]))
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [trees, terrain])

  if (trees.length === 0) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, trees.length]} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 2]} />
      <meshLambertMaterial color="#ffffff" flatShading />
    </instancedMesh>
  )
}

function Trunks({ trees, terrain }: Props) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new Object3D()
    trees.forEach((t, i) => {
      const g = heightAt(terrain, t.x, t.z)
      const len = t.base + (t.h - t.base) * 0.3
      o.position.set(t.x, g + len / 2, t.z)
      o.scale.set(1, len, 1)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [trees, terrain])

  if (trees.length === 0) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, trees.length]} castShadow>
      <cylinderGeometry args={[0.22, 0.32, 1, 6]} />
      <meshLambertMaterial color={sceneColors.trunk} />
    </instancedMesh>
  )
}

export function Trees({ trees, terrain }: Props) {
  return (
    <>
      <Trunks trees={trees} terrain={terrain} />
      <Canopies trees={trees} terrain={terrain} />
    </>
  )
}
