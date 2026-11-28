import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { HalfFloatType, Vector2, WebGLRenderTarget, type Camera, type Scene } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { useNight } from './night'

function aoPass(scene: Scene, camera: Camera) {
  const pass = new GTAOPass(scene, camera, 1, 1)
  const hook = pass as unknown as { _overrideVisibility: () => void }
  const base = hook._overrideVisibility.bind(pass)
  hook._overrideVisibility = () => {
    base()
    scene.traverse((o) => {
      if ((o as { isSprite?: boolean }).isSprite || (o as { isPoints?: boolean }).isPoints || o.userData.noAO) o.visible = false
    })
  }
  return pass
}

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const cleanFragment = `
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0);
  gl_FragColor = min(c, vec4(24.0));
}
`

const gradeFragment = `
uniform sampler2D tDiffuse;
uniform float uContrast;
uniform float uSat;
uniform float uVignette;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  c = (c - 0.5) * uContrast + 0.5;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c *= vec3(1.01, 1.0, 0.99);
  float v = smoothstep(0.38, 0.95, length((vUv - 0.5) * vec2(1.0, 0.85)));
  c *= 1.0 - uVignette * v;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`

const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export function Effects() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const night = useNight()

  const { composer, bloom } = useMemo(() => {
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 })
    const c = new EffectComposer(gl, target)
    c.addPass(new RenderPass(scene, camera))
    const ao = aoPass(scene, camera)
    ao.updateGtaoMaterial({
      radius: 2.2,
      distanceExponent: 1.4,
      thickness: 2.5,
      scale: 1.15,
      samples: touch ? 8 : 16,
      distanceFallOff: 1,
      screenSpaceRadius: false,
    })
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: touch ? 8 : 16 })
    ao.blendIntensity = 0.85
    c.addPass(ao)
    const clean = new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader, fragmentShader: cleanFragment })
    c.addPass(clean)
    const bloom = new UnrealBloomPass(new Vector2(256, 256), 0, 0.4, 1)
    bloom.enabled = false
    c.addPass(bloom)
    c.addPass(new OutputPass())
    const grade = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, uContrast: { value: 1.07 }, uSat: { value: 1.04 }, uVignette: { value: 0.16 } },
      vertexShader,
      fragmentShader: gradeFragment,
    })
    c.addPass(grade)
    return { composer: c, bloom }
  }, [gl, scene, camera])

  useEffect(() => {
    const pr = Math.min(dpr, 1.5)
    composer.setPixelRatio(pr)
    composer.setSize(size.width, size.height)
    bloom.resolution.set(size.width * pr * 0.5, size.height * pr * 0.5)
  }, [composer, bloom, size, dpr])

  useEffect(() => {
    bloom.enabled = night > 0.02
    bloom.strength = night * 0.55
  }, [bloom, night])

  useEffect(() => () => composer.dispose(), [composer])

  useFrame(() => composer.render(), 1)
  return null
}
