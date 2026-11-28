import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from 'three'
import type { StageSpec, Terrain } from '../data/types'
import { isShown, type Crowd } from '../lib/crowd'
import { rng } from '../lib/rng'
import { heightAt } from '../lib/terrainSample'
import type { MatPosition } from '../store/sceneStore'
import type { Route } from './Paths'
import { mistTexture } from './SkyDecor'
import { facingRotation } from './Stage'
import { reducedMotion, sceneTime } from './sceneTime'

const LAMP_GAP = 30
const LAMP_MIN = 18
const LAMP_H = 3.4
const GLOW = 6
const GLOW_GRID = 8

export function Lamps({ routes, terrain, night }: { routes: Route[]; terrain: Terrain; night: number }) {
  const spots = useMemo(() => {
    const out: [number, number][] = []
    const near = (x: number, z: number) => out.some(([a, b]) => Math.hypot(a - x, b - z) < LAMP_MIN)
    for (const r of routes) {
      if (r.len < LAMP_GAP * 0.6) continue
      let side = 1
      for (let s = LAMP_GAP / 2; s < r.len; s += LAMP_GAP) {
        let i = 1
        while (i < r.cum.length - 1 && r.cum[i] < s) i++
        const [x0, , z0] = r.pts[i - 1]
        const [x1, , z1] = r.pts[i]
        const seg = Math.max(1e-6, r.cum[i] - r.cum[i - 1])
        const t = (s - r.cum[i - 1]) / seg
        const tx = (x1 - x0) / seg
        const tz = (z1 - z0) / seg
        const off = r.half + 0.45
        const x = x0 + (x1 - x0) * t - tz * off * side
        const z = z0 + (z1 - z0) * t + tx * off * side
        side = -side
        if (!near(x, z)) out.push([x, z])
      }
    }
    return out.map(([x, z]) => [x, heightAt(terrain, x, z), z] as [number, number, number])
  }, [routes, terrain])

  const posts = useRef<InstancedMesh>(null)
  const heads = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const o = new Object3D()
    spots.forEach(([x, y, z], i) => {
      o.position.set(x, y + LAMP_H / 2, z)
      o.updateMatrix()
      posts.current?.setMatrixAt(i, o.matrix)
      o.position.set(x, y + LAMP_H + 0.12, z)
      o.updateMatrix()
      heads.current?.setMatrixAt(i, o.matrix)
    })
    for (const m of [posts.current, heads.current]) {
      if (!m) continue
      m.instanceMatrix.needsUpdate = true
      m.computeBoundingSphere()
    }
  }, [spots])

  const pool = useMemo(() => {
    const pos: number[] = []
    const uv: number[] = []
    const index: number[] = []
    const n = GLOW_GRID
    spots.forEach(([cx, , cz]) => {
      const base = pos.length / 3
      for (let j = 0; j <= n; j++) {
        for (let i = 0; i <= n; i++) {
          const u = i / n
          const v = j / n
          const x = cx + (u - 0.5) * GLOW
          const z = cz + (v - 0.5) * GLOW
          pos.push(x, heightAt(terrain, x, z) + 0.12, z)
          uv.push(u, v)
        }
      }
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const a = base + j * (n + 1) + i
          index.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2)
        }
      }
    })
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
    g.setIndex(index)
    return g
  }, [spots, terrain])
  useEffect(() => () => pool.dispose(), [pool])

  const halo = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(spots.flatMap(([x, y, z]) => [x, y + LAMP_H + 0.12, z]), 3))
    return g
  }, [spots])
  useEffect(() => () => halo.dispose(), [halo])
  const haloMat = useMemo(() => glowMaterial('#ffc27a', false), [])
  useEffect(() => () => haloMat.dispose(), [haloMat])
  useGlow(haloMat, 1.5, night * 0.35)

  const glowTex = useMemo(() => mistTexture([[0, 0.9], [0.25, 0.5], [0.6, 0.12], [1, 0]]), [])
  useEffect(() => () => glowTex.dispose(), [glowTex])

  const n = spots.length
  if (!n) return null
  const lit = night > 0.02
  return (
    <>
      <instancedMesh ref={posts} args={[undefined, undefined, n]} castShadow raycast={() => null}>
        <cylinderGeometry args={[0.06, 0.09, LAMP_H, 8]} />
        <meshLambertMaterial color="#5b6360" />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, n]} raycast={() => null}>
        <sphereGeometry args={[0.24, 16, 10]} />
        <meshLambertMaterial color="#f4f1e8" emissive="#ffc879" emissiveIntensity={night * 1.15} />
      </instancedMesh>
      <mesh geometry={pool} visible={lit} raycast={() => null} userData={{ noAO: true }} renderOrder={2}>
        <meshBasicMaterial
          color="#ffb45e"
          map={glowTex}
          transparent
          opacity={night * 0.38}
          blending={AdditiveBlending}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-4}
        />
      </mesh>
      <points geometry={halo} material={haloMat} visible={lit} raycast={() => null} userData={{ noAO: true }} renderOrder={3} />
    </>
  )
}

