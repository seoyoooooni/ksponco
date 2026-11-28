import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Color, Fog, Object3D, OrthographicCamera } from 'three'
import { sunPosition } from '../lib/sun'
import { useScene } from '../store/sceneStore'
import { sceneColors } from './colors'
import { nightOf } from './night'
import { Rain, SkyClouds, SkyDome } from './SkyDome'
import { sceneWeather, skyTone, type WeatherInput } from './weather'

type Props = {
  center: [number, number, number]
  radius: number
  weather: WeatherInput | null
}

const DISTANCE = 300

export const SHADOW_ONLY = 1

export function SunLight({ center, radius, weather: input }: Props) {
  const date = useScene((s) => s.date)
  const hour = useScene((s) => s.hour)
  const sun = useMemo(() => sunPosition(date, hour), [date, hour])
  const weather = useMemo(() => sceneWeather(input, date, hour), [input, date, hour])
  const scene = useThree((s) => s.scene)
  const shadowCam = useRef<OrthographicCamera>(null)

  useLayoutEffect(() => {
    shadowCam.current?.layers.enable(SHADOW_ONLY)
  }, [])

  const [cx, cy, cz] = center
  const target = useMemo(() => {
    const o = new Object3D()
    o.position.set(cx, cy, cz)
    return o
  }, [cx, cy, cz])

  const day = sun.altitude > 0
  const strength = day ? Math.min(1, sun.altitude / 25) : 0
  const night = nightOf(sun.altitude)
  const tone = useMemo(() => skyTone(sun.altitude, weather), [sun.altitude, weather])

  const hemi = useMemo(
    () => ({
      sky: new Color(sceneColors.hemiSky).lerp(new Color('#e3e7ea'), weather.overcast * 0.7).lerp(new Color(sceneColors.hemiNightSky), night),
      ground: new Color(sceneColors.hemiGround).lerp(new Color(sceneColors.hemiNightGround), night),
    }),
    [night, weather.overcast],
  )

  const sunColor = useMemo(
    () => new Color(sceneColors.sun).lerp(new Color(sceneColors.sunLow), Math.min(1, Math.max(0, (10 - sun.altitude) / 10)) * (1 - weather.overcast * 0.7)),
    [sun.altitude, weather.overcast],
  )

  useEffect(() => {
    scene.background = null
    if (scene.fog instanceof Fog) scene.fog.color.copy(tone.horizon).lerp(tone.glow, tone.amount * 0.25)
  }, [scene, tone])

  const [dx, dy, dz] = sun.direction
  const up = Math.max(dy, 0.03)

  return (
    <>
      <SkyDome tone={tone} sun={sun.direction} />
      <SkyClouds tone={tone} sun={sun.direction} weather={weather} night={night} center={center} />
      <Rain amount={weather.rain} />
      <primitive object={target} />
      <hemisphereLight args={[hemi.sky, hemi.ground, 0.62 - night * 0.14 + weather.overcast * 0.24 * (1 - night)]} />
      <directionalLight
        target={target}
        position={[cx + dx * DISTANCE, cy + up * DISTANCE, cz + dz * DISTANCE]}
        intensity={day ? (0.6 + 2.3 * strength) * (1 - 0.72 * weather.overcast) : 0}
        color={sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      >
        <orthographicCamera ref={shadowCam} attach="shadow-camera" args={[-radius, radius, radius, -radius, 1, 800]} />
      </directionalLight>
    </>
  )
}
