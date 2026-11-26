import { useEffect, useMemo, useRef } from 'react'
import { CircleGeometry, ExtrudeGeometry, Group, RingGeometry, Shape } from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import type { Terrain } from '../data/types'
import { heightAt } from '../lib/terrainSample'
import { drape, MAT_LIFT } from './MyMat'
import { reducedMotion } from './sceneTime'

type Props = {
  position: { x: number; z: number }
  terrain: Terrain
  onTake: () => void
}

const STAR_GOLD = '#ffc531'
const HOVER = 3

function starGeometry() {
  const s = new Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 1 : 0.48
    const a = Math.PI / 2 + (i * Math.PI) / 5
    const px = Math.cos(a) * r
    const py = Math.sin(a) * r
    if (i === 0) s.moveTo(px, py)
    else s.lineTo(px, py)
  }
  s.closePath()
  const g = new ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.16, bevelSize: 0.14, bevelSegments: 4, curveSegments: 1 })
  g.center()
  g.computeVertexNormals()
  return g
}

export function SuggestStar({ position, terrain, onTake }: Props) {
  const { x, z } = position
  const y = heightAt(terrain, x, z)
  const star = useRef<Group>(null)
  const geometry = useMemo(starGeometry, [])
  const fill = useMemo(() => drape(new CircleGeometry(1.7, 40), terrain, x, z, MAT_LIFT * 0.5), [terrain, x, z])
  const ring = useMemo(() => drape(new RingGeometry(1.4, 1.8, 48, 1), terrain, x, z, MAT_LIFT), [terrain, x, z])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(
    () => () => {
      fill.dispose()
      ring.dispose()
    },
    [fill, ring],
  )

  useFrame(({ clock, camera }) => {
    const g = star.current
    if (!g) return
    const t = reducedMotion ? 0 : clock.elapsedTime
    const face = Math.atan2(camera.position.x - x, camera.position.z - z)
    g.rotation.set(-0.3, face + Math.sin(t * 1.6) * 0.55, Math.sin(t * 1.1) * 0.08, 'YXZ')
    g.position.y = y + HOVER + Math.sin(t * 2.4) * 0.22
  })

  const take = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = ''
    onTake()
  }
  const hover = (on: boolean) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = on ? 'pointer' : ''
  }

  return (
    <>
      <mesh geometry={fill} renderOrder={1} raycast={() => null} userData={{ noAO: true }}>
        <meshBasicMaterial color={STAR_GOLD} transparent opacity={0.28} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-2} />
      </mesh>
      <mesh geometry={ring} renderOrder={2} raycast={() => null} userData={{ noAO: true }}>
        <meshBasicMaterial color={STAR_GOLD} transparent opacity={0.95} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-4} />
      </mesh>
      <group ref={star} position={[x, y + HOVER, z]} scale={1.5}>
        <mesh geometry={geometry} onClick={take} onPointerOver={hover(true)} onPointerOut={hover(false)}>
          <meshStandardMaterial color={STAR_GOLD} emissive="#ff9d00" emissiveIntensity={0.28} roughness={0.38} metalness={0.15} />
        </mesh>
      </group>
    </>
  )
}
