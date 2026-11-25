import { BufferGeometry, Float32BufferAttribute, IcosahedronGeometry, Vector3 } from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function lobe(cx: number, cy: number, cz: number, r: number) {
  const g = mergeVertices(new IcosahedronGeometry(r, 2).deleteAttribute('normal').deleteAttribute('uv'))
  g.translate(cx, cy, cz)
  return g
}

export function canopyGeometry(seed: number): BufferGeometry {
  const rand = rng(seed * 7919 + 13)
  const parts = [lobe(0, -0.08, 0, 0.74)]
  const count = 4
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2 + rand() * 0.9
    const up = 0.15 + rand() * 0.45
    const d = 0.4 + rand() * 0.08
    const r = 0.46 + rand() * 0.1
    parts.push(lobe(Math.cos(a) * d * (1 - up * 0.5), up * 0.55, Math.sin(a) * d * (1 - up * 0.5), r))
  }
  parts.push(lobe((rand() - 0.5) * 0.2, 0.42, (rand() - 0.5) * 0.2, 0.5))
  const g = mergeGeometries(parts)
  parts.forEach((p) => p.dispose())

  const noise = new SimplexNoise({ random: rand })
  const pos = g.attributes.position
  const v = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = noise.noise3d(v.x * 3.1 + seed, v.y * 3.1, v.z * 3.1) * 0.035
    v.multiplyScalar(1 + n)
    pos.setXYZ(i, v.x, v.y, v.z)
  }

  g.computeBoundingBox()
  const b = g.boundingBox!
  const sx = 2 / (b.max.x - b.min.x)
  const sz = 2 / (b.max.z - b.min.z)
  const sy = 2 / (b.max.y - b.min.y)
  const s = Math.min(sx, sz)
  g.translate(-(b.max.x + b.min.x) / 2, -(b.max.y + b.min.y) / 2, -(b.max.z + b.min.z) / 2)
  g.scale(s, sy, s)

  const colors: number[] = []
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const t = (v.y + 1) / 2
    const inner = Math.min(1, v.length() / 0.85)
    const k = (0.66 + 0.46 * Math.pow(t, 0.8)) * (0.82 + 0.18 * inner)
    colors.push(k, k, k)
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}