export function Stars({ night }: { night: number }) {
  const geometry = useMemo(() => {
    const r = rng(7)
    const pos: number[] = []
    for (let i = 0; i < 700; i++) {
      const a = r() * Math.PI * 2
      const e = Math.asin(0.08 + r() * 0.92)
      const d = 1100
      pos.push(Math.cos(e) * Math.cos(a) * d, Math.sin(e) * d, Math.cos(e) * Math.sin(a) * d)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  const camera = useThree((s) => s.camera)
  const group = useRef<Group>(null)
  useFrame(() => group.current?.position.copy(camera.position))
  if (night < 0.05) return null
  return (
    <group ref={group}>
      <points geometry={geometry} renderOrder={-2} raycast={() => null} userData={{ noAO: true }} frustumCulled={false}>
        <pointsMaterial color="#e8eeff" size={1.6} sizeAttenuation={false} transparent opacity={night * 0.85} depthWrite={false} fog={false} />
      </points>
    </group>
  )
}

const glowVertex = `
attribute float phase;
uniform float uTime;
uniform float uSize;
uniform float uTwinkle;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float s = 0.5 + 0.5 * sin(uTime * (0.7 + fract(phase * 7.13) * 1.6) + phase * 6.2832);
  vA = mix(1.0, 0.35 + 0.65 * s * s, uTwinkle);
  gl_PointSize = max(2.0, uSize / -mv.z);
}
`

const glowFragment = `
uniform vec3 uColor;
uniform float uNight;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor * a * a * vA * uNight * 2.4, 1.0);
}
`

function glowMaterial(color: string, twinkle: boolean) {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 1 },
      uNight: { value: 0 },
      uTwinkle: { value: twinkle ? 1 : 0 },
      uColor: { value: new Color(color) },
    },
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  })
}

function useGlow(material: ShaderMaterial, meters: number, level: number) {
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  useFrame(() => {
    const u = material.uniforms
    u.uTime.value = sceneTime.value
    u.uNight.value = level
    u.uSize.value = (meters * size.height * Math.min(dpr, 1.5)) / (2 * Math.tan((camera.fov * Math.PI) / 360))
  })
}

const PHONE_SHARE = 0.09
const HIDE_R = 2.2

export function PhoneLights({ crowd, terrain, myMat, scale, night }: { crowd: Crowd; terrain: Terrain; myMat: MatPosition | null; scale: number; night: number }) {
  const geometry = useMemo(() => {
    const r = rng(29)
    const pos: number[] = []
    const phase: number[] = []
    crowd.people.forEach((p) => {
      if (r() > PHONE_SHARE || !isShown(p, scale)) return
      const m = p.mat >= 0 ? crowd.mats[p.mat] : null
      if (myMat && m && Math.hypot(m.x - myMat.x, m.z - myMat.z) < HIDE_R) return
      pos.push(p.x, heightAt(terrain, p.x, p.z) + (p.seated ? 1.05 : 1.6), p.z)
      phase.push(r())
    })
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('phase', new Float32BufferAttribute(phase, 1))
    return g
  }, [crowd, terrain, myMat, scale])
  useEffect(() => () => geometry.dispose(), [geometry])

  const material = useMemo(() => glowMaterial('#fff6e2', true), [])
  useEffect(() => () => material.dispose(), [material])
  useGlow(material, 0.55, night)

  if (night < 0.05) return null
  return <points geometry={geometry} material={material} raycast={() => null} userData={{ noAO: true }} renderOrder={3} />
}

const beamVertex = `
varying float vH;
void main() {
  vH = uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const beamFragment = `
