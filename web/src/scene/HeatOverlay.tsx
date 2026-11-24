import { useLayoutEffect, useRef } from 'react'
import { Color, InstancedMesh, Object3D } from 'three'
import type { Terrain } from '../data/types'
import { heightAt } from '../lib/terrainSample'

export type OverlayCell = {
  x: number
  z: number
  size: number
  color: string
}

export function HeatOverlay({ cells, terrain }: { cells: OverlayCell[]; terrain: Terrain }) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const o = new Object3D()
    const c = new Color()
    cells.forEach((cell, i) => {
      o.position.set(cell.x, heightAt(terrain, cell.x, cell.z) + 0.12, cell.z)
      o.rotation.set(-Math.PI / 2, 0, 0)
      o.scale.set(cell.size, cell.size, 1)
      o.updateMatrix()
      mesh.setMatrixAt(i, o.matrix)
      mesh.setColorAt(i, c.set(cell.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [cells, terrain])

  if (cells.length === 0) return null
  return (
    <instancedMesh key={cells.length} ref={ref} args={[undefined, undefined, cells.length]} raycast={() => null}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial transparent opacity={0.88} depthWrite={false} />
    </instancedMesh>
  )
}
