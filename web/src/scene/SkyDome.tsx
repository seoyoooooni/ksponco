import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, BufferGeometry, Color, Float32BufferAttribute, Group, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three'
import { rng } from '../lib/rng'
import { mistTexture } from './SkyDecor'
import { reducedMotion, sceneTime } from './sceneTime'
import type { SceneWeather, SkyTone } from './weather'

const domeVertex = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const domeFragment = `
uniform vec3 uSun;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform float uAmount;
uniform float uDisc;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uZenith, sqrt(clamp(h, 0.0, 1.0)));
  col = mix(col, mix(uHorizon, uZenith, 0.35) * 0.96, 1.0 - smoothstep(-0.35, 0.0, h));
  vec2 a = d.xz / max(length(d.xz), 1e-3);
  vec2 b = uSun.xz / max(length(uSun.xz), 1e-3);
  float w = clamp(dot(a, b) * 0.5 + 0.5, 0.0, 1.0);
  float aw = 1.0 - w;
  float band = exp(-max(h, 0.0) * 2.6) * smoothstep(-0.3, 0.0, h);
  float belt = exp(-abs(h - 0.12) * 7.0) * aw * aw;
  col = mix(col, vec3(0.86, 0.5, 0.58), clamp(uAmount * belt * 0.45, 0.0, 1.0));
  col = mix(col, uGlow, clamp(uAmount * band * (0.08 + 0.92 * w * sqrt(w)), 0.0, 1.0) * 0.95);
  col += uGlow * uAmount * 0.12 * w * w * (1.0 - clamp(h, 0.0, 1.0));
  float s = clamp(dot(d, uSun / max(length(uSun), 1e-3)), -1.0, 1.0);
  float disc = smoothstep(0.9991, 0.9995, s) * 1.4 + pow(max(s, 0.0), 260.0) * 0.5;
  col += uDisc * disc * vec3(1.0, 0.88, 0.7) * step(-0.005, h);
  gl_FragColor = vec4(clamp(col, 0.0, 8.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export function SkyDome({ tone, sun }: { tone: SkyTone; sun: [number, number, number] }) {
  const mesh = useRef<Mesh>(null)
  const camera = useThree((s) => s.camera)
  const geometry = useMemo(() => new SphereGeometry(1000, 48, 24), [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uSun: { value: new Vector3() },
          uZenith: { value: new Color() },
          uHorizon: { value: new Color() },
          uGlow: { value: new Color() },
          uAmount: { value: 0 },
          uDisc: { value: 0 },
        },
        vertexShader: domeVertex,
        fragmentShader: domeFragment,
        side: BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
      }),
    [],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useEffect(() => {
    const u = material.uniforms
    u.uSun.value.set(...sun)
    u.uZenith.value.copy(tone.zenith)
    u.uHorizon.value.copy(tone.horizon)
    u.uGlow.value.copy(tone.glow)
    u.uAmount.value = tone.amount
    u.uDisc.value = tone.disc
  }, [material, tone, sun])

  useFrame(() => mesh.current?.position.copy(camera.position))

  return <mesh ref={mesh} geometry={geometry} material={material} renderOrder={-10} frustumCulled={false} raycast={() => null} userData={{ noAO: true }} />
}

type Puff = { x: number; y: number; z: number; w: number; h: number; o: number; az: number; on: number }

const CLOUDS = 22

export function SkyClouds({ tone, sun, weather, night, center }: { tone: SkyTone; sun: [number, number, number]; weather: SceneWeather; night: number; center: [number, number, number] }) {
  const tex = useMemo(() => mistTexture([[0, 0.85], [0.4, 0.5], [0.75, 0.12], [1, 0]]), [])
  useEffect(() => () => tex.dispose(), [tex])
  const puffs = useMemo(() => {
    const r = rng(53)
    const out: Puff[] = []
    for (let i = 0; i < CLOUDS; i++) {
      const az = r() * Math.PI * 2
      const d = 360 + r() * 520
      const w = 130 + r() * 170
      out.push({ x: Math.cos(az) * d, z: Math.sin(az) * d, y: 150 + r() * 170, w, h: w * (0.26 + r() * 0.14), o: 0.5 + r() * 0.35, az, on: r() })
    }
    return out
  }, [])

  const colors = useMemo(() => {
    const sunAz = Math.atan2(sun[2], sun[0])
    const day = new Color('#ffffff').lerp(new Color('#b4bbc2'), weather.overcast * 0.8)
    const dark = tone.zenith.clone().lerp(tone.horizon, 0.5).multiplyScalar(1.15)
    return puffs.map((p) => {
      const facing = Math.cos(p.az - sunAz) * 0.5 + 0.5
      const c = day.clone().lerp(dark, night * 0.85)
      return c.lerp(tone.glow, Math.min(1, tone.amount * (0.25 + 0.75 * facing * facing) * 0.85))
    })
  }, [puffs, sun, weather.overcast, tone, night])

  const drift = useRef<Group>(null)
  useFrame((_, dt) => {
    if (!reducedMotion && drift.current) drift.current.rotation.y += Math.min(dt, 0.1) * 0.004
  })

  const shown = puffs.filter((p) => p.on < weather.cloud)
  if (!shown.length) return null
  return (
    <group position={center}>
      <group ref={drift}>
        {puffs.map((p, i) =>
          p.on < weather.cloud ? (
            <sprite key={i} position={[p.x, p.y, p.z]} scale={[p.w, p.h, 1]} raycast={() => null}>
              <spriteMaterial color={colors[i]} map={tex} transparent opacity={p.o * (0.75 + 0.25 * weather.overcast)} depthWrite={false} fog={false} />
            </sprite>
          ) : null,
        )}
      </group>
    </group>
  )
}

const rainVertex = `
attribute float tip;
attribute float seed;
uniform float uTime;
uniform float uBox;
uniform float uLen;
varying float vA;
varying float vY;
void main() {
  vec3 p = position;
  p.y = mod(p.y - uTime * (16.0 + seed * 6.0), uBox) - uBox * 0.5 - tip * uLen;
  p.x -= tip * uLen * 0.12;
  vA = 1.0 - tip;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  vY = gl_Position.y / gl_Position.w;
}
`

const rainFragment = `
uniform float uRain;
varying float vA;
varying float vY;
void main() {
  float top = smoothstep(0.15, 0.65, vY);
  gl_FragColor = vec4(0.6, 0.66, 0.74, (0.2 + 0.3 * vA) * uRain * top);
  #include <colorspace_fragment>
}
`

const DROPS = 1400
const BOX = 70

export function Rain({ amount }: { amount: number }) {
  const group = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  const ahead = useMemo(() => new Vector3(), [])
  const geometry = useMemo(() => {
    const r = rng(61)
    const pos: number[] = []
    const tip: number[] = []
    const seed: number[] = []
    for (let i = 0; i < DROPS; i++) {
      const x = (r() - 0.5) * BOX * 2
      const y = r() * BOX
      const z = (r() - 0.5) * BOX * 2
      const s = r()
      pos.push(x, y, z, x, y, z)
      tip.push(0, 1)
      seed.push(s, s)
    }
    const g = new BufferGeometry()
    g.setAttribute('position', new Float32BufferAttribute(pos, 3))
    g.setAttribute('tip', new Float32BufferAttribute(tip, 1))
    g.setAttribute('seed', new Float32BufferAttribute(seed, 1))
    return g
  }, [])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uBox: { value: BOX }, uLen: { value: 4 }, uRain: { value: 0 } },
        vertexShader: rainVertex,
        fragmentShader: rainFragment,
        transparent: true,
        depthWrite: false,
      }),
    [],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame(() => {
    material.uniforms.uTime.value = reducedMotion ? 0 : sceneTime.value
    material.uniforms.uRain.value = amount
    camera.getWorldDirection(ahead)
    group.current?.position.copy(camera.position).addScaledVector(ahead, BOX * 0.5)
  })

  if (amount <= 0) return null
  return (
    <group ref={group}>
      <lineSegments geometry={geometry} material={material} frustumCulled={false} raycast={() => null} userData={{ noAO: true }} renderOrder={5} />
    </group>
  )
}
