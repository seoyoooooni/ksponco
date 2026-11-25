import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { HalfFloatType, WebGLRenderTarget, type Camera, type Scene } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

function aoPass(scene: Scene, camera: Camera) {
  const pass = new GTAOPass(scene, camera, 1, 1)
  const hook = pass as unknown as { _overrideVisibility: () => void }
  const base = hook._overrideVisibility.bind(pass)
  hook._overrideVisibility = () => {
    base()
    scene.traverse((o) => {
      if ((o as { isSprite?: boolean }).isSprite || o.userData.noAO) o.visible = false
    })
  }
  return pass
}

const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export function Effects() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)

  const composer = useMemo(() => {
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
    c.addPass(new OutputPass())
    return c
  }, [gl, scene, camera])

  useEffect(() => {
    composer.setPixelRatio(Math.min(dpr, touch ? 1.5 : 2))
    composer.setSize(size.width, size.height)
  }, [composer, size, dpr])

  useEffect(() => () => composer.dispose(), [composer])

  useFrame(() => composer.render(), 1)
  return null
}
