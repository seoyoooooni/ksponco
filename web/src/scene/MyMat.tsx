import { useMemo, useRef, useState } from 'react'
import { CanvasTexture, Mesh, NearestFilter, RepeatWrapping, SRGBColorSpace, Vector2 } from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import type { MatSpec, Terrain } from '../data/types'
import { heightAt, slopeAt } from '../lib/terrainSample'
import type { MatPosition } from '../store/sceneStore'
import { sceneColors } from './colors'

function useGinghamTexture() {
  return useMemo(() => {
    const size = 8
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = 'rgba(226, 87, 76, 0.6)'
    ctx.fillRect(0, 0, size / 2, size)
    ctx.fillRect(0, 0, size, size / 2)
    const tex = new CanvasTexture(canvas)
    tex.magFilter = NearestFilter
    tex.colorSpace = SRGBColorSpace
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.repeat.set(3, 3)
    return tex
  }, [])
}

type Props = {
  position: MatPosition
  spec: MatSpec
  terrain: Terrain
  eyeHeight: number
  target: [number, number, number] | null
  showPin: boolean
  bubble?: string | null
  canPlace: (x: number, z: number) => boolean
  onMove: (p: MatPosition) => void
}

const GRAB_RADIUS = 3.5

export function MyMat({ position, spec, terrain, eyeHeight, target, showPin, bubble, canPlace, onMove }: Props) {
  const texture = useGinghamTexture()
  const pin = useRef<Mesh>(null)
  const [drag, setDrag] = useState<MatPosition | null>(null)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const raycaster = useThree((s) => s.raycaster)
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null

  const pos = drag ?? position
  const g = heightAt(terrain, pos.x, pos.z)
  const s = slopeAt(terrain, pos.x, pos.z)

  useFrame(({ clock }) => {
    if (pin.current) pin.current.position.y = (drag ? 4.4 : 3.4) + Math.sin(clock.elapsedTime * 3) * 0.3
  })

  const startDrag = (e: ThreeEvent<PointerEvent>) => {
    if (!showPin) return
    e.stopPropagation()
    const ground = scene.getObjectByName('terrain')
    if (!ground) return
    if (controls) controls.enabled = false
    document.body.style.cursor = 'grabbing'
    const ndc = new Vector2()
    let last = position
    setDrag(position)

    const move = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObject(ground, false)[0]
      if (!hit || !canPlace(hit.point.x, hit.point.z)) return
      last = { x: hit.point.x, z: hit.point.z }
      setDrag(last)
    }

    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      if (controls) controls.enabled = true
      document.body.style.cursor = ''
      setDrag(null)
      onMove(last)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const hover = (on: boolean) => () => {
    if (!drag && showPin) document.body.style.cursor = on ? 'grab' : ''
  }

  const eye: [number, number, number] = [pos.x, g + eyeHeight, pos.z]
  const ring = Math.max(spec.w, spec.d)

  return (
    <>
      <group position={[pos.x, g + 0.03, pos.z]} rotation={[-Math.atan(s.dz), 0, Math.atan(s.dx)]}>
        <mesh receiveShadow>
          <boxGeometry args={[spec.w, 0.06, spec.d]} />
          <meshLambertMaterial map={texture} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
          <ringGeometry args={[ring * 0.9, ring * 1.05, 40]} />
          <meshBasicMaterial color={sceneColors.ink} transparent opacity={drag ? 0.9 : 0.55} />
        </mesh>
        {showPin && (
          <mesh ref={pin} rotation-x={Math.PI} position-y={2.8}>
            <coneGeometry args={[0.8, 2, 14]} />
            <meshLambertMaterial color={sceneColors.ink} />
          </mesh>
        )}
        {bubble && !drag && (
          <Html position={[0, 4.2, 0]} zIndexRange={[10, 0]}>
            <div className="bubble">{bubble}</div>
          </Html>
        )}
        {showPin && (
          <mesh
            position-y={1.6}
            onPointerDown={startDrag}
            onPointerOver={hover(true)}
            onPointerOut={hover(false)}
          >
            <cylinderGeometry args={[GRAB_RADIUS, GRAB_RADIUS, 3.4, 20]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        )}
      </group>
      {target && showPin && (
        <Line points={[eye, target]} color={sceneColors.ink} lineWidth={2} dashed dashSize={0.6} gapSize={0.9} />
      )}
    </>
  )
}
