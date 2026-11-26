import { useMemo } from 'react'
import { Shape, ShapeGeometry, Vector2 } from 'three'
import { Line } from '@react-three/drei'
import type { Terrain, Vec2 } from '../data/types'
import { discOf, onRim } from '../lib/diorama'
import { waterLevel } from '../lib/water'
import { sceneColors } from './colors'

export function Water({ poly, terrain }: { poly: Vec2[]; terrain: Terrain }) {
  const level = useMemo(() => waterLevel(terrain, poly), [terrain, poly])
  const geometry = useMemo(() => {
    const shape = new Shape(poly.map(([x, z]) => new Vector2(x, -z)))
    const g = new ShapeGeometry(shape)
    g.rotateX(-Math.PI / 2)
    return g
  }, [poly])
  const outline = useMemo<[number, number, number][]>(() => {
    const disc = discOf(terrain)
    const pts: [number, number, number][] = []
    poly.forEach((p, i) => {
      const q = poly[(i + 1) % poly.length]
      if (onRim(disc, p) && onRim(disc, q)) return
      pts.push([p[0], level + 0.03, p[1]], [q[0], level + 0.03, q[1]])
    })
    return pts
  }, [poly, level, terrain])
  return (
    <>
      <mesh geometry={geometry} position-y={level} receiveShadow raycast={() => null} userData={{ noAO: true }}>
        <meshPhongMaterial color={sceneColors.water} emissive={sceneColors.waterGlow} specular={sceneColors.waterGlint} shininess={60} />
      </mesh>
      {outline.length > 0 && <Line points={outline} segments color={sceneColors.shore} lineWidth={2.5} transparent opacity={0.9} userData={{ noAO: true }} />}
    </>
  )
}
