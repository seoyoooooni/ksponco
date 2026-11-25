import { useMemo } from 'react'
import { Shape, ShapeGeometry, Vector2 } from 'three'
import type { Terrain, Vec2 } from '../data/types'
import { pointInPolygon } from '../lib/polygon'
import { sceneColors } from './colors'

export function waterLevel(terrain: Terrain, poly: Vec2[]): number {
  let top = -Infinity
  for (let j = 0; j < terrain.nz; j++) {
    for (let i = 0; i < terrain.nx; i++) {
      const x = terrain.x0 + i * terrain.cell
      const z = terrain.z0 + j * terrain.cell
      if (pointInPolygon(x, z, poly)) top = Math.max(top, terrain.h[j * terrain.nx + i])
    }
  }
  return Number.isFinite(top) ? top + 0.05 : 0.05
}

export function Water({ poly, terrain }: { poly: Vec2[]; terrain: Terrain }) {
  const level = useMemo(() => waterLevel(terrain, poly), [terrain, poly])
  const geometry = useMemo(() => {
    const shape = new Shape(poly.map(([x, z]) => new Vector2(x, -z)))
    const g = new ShapeGeometry(shape)
    g.rotateX(-Math.PI / 2)
    return g
  }, [poly])
  return (
    <mesh geometry={geometry} position-y={level} receiveShadow raycast={() => null}>
      <meshLambertMaterial color={sceneColors.water} />
    </mesh>
  )
}
