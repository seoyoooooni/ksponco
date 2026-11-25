import { BufferGeometry, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function canopyGeometry(seed: number): BufferGeometry {
  const rand = rng(seed * 7919 + 13)
  const noise = new SimplexNoise({ random: rand })
  const g = mergeVertices(new IcosahedronGeometry(1, 4).deleteAttribute('normal').deleteAttribute('uv'))
  const pos = g.attributes.position
  const v = new Vector3()
  const off = seed * 3.7

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const broad = noise.noise3d(v.x * 1.1 + off, v.y * 1.1, v.z * 1.1) * 0.11
    const fine = noise.noise3d(v.x * 2.6 + off, v.y * 2.6, v.z * 2.6) * 0.035
    v.multiplyScalar(1 + broad + fine)
    if (v.y < 0) v.y *= 0.82
    else v.y *= 1 - 0.12 * v.y
    pos.setXYZ(i, v.x, v.y, v.z)
  }

  g.computeBoundingBox()
  const b = g.boundingBox!
  const s = Math.min(2 / (b.max.x - b.min.x), 2 / (b.max.z - b.min.z))
  const sy = 2 / (b.max.y - b.min.y)
  g.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, -(b.max.z + b.min.z) / 2)
  g.scale(s, sy, s)

  const colors: number[] = []
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const t = (v.y + 1) / 2
    const k = 0.72 + 0.36 * Math.pow(t, 0.9)
    colors.push(k, k, k)
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}
