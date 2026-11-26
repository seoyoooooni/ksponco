import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BufferGeometry, Color, InstancedMesh, MeshLambertMaterial, Object3D } from 'three'
import type { Terrain, Tree, Vec2 } from '../data/types'
import { heightAt } from '../lib/terrainSample'
import { discOf, inDisc } from '../lib/diorama'
import { pointInPolygon } from '../lib/polygon'
import { waterLevel } from '../lib/water'
import { sceneColors } from './colors'
import { canopyGeometry } from './treeGeometry'
import { sceneTime } from './sceneTime'
import { SHADOW_ONLY } from './SunLight'

type Props = {
  trees: Tree[]
  terrain: Terrain
  ghost?: boolean
  water?: Vec2[] | null
}

const TONES = ['#a3cf80', '#8cc070', '#78b062', '#669e54', '#578c49']

const VARIANTS = 3

function swayMaterial(): MeshLambertMaterial {
  const m = new MeshLambertMaterial({ color: '#ffffff', vertexColors: true })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sceneTime
    shader.vertexShader =
      'uniform float uTime;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
#ifdef USE_INSTANCING
  float swayPhase = instanceMatrix[3][0] * 0.13 + instanceMatrix[3][2] * 0.17;
#else
  float swayPhase = 0.0;
#endif
  float swayK = clamp(position.y + 0.4, 0.0, 1.4);
  transformed.x += sin(uTime * 1.4 + swayPhase) * 0.03 * swayK;
  transformed.z += cos(uTime * 1.1 + swayPhase * 1.3) * 0.025 * swayK;`,
      )
  }
  m.customProgramCacheKey = () => 'tree-sway'
  return m
}

function Canopies({ trees, terrain, ghost = false }: Props) {
  const geometries = useMemo(() => Array.from({ length: VARIANTS }, (_, k) => canopyGeometry(k + 1, ghost ? 1 : 3)), [ghost])
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
  const sway = useMemo(() => (ghost ? null : swayMaterial()), [ghost])
  useEffect(() => () => sway?.dispose(), [sway])

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
    <instancedMesh ref={ref} args={[geometry, undefined, trees.length]} castShadow receiveShadow={!ghost} raycast={() => null} layers={ghost ? SHADOW_ONLY : 0}>
      {sway ? <primitive object={sway} attach="material" /> : <meshBasicMaterial />}
    </instancedMesh>
  )
}

function Trunks({ trees, terrain, ghost = false, water = null }: Props) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new Object3D()
    const level = water ? waterLevel(terrain, water) : null
    trees.forEach((t, i) => {
      const g = heightAt(terrain, t.x, t.z)
      const top = g + t.base + (t.h - t.base) * 0.3
      const wet = water && level !== null && pointInPolygon(t.x, t.z, water)
      const bottom = wet && level !== null ? Math.min(g, level - 0.3) : g
      const len = top - bottom
      o.position.set(t.x, bottom + len / 2, t.z)
      o.scale.set(1, len, 1)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [trees, terrain, water])

  if (trees.length === 0) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, trees.length]} castShadow raycast={() => null} layers={ghost ? SHADOW_ONLY : 0}>
      <cylinderGeometry args={[0.22, 0.32, 1, 6]} />
      {ghost ? <meshBasicMaterial /> : <meshLambertMaterial color={sceneColors.trunk} />}
    </instancedMesh>
  )
}

export function Trees({ trees, terrain, water = null }: Props) {
  const { shown, beyond } = useMemo(() => {
    const disc = discOf(terrain)
    const shown: Tree[] = []
    const beyond: Tree[] = []
    for (const t of trees) (inDisc(disc, t.x, t.z, t.r * 0.6) ? shown : beyond).push(t)
    return { shown, beyond }
  }, [trees, terrain])

  return (
    <>
      <Trunks trees={shown} terrain={terrain} water={water} />
      <Canopies trees={shown} terrain={terrain} />
      <Trunks trees={beyond} terrain={terrain} ghost />
      <Canopies trees={beyond} terrain={terrain} ghost />
    </>
  )
}
