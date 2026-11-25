import { useMemo } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import type { Terrain } from '../data/types'
import { heightAt } from '../lib/terrainSample'

export type OverlayCell = {
  x: number
  z: number
  size: number
  color: string
}

const LIFT = 0.15

export function HeatOverlay({ cells, terrain, opacity = 0.9 }: { cells: OverlayCell[]; terrain: Terrain; opacity?: number }) {
  const geometry = useMemo(() => {
    const pos: number[] = []
    const col: number[] = []
    const c = new Color()
    for (const cell of cells) {
      const h = cell.size / 2
      const x0 = cell.x - h
      const x1 = cell.x + h
      const z0 = cell.z - h
      const z1 = cell.z + h
      const y = (x: number, z: number) => heightAt(terrain, x, z) + LIFT
      const a = [x0, y(x0, z0), z0]
      const b = [x1, y(x1, z0), z0]
      const d = [x0, y(x0, z1), z1]
      const e = [x1, y(x1, z1), z1]
      pos.push(...a, ...d, ...b, ...b, ...d, ...e)
      c.set(cell.color)
      for (let k = 0; k < 6; k++) col.push(c.r, c.g, c.b)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('color', new Float32BufferAttribute(col, 3))
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return g
  }, [cells, terrain])

  if (cells.length === 0) return null
  return (
    <mesh geometry={geometry} raycast={() => null}>
      <meshLambertMaterial vertexColors transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  )
}
