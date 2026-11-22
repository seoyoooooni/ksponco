import { useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { Color, Fog, Object3D } from 'three'
import { sunPosition } from '../lib/sun'
import { useScene } from '../store/sceneStore'
import { sceneColors } from './colors'

type Props = {
  center: [number, number, number]
  radius: number
}

const DISTANCE = 300

export function SunLight({ center, radius }: Props) {
  const date = useScene((s) => s.date)
  const hour = useScene((s) => s.hour)
  const sun = useMemo(() => sunPosition(date, hour), [date, hour])
  const scene = useThree((s) => s.scene)

  const [cx, cy, cz] = center
  const target = useMemo(() => {
    const o = new Object3D()
    o.position.set(cx, cy, cz)
    return o
  }, [cx, cy, cz])

  const day = sun.altitude > 0
  const strength = day ? Math.min(1, sun.altitude / 25) : 0

  const sky = useMemo(
    () =>
      day
        ? new Color(sceneColors.skyDusk).lerp(new Color(sceneColors.sky), strength)
        : new Color(sceneColors.skyNight),
    [day, strength],
  )

  useEffect(() => {
    scene.background = sky
    if (scene.fog instanceof Fog) scene.fog.color.copy(sky)
  }, [scene, sky])

  const [dx, dy, dz] = sun.direction
  const up = Math.max(dy, 0.03)

  return (
    <>
      <primitive object={target} />
      <hemisphereLight args={[sceneColors.hemiSky, sceneColors.hemiGround, day ? 0.85 : 0.35]} />
      <directionalLight
        target={target}
        position={[cx + dx * DISTANCE, cy + up * DISTANCE, cz + dz * DISTANCE]}
        intensity={day ? 0.5 + 1.7 * strength : 0}
        color={sceneColors.sun}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      >
        <orthographicCamera attach="shadow-camera" args={[-radius, radius, radius, -radius, 1, 800]} />
      </directionalLight>
    </>
  )
}
