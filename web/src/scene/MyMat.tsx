import { useEffect, useMemo, useRef, useState } from 'react'
import { BufferGeometry, CanvasTexture, Mesh, NearestFilter, PlaneGeometry, RepeatWrapping, RingGeometry, SRGBColorSpace, Vector2 } from 'three'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, Line } from '@react-three/drei'
import type { MatSpec, Terrain } from '../data/types'
import { heightAt } from '../lib/terrainSample'
import { terraceHeight } from '../lib/terrace'
import type { MatPosition } from '../store/sceneStore'
import { sceneColors } from './colors'

export function useGinghamTexture(base = '#fbf7ef', check = 'rgba(214, 72, 62, 0.72)') {
  return useMemo(() => {
    const size = 8
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = base
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = check
    ctx.fillRect(0, 0, size / 2, size)
    ctx.fillRect(0, 0, size, size / 2)
    const tex = new CanvasTexture(canvas)
    tex.magFilter = NearestFilter
    tex.colorSpace = SRGBColorSpace
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.repeat.set(3, 3)
    return tex
  }, [base, check])
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
export const MAT_LIFT = 0.1

const REACH = 0.22

function coverHeight(terrain: Terrain, x: number, z: number) {
  let y = -Infinity
  for (const dx of [-REACH, 0, REACH]) for (const dz of [-REACH, 0, REACH]) y = Math.max(y, heightAt(terrain, x + dx, z + dz))
  return y
}

function facing(terrain: Terrain, x: number, z: number) {
  const tr = terrain.terrace
  if (!tr || terraceHeight(tr, x, z) === null) return 0
  return Math.atan2(x - tr.x, z - tr.z)
}

export function drape(g: BufferGeometry, terrain: Terrain, x: number, z: number, lift: number) {
  g.rotateX(-Math.PI / 2)
  g.rotateY(facing(terrain, x, z))
  g.translate(x, 0, z)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) p.setY(i, coverHeight(terrain, p.getX(i), p.getZ(i)) + lift)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

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

  const cloth = useMemo(() => drape(new PlaneGeometry(spec.w, spec.d, 18, 18), terrain, pos.x, pos.z, MAT_LIFT), [spec.w, spec.d, terrain, pos.x, pos.z])
  const under = useMemo(
    () => drape(new PlaneGeometry(spec.w + 0.5, spec.d + 0.5, 18, 18), terrain, pos.x, pos.z, MAT_LIFT * 0.4),
    [spec.w, spec.d, terrain, pos.x, pos.z],
  )
  const hem = useMemo(
    () => drape(new PlaneGeometry(spec.w + 0.14, spec.d + 0.14, 18, 18), terrain, pos.x, pos.z, MAT_LIFT * 0.7),
    [spec.w, spec.d, terrain, pos.x, pos.z],
  )
  const halo = useMemo(
    () => drape(new RingGeometry(ring * 0.85, ring * 1.25, 48, 2), terrain, pos.x, pos.z, MAT_LIFT + 0.03),
    [ring, terrain, pos.x, pos.z],
  )
  useEffect(
    () => () => {
      cloth.dispose()
      hem.dispose()
      under.dispose()
      halo.dispose()
    },
    [cloth, hem, under, halo],
  )

  return (
    <>
      <mesh geometry={under} renderOrder={1} raycast={() => null} userData={{ noAO: true }}>
        <meshBasicMaterial color="#1f2a22" transparent opacity={0.16} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-2} />
      </mesh>
      <mesh geometry={hem} receiveShadow renderOrder={2} raycast={() => null}>
        <meshLambertMaterial color={sceneColors.matHem} polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-3} />
      </mesh>
      <mesh geometry={cloth} receiveShadow renderOrder={3} raycast={() => null}>
        <meshLambertMaterial map={texture} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-4} />
      </mesh>
      {showPin && (
        <mesh geometry={halo} renderOrder={4} raycast={() => null} userData={{ noAO: true }}>
          <meshBasicMaterial color={sceneColors.mark} transparent opacity={drag ? 1 : 0.9} depthWrite={false} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-6} />
        </mesh>
      )}
      <group position={[pos.x, g, pos.z]}>
        {showPin && (
          <mesh ref={pin} rotation-x={Math.PI} position-y={2.8}>
            <coneGeometry args={[1, 2.4, 14]} />
            <meshLambertMaterial color={sceneColors.mark} />
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
            userData={{ noAO: true }}
            onPointerDown={startDrag}
            onPointerOver={hover(true)}
            onPointerOut={hover(false)}
          >
            <cylinderGeometry args={[GRAB_RADIUS, GRAB_RADIUS, 3.4, 20]} />
            <meshBasicMaterial colorWrite={false} depthWrite={false} />
          </mesh>
        )}
      </group>
      {target && showPin && (
        <Line points={[eye, target]} color={sceneColors.ink} lineWidth={2} dashed dashSize={0.6} gapSize={0.9} userData={{ noAO: true }} />
      )}
    </>
  )
}