uniform vec3 uColor;
uniform float uNight;
uniform float uGain;
varying float vH;
void main() {
  float a = pow(vH, 1.6) * 0.5 + 0.04;
  gl_FragColor = vec4(uColor * a * uNight * uGain, 1.0);
}
`

type Beam = { at: Vector3; aim: Vector3; color: string; phase: number; len: number; spread: number; gain: number }

const BEAM_COLORS = ['#fff1d6', '#ffd98a', '#fffaf0']
const DOWN = new Vector3(0, -1, 0)

function BeamMesh({ beam, night }: { beam: Beam; night: number }) {
  const group = useRef<Group>(null)
  const geometry = useMemo(() => new ConeGeometry(beam.spread, beam.len, 28, 1, true).translate(0, -beam.len / 2, 0), [beam])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uColor: { value: new Color(beam.color) }, uNight: { value: 0 }, uGain: { value: beam.gain } },
        vertexShader: beamVertex,
        fragmentShader: beamFragment,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [beam],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  const base = useMemo(() => new Quaternion().setFromUnitVectors(DOWN, beam.aim.clone().sub(beam.at).normalize()), [beam])
  const sway = useMemo(() => new Quaternion(), [])
  const axis = useMemo(() => new Vector3(), [])

  useFrame(() => {
    material.uniforms.uNight.value = night
    const g = group.current
    if (!g) return
    const t = reducedMotion ? 0 : sceneTime.value
    axis.set(Math.cos(beam.phase), 0, Math.sin(beam.phase))
    sway.setFromAxisAngle(axis, Math.sin(t * 0.55 + beam.phase * 3) * 0.16)
    g.quaternion.copy(base).multiply(sway)
  })

  return (
    <group ref={group} position={beam.at}>
      <mesh geometry={geometry} material={material} raycast={() => null} userData={{ noAO: true }} renderOrder={4} />
      <mesh raycast={() => null} userData={{ noAO: true }}>
        <sphereGeometry args={[0.22, 12, 8]} />
        <meshBasicMaterial color={beam.color} toneMapped={false} transparent opacity={0.3 + night * 0.35} />
      </mesh>
    </group>
  )
}

function stageBeams(stage: StageSpec, floor: number): Beam[] {
  const out: Beam[] = []
  const rot = facingRotation(stage.azimuth)
  const local = (x: number, y: number, z: number) =>
    new Vector3(x * Math.cos(rot) + z * Math.sin(rot) + stage.x, y + floor, -x * Math.sin(rot) + z * Math.cos(rot) + stage.z)
  const { w, d, deckH, roofH } = stage
  if (stage.shape === 'circle') {
    const r = stage.r ?? w / 2
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const at = new Vector3(stage.x + Math.cos(a) * r * 0.92, floor + deckH + 0.2, stage.z + Math.sin(a) * r * 0.92)
      const aim = new Vector3(stage.x + Math.cos(a) * r * 2.2, floor + deckH + 30, stage.z + Math.sin(a) * r * 2.2)
      out.push({ at, aim, color: BEAM_COLORS[i % 3], phase: a, len: 34, spread: 2.6, gain: 0.2 })
    }
    return out
  }
  if (roofH == null) {
    for (const s of [-1, 1]) {
      const at = local((s * w) / 2, deckH + 0.2, d / 2)
      const aim = local((s * w) / 2 + s * 6, deckH + 28, d / 2 + 8)
      out.push({ at, aim, color: BEAM_COLORS[s > 0 ? 2 : 1], phase: s, len: 30, spread: 2.6, gain: 0.2 })
    }
    return out
  }
  const n = Math.max(3, Math.round(w / 6))
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1) - 0.5) * (w - 2)
    const at = local(x, roofH - 0.5, d / 2 - 0.4)
    const aim = local(x * 0.45, deckH, -d * 0.05)
    out.push({ at, aim, color: BEAM_COLORS[i % 3], phase: i * 1.7, len: at.distanceTo(aim) * 1.05, spread: 1.4, gain: 0.4 })
  }
  return out
}

export function StageLights({ stage, terrain, night }: { stage: StageSpec; terrain: Terrain; night: number }) {
  const floor = heightAt(terrain, stage.x, stage.z)
  const beams = useMemo(() => stageBeams(stage, floor), [stage, floor])
  const wash = useMemo(() => {
    const rot = facingRotation(stage.azimuth)
    const ahead = stage.shape === 'circle' ? 0 : stage.d / 2 + 6
    return new Vector3(stage.x + Math.sin(rot) * ahead, floor + stage.deckH + 7, stage.z + Math.cos(rot) * ahead)
  }, [stage, floor])
  if (night < 0.02) return null
  return (
    <>
      {beams.map((b, i) => (
        <BeamMesh key={i} beam={b} night={night} />
      ))}
      <pointLight position={wash} color="#ffd9b0" intensity={night * 140} distance={45} decay={2} />
      <pointLight position={[stage.x, floor + stage.deckH + 4, stage.z]} color="#fff0d0" intensity={night * 60} distance={25} decay={2} />
    </>
  )
}
