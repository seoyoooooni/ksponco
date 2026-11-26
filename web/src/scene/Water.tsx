import { useEffect, useMemo } from 'react'
import { MeshPhongMaterial, Shape, ShapeGeometry, Vector2 } from 'three'
import { Line } from '@react-three/drei'
import type { Terrain, Vec2 } from '../data/types'
import { discOf, onRim } from '../lib/diorama'
import { waterLevel } from '../lib/water'
import { sceneColors } from './colors'
import { sceneTime } from './sceneTime'

function shimmerMaterial(): MeshPhongMaterial {
  const m = new MeshPhongMaterial({ color: sceneColors.water, emissive: sceneColors.waterGlow, specular: sceneColors.waterGlint, shininess: 60 })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sceneTime
    shader.vertexShader =
      'varying vec2 vShimmer;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vShimmer = (modelMatrix * vec4(transformed, 1.0)).xz;')
    shader.fragmentShader =
      'uniform float uTime;\nvarying vec2 vShimmer;\n' +
      shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
  vec2 shimmerP = vShimmer * 0.35;
  float shimmerA = sin(shimmerP.x * 1.7 + uTime * 1.1) * cos(shimmerP.y * 1.3 - uTime * 0.8);
  float shimmerB = sin((shimmerP.x + shimmerP.y) * 2.3 - uTime * 1.6);
  normal = normalize(normal + vec3(shimmerA, 0.0, shimmerB) * 0.12);`,
      )
  }
  m.customProgramCacheKey = () => 'water-shimmer'
  return m
}

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
  const material = useMemo(() => shimmerMaterial(), [])
  useEffect(() => () => material.dispose(), [material])
  return (
    <>
      <mesh geometry={geometry} position-y={level} receiveShadow raycast={() => null} userData={{ noAO: true }} material={material} />
      {outline.length > 0 && <Line points={outline} segments color={sceneColors.shore} lineWidth={2.5} transparent opacity={0.9} userData={{ noAO: true }} />}
    </>
  )
}
