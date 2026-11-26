import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BufferGeometry, Color, InstancedMesh, Object3D } from 'three'
import type { Terrain, Tree } from '../data/types'
import { heightAt } from '../lib/terrainSample'
import { discOf, inDisc } from '../lib/diorama'
import { sceneColors } from './colors'
import { canopyGeometry } from './treeGeometry'

type Props = {
  trees: Tree[]
  terrain: Terrain
  ghost?: boolean
}

const TONES = ['#a3cf80', '#8cc070', '#78b062', '#669e54', '#578c49']

const VARIANTS = 3

function Canopies({ trees, terrain, ghost = false }: Props) {
  const geometries = useMemo(() => Array.from({ length: VARIANTS }, (_, k) => canopyGeometry(k + 1)), [])
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries])

  const groups = useMemo(() => {
    const out: Tree[][] = Array.from({ length: VARIANTS }, () => [])
    trees.forEach((t, i) => out[Math.abs(Math.floor(t.x * 3.7 + t.z * 5.3 + i)) % VARIANTS].push(t))
    return out
  }, [trees])

  return (
    <>
      {groups.map((list, k) => (
        <CanopyBatch key={k} trees={list} terrain={terrain} geometry={geometries[k]} ghost={ghost} />
      ))}
    </>
  )
}

function CanopyBatch({ trees, terrain, geometry, ghost = false }: Props & { geometry: BufferGeometry }) {
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
      o.rotation.set(0, (t.x * 1.7 + t.z * 2.3) % (Math.PI * 2), 0)
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
    <instancedMesh ref={ref} args={[geometry, undefined, trees.length]} castShadow receiveShadow={!ghost} raycast={() => null} userData={{ noAO: ghost }}>
      {ghost ? <meshBasicMaterial colorWrite={false} depthWrite={false} /> : <meshLambertMaterial color="#ffffff" vertexColors />}
    </instancedMesh>
  )
}

function Trunks({ trees, terrain, ghost = false }: Props) {
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
    <instancedMesh ref={ref} args={[undefined, undefined, trees.length]} castShadow raycast={() => null} userData={{ noAO: ghost }}>
      <cylinderGeometry args={[0.22, 0.32, 1, 6]} />
      {ghost ? <meshBasicMaterial colorWrite={false} depthWrite={false} /> : <meshLambertMaterial color={sceneColors.trunk} />}
    </instancedMesh>
  )
}

export function Trees({ trees, terrain }: Props) {
  const { shown, beyond } = useMemo(() => {
    const disc = discOf(terrain)
    const shown: Tree[] = []
    const beyond: Tree[] = []
    for (const t of trees) (inDisc(disc, t.x, t.z, t.r * 0.6) ? shown : beyond).push(t)
    return { shown, beyond }
  }, [trees, terrain])

  return (
    <>
      <Trunks trees={shown} terrain={terrain} />
      <Canopies trees={shown} terrain={terrain} />
      <Trunks trees={beyond} terrain={terrain} ghost />
      <Canopies trees={beyond} terrain={terrain} ghost />
    </>
  )
}
