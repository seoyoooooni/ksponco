import { useEffect, useMemo, useRef } from 'react'
import { Mesh, PlaneGeometry, RingGeometry } from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import type { MatSpec, Terrain } from '../data/types'
import { heightAt } from '../lib/terrainSample'
import { drape, MAT_LIFT, useGinghamTexture } from './MyMat'

type Props = {
  position: { x: number; z: number }
  spec: MatSpec
  terrain: Terrain
  onTake: () => void
}

const INK = '#191f28'

export function SuggestMat({ position, spec, terrain, onTake }: Props) {
  const texture = useGinghamTexture('#f4f5f7', 'rgba(25, 31, 40, 0.72)')
  const pin = useRef<Mesh>(null)
  const { x, z } = position
  const ring = Math.max(spec.w, spec.d)

  useFrame(({ clock }) => {
    if (pin.current) pin.current.position.y = heightAt(terrain, x, z) + 3.4 + Math.sin(clock.elapsedTime * 3 + 1) * 0.3
  })

  const cloth = useMemo(() => drape(new PlaneGeometry(spec.w, spec.d, 18, 18), terrain, x, z, MAT_LIFT), [spec.w, spec.d, terrain, x, z])
  const hem = useMemo(() => drape(new PlaneGeometry(spec.w + 0.14, spec.d + 0.14, 18, 18), terrain, x, z, MAT_LIFT * 0.7), [spec.w, spec.d, terrain, x, z])
  const under = useMemo(() => drape(new PlaneGeometry(spec.w + 0.5, spec.d + 0.5, 18, 18), terrain, x, z, MAT_LIFT * 0.4), [spec.w, spec.d, terrain, x, z])
  const halo = useMemo(() => drape(new RingGeometry(ring * 0.85, ring * 1.25, 48, 2), terrain, x, z, MAT_LIFT + 0.03), [ring, terrain, x, z])
  useEffect(
    () => () => {
      cloth.dispose()
      hem.dispose()
      under.dispose()
      halo.dispose()
    },
    [cloth, hem, under, halo],
  )

  const take = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    document.body.style.cursor = ''
    onTake()
  }
  const hover = (on: boolean) => () => {
    document.body.style.cursor = on ? 'pointer' : ''
  }

  return (
    <>
      <mesh geometry={under} renderOrder={1} raycast={() => null} userData={{ noAO: true }}>
        <meshBasicMaterial color="#1f2a22" transparent opacity={0.16} depthWrite={false} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-2} />
      </mesh>
      <mesh geometry={hem} receiveShadow renderOrder={2} raycast={() => null}>
        <meshLambertMaterial color="#3a414b" polygonOffset polygonOffsetFactor={-1.5} polygonOffsetUnits={-3} />
      </mesh>
      <mesh geometry={cloth} receiveShadow renderOrder={3} onClick={take} onPointerOver={hover(true)} onPointerOut={hover(false)}>
        <meshLambertMaterial map={texture} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-4} />
      </mesh>
      <mesh geometry={halo} renderOrder={4} raycast={() => null} userData={{ noAO: true }}>
        <meshBasicMaterial color={INK} transparent opacity={0.9} depthWrite={false} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-6} />
      </mesh>
      <mesh ref={pin} position={[x, heightAt(terrain, x, z) + 3.4, z]} rotation-x={Math.PI} onClick={take} onPointerOver={hover(true)} onPointerOut={hover(false)}>
        <coneGeometry args={[1, 2.4, 14]} />
        <meshLambertMaterial color={INK} />
      </mesh>
    </>
  )
}
