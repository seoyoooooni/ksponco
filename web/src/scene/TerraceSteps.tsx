import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute } from 'three'
import type { Terrace } from '../data/types'
import { sceneColors } from './colors'

const SEGMENTS = 72
const SKIRT = 0.4

function build(tr: Terrace) {
  const pos: number[] = []
  const col: number[] = []
  const c = new Color()
  const at = (a: number, r: number, y: number) => [tr.x + Math.sin(a) * r, y, tr.z - Math.cos(a) * r]
  const quad = (p: number[][], color: string) => {
    c.set(color)
    for (const k of [0, 1, 2, 0, 2, 3]) {
      pos.push(...p[k])
      col.push(c.r, c.g, c.b)
    }
  }
  const a0 = tr.mid - tr.half
  const a1 = tr.mid + tr.half
  const outer = tr.rIn + tr.n * tr.depth + tr.walk
  for (let k = 1; k <= tr.n; k++) {
    const r0 = tr.rIn + (k - 1) * tr.depth
    const r1 = k < tr.n ? tr.rIn + k * tr.depth : outer
    const y = k < tr.n ? tr.floor + k * tr.rise : tr.top + 0.005
    const below = k === 1 ? tr.floor - SKIRT : tr.floor + (k - 1) * tr.rise
    const tread = k === tr.n ? sceneColors.stepWalk : k % 2 ? sceneColors.stepTread : sceneColors.stepTreadAlt
    for (let i = 0; i < SEGMENTS; i++) {
      const u = a0 + ((a1 - a0) * i) / SEGMENTS
      const v = a0 + ((a1 - a0) * (i + 1)) / SEGMENTS
      quad([at(u, r0, y), at(v, r0, y), at(v, r1, y), at(u, r1, y)], tread)
      quad([at(u, r0, below), at(v, r0, below), at(v, r0, y), at(u, r0, y)], sceneColors.stepRiser)
      if (k === tr.n) quad([at(u, r1, y - SKIRT), at(v, r1, y - SKIRT), at(v, r1, y), at(u, r1, y)], sceneColors.stepSide)
    }
    for (const a of [a0, a1]) {
      quad([at(a, r0, tr.floor - SKIRT), at(a, r1, tr.floor - SKIRT), at(a, r1, y), at(a, r0, y)], sceneColors.stepSide)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

export function TerraceSteps({ terrace }: { terrace: Terrace }) {
  const geometry = useMemo(() => build(terrace), [terrace])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} castShadow receiveShadow raycast={() => null}>
      <meshLambertMaterial vertexColors side={DoubleSide} />
    </mesh>
  )
}
