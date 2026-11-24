import { useMemo } from 'react'
import { Shape, ShapeGeometry, Vector2 } from 'three'
import type { Vec2 } from '../data/types'
import { sceneColors } from './colors'

export function Water({ poly }: { poly: Vec2[] }) {
  const geometry = useMemo(() => {
    const shape = new Shape(poly.map(([x, z]) => new Vector2(x, -z)))
    const g = new ShapeGeometry(shape)
    g.rotateX(-Math.PI / 2)
    return g
  }, [poly])
  return (
    <mesh geometry={geometry} position-y={0.05} receiveShadow raycast={() => null}>
      <meshLambertMaterial color={sceneColors.water} />
    </mesh>
  )
}
