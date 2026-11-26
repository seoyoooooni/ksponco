import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferGeometry, CanvasTexture, Color, DoubleSide, Float32BufferAttribute, MeshPhongMaterial, RepeatWrapping, Shape, ShapeGeometry, SRGBColorSpace, Vector2 } from 'three'
import { Line } from '@react-three/drei'
import type { Terrain, Vec2 } from '../data/types'
import { discOf, onRim, type Disc } from '../lib/diorama'
import { pointInPolygon } from '../lib/polygon'
import { waterLevel } from '../lib/water'
import { sceneColors } from './colors'
import { reducedMotion, sceneTime } from './sceneTime'
import { mistTexture, useMistTone } from './SkyDecor'

function shimmerMaterial(): MeshPhongMaterial {
  const m = new MeshPhongMaterial({ color: sceneColors.water, emissive: sceneColors.waterGlow, specular: sceneColors.waterGlint, shininess: 60, transparent: true, opacity: 0.8 })
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

const FALL_SAMPLES = 720
const FALL_ROWS = 18
const FALL_DROP = 75
const FALL_STEP = 0.8
const FALL_FADE = 2

type Arc = { from: number; to: number }

function wetArcs(disc: Disc, poly: Vec2[]): Arc[] {
  const wet: boolean[] = []
  for (let i = 0; i < FALL_SAMPLES; i++) {
    const a = (i / FALL_SAMPLES) * Math.PI * 2
    wet.push(pointInPolygon(disc.x + Math.cos(a) * (disc.r - 0.6), disc.z + Math.sin(a) * (disc.r - 0.6), poly))
  }
  if (wet.every(Boolean)) return [{ from: 0, to: Math.PI * 2 }]
  const start = wet.findIndex((w) => !w)
  const arcs: Arc[] = []
  let open = -1
  for (let k = 1; k <= FALL_SAMPLES; k++) {
    const i = (start + k) % FALL_SAMPLES
    const idx = start + k
    if (wet[i] && open < 0) open = idx
    if (!wet[i] && open >= 0) {
      arcs.push({ from: (open / FALL_SAMPLES) * Math.PI * 2, to: (idx / FALL_SAMPLES) * Math.PI * 2 })
      open = -1
    }
  }
  return arcs
}

function smooth(e0: number, e1: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

function fallGeometry(disc: Disc, arcs: Arc[], level: number) {
  const pos: number[] = []
  const col: number[] = []
  const uv: number[] = []
  const index: number[] = []
  const water = new Color(sceneColors.fallTop)
  const foam = new Color(sceneColors.foam)
  const c = new Color()
  for (const arc of arcs) {
    const len = (arc.to - arc.from) * disc.r
    const cols = Math.max(2, Math.ceil(len / FALL_STEP))
    const base = pos.length / 3
    for (let i = 0; i <= cols; i++) {
      const s = (i / cols) * len
      const a = arc.from + (s / len) * (arc.to - arc.from)
      const edge = smooth(0, FALL_FADE, s) * smooth(0, FALL_FADE, len - s)
      for (let j = 0; j <= FALL_ROWS; j++) {
        const t = j / FALL_ROWS
        const r = disc.r + 0.12 + 3.4 * Math.sqrt(t)
        pos.push(disc.x + Math.cos(a) * r, level + 0.02 - t * FALL_DROP, disc.z + Math.sin(a) * r)
        c.copy(water).lerp(foam, smooth(0.12, 1, t) * 0.9)
        col.push(c.r, c.g, c.b, edge * (t < 0.35 ? 1 : 1 - Math.pow((t - 0.35) / 0.65, 1.3)))
        uv.push(s / 6, (t * FALL_DROP) / 12)
      }
    }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < FALL_ROWS; j++) {
        const p = base + i * (FALL_ROWS + 1) + j
        const q = p + FALL_ROWS + 1
        index.push(p, q, p + 1, q, q + 1, p + 1)
      }
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new Float32BufferAttribute(col, 4))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  g.setIndex(index)
  g.computeBoundingSphere()
  return g
}

function streakTexture() {
  const w = 128
  const h = 256
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(228,238,243,0.92)'
  ctx.fillRect(0, 0, w, h)
  let seed = 17
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let i = 0; i < 70; i++) {
    const x = rand() * w
    const y = rand() * h
    const len = 30 + rand() * 120
    ctx.fillStyle = `rgba(255,255,255,${0.7 + rand() * 0.3})`
    ctx.fillRect(x, y, 1 + rand() * 3, len)
    if (y + len > h) ctx.fillRect(x, y - h, 1 + rand() * 3, len)
  }
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.wrapS = RepeatWrapping
  tex.wrapT = RepeatWrapping
  return tex
}

export function Waterfall({ poly, terrain }: { poly: Vec2[]; terrain: Terrain }) {
  const disc = useMemo(() => discOf(terrain), [terrain])
  const level = useMemo(() => waterLevel(terrain, poly), [terrain, poly])
  const arcs = useMemo(() => wetArcs(disc, poly), [disc, poly])
  const geometry = useMemo(() => fallGeometry(disc, arcs, level), [disc, arcs, level])
  const streaks = useMemo(() => streakTexture(), [])
  const puff = useMemo(() => mistTexture([[0, 0.95], [0.4, 0.5], [1, 0]]), [])
  const tone = useMistTone()
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => streaks.dispose(), [streaks])
  useEffect(() => () => puff.dispose(), [puff])

  const splashes = useMemo(
    () =>
      arcs.flatMap((arc) => {
        const n = Math.max(1, Math.round(((arc.to - arc.from) * disc.r) / 14))
        return Array.from({ length: n }, (_, i) => {
          const a = arc.from + ((i + 0.5) / n) * (arc.to - arc.from)
          const r = disc.r + 5
          return [disc.x + Math.cos(a) * r, level - FALL_DROP * 0.62, disc.z + Math.sin(a) * r] as [number, number, number]
        })
      }),
    [arcs, disc, level],
  )

  useFrame(() => {
    if (!reducedMotion) streaks.offset.y = -sceneTime.value * 0.9
  })

  if (arcs.length === 0) return null
  return (
    <>
      <mesh geometry={geometry} renderOrder={2} raycast={() => null} userData={{ noAO: true }}>
        <meshBasicMaterial color={tone} map={streaks} vertexColors transparent depthWrite={false} side={DoubleSide} />
      </mesh>
      {splashes.map((p, i) => (
        <sprite key={i} position={p} scale={[26, 14, 1]} raycast={() => null}>
          <spriteMaterial color={tone} map={puff} transparent opacity={0.6} depthWrite={false} />
        </sprite>
      ))}
    </>
  )
}
