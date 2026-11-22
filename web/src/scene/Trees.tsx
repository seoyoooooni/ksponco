import { useLayoutEffect, useMemo, useRef } from 'react'
import { InstancedMesh, Object3D } from 'three'
import type { Terrain, Tree } from '../data/types'
import { heightAt } from '../lib/terrainSample'
import { sceneColors } from './colors'

type Props = {
  trees: Tree[]
  terrain: Terrain
}

function Canopies({ trees, terrain, color, opacity }: Props & { color: string; opacity: number }) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new Object3D()
    trees.forEach((t, i) => {
      const g = heightAt(terrain, t.x, t.z)
      const half = Math.max(0.5, (t.h - t.base) / 2)
      o.position.set(t.x, g + t.base + half, t.z)
      o.scale.set(t.r, half, t.r)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [trees, terrain])

  if (trees.length === 0) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, trees.length]} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 2]} />
      <meshLambertMaterial color={color} flatShading transparent={opacity < 1} opacity={opacity} />
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
  const scan = useMemo(() => trees.filter((t) => t.source === 'scan'), [trees])
  const satellite = useMemo(() => trees.filter((t) => t.source !== 'scan'), [trees])
  return (
    <>
      <Trunks trees={trees} terrain={terrain} />
      <Canopies trees={scan} terrain={terrain} color={sceneColors.canopy} opacity={1} />
      <Canopies trees={satellite} terrain={terrain} color={sceneColors.canopySatellite} opacity={0.72} />
    </>
  )
}
