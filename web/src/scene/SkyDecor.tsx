import { useEffect, useMemo, useRef } from 'react'
import { CanvasTexture, Color, DoubleSide, Group, RingGeometry, Sprite, SRGBColorSpace } from 'three'
import { useFrame } from '@react-three/fiber'
import type { Terrain } from '../data/types'
import { discOf } from '../lib/diorama'
import { rng } from '../lib/rng'
import { heightAt } from '../lib/terrainSample'
import { sunPosition } from '../lib/sun'
import { useScene } from '../store/sceneStore'
import { reducedMotion } from './sceneTime'
import { sceneColors } from './colors'

type Wisp = { x: number; y: number; z: number; w: number; h: number; o: number; phase: number }

const COLLAR = 14
const WISPS = 18
const SEA = 4
const EDGE_SAMPLES = 120

export function mistTexture(stops: [number, number][]) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  for (const [at, alpha] of stops) g.addColorStop(at, `rgba(255,255,255,${alpha})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  return tex
}

export function useMistTone() {
  const date = useScene((s) => s.date)
  const hour = useScene((s) => s.hour)
  return useMemo(() => {
    const alt = sunPosition(date, hour).altitude
    const k = alt > 0 ? Math.min(1, 0.45 + alt / 20) : 0
    return new Color(sceneColors.mistNight).lerp(new Color(sceneColors.mist), k)
  }, [date, hour])
}

export function SkyDecor({ terrain }: { terrain: Terrain }) {
  const disc = useMemo(() => discOf(terrain), [terrain])
  const tone = useMistTone()
  const rim = useMemo(() => {
    let lo = Infinity
    for (let i = 0; i < EDGE_SAMPLES; i++) {
      const a = (i / EDGE_SAMPLES) * Math.PI * 2
      lo = Math.min(lo, heightAt(terrain, disc.x + Math.cos(a) * disc.r, disc.z + Math.sin(a) * disc.r))
    }
    return lo
  }, [disc, terrain])

  const puff = useMemo(() => mistTexture([[0, 0.9], [0.35, 0.55], [0.7, 0.15], [1, 0]]), [])
  const seaTex = useMemo(() => mistTexture([[0, 0], [0.22, 0], [0.3, 0.85], [0.55, 0.45], [1, 0]]), [])
  const sea = useMemo(() => new RingGeometry(disc.r * 0.9, disc.r * SEA, 128, 1).rotateX(-Math.PI / 2), [disc])
  useEffect(() => () => puff.dispose(), [puff])
  useEffect(() => () => seaTex.dispose(), [seaTex])
  useEffect(() => () => sea.dispose(), [sea])

  const wisps = useMemo(() => {
    const r = rng(41)
    const out: Wisp[] = []
    for (let i = 0; i < COLLAR; i++) {
      const a = (i / COLLAR) * Math.PI * 2 + r() * 0.3
      const d = disc.r * (0.98 + r() * 0.14)
      const w = 45 + r() * 35
      out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: rim - 8 - r() * 10, w, h: w * 0.28, o: 0.45 + r() * 0.3, phase: r() * 6 })
    }
    for (let i = 0; i < WISPS; i++) {
      const a = (i / WISPS) * Math.PI * 2 + r() * 0.4
      const d = disc.r * (0.8 + r() * 1.2)
      const w = 70 + r() * 70
      out.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: rim - 45 - r() * 45, w, h: w * (0.32 + r() * 0.12), o: 0.3 + r() * 0.45, phase: r() * 6 })
    }
    return out
  }, [disc, rim])

  const drift = useRef<Group>(null)
  const wispRefs = useRef<(Sprite | null)[]>([])

  useFrame(({ clock }, dt) => {
    if (reducedMotion) return
    const t = clock.elapsedTime
    if (drift.current) drift.current.rotation.y += Math.min(dt, 0.1) * 0.008
    wisps.forEach((w, i) => {
      const sp = wispRefs.current[i]
      if (!sp) return
      sp.position.y = w.y + Math.sin(t * 0.2 + w.phase) * 1.5
      sp.material.opacity = w.o * (0.8 + 0.2 * Math.sin(t * 0.3 + w.phase))
    })
  })

  return (
    <group position={[disc.x, 0, disc.z]}>
      <mesh geometry={sea} position-y={rim - 80} renderOrder={-1} raycast={() => null} userData={{ noAO: true }}>
        <meshBasicMaterial color={tone} map={seaTex} transparent opacity={0.45} depthWrite={false} side={DoubleSide} />
      </mesh>
      <group ref={drift}>
        {wisps.map((w, i) => (
          <sprite key={i} ref={(sp) => { wispRefs.current[i] = sp }} position={[w.x, w.y, w.z]} scale={[w.w, w.h, 1]} raycast={() => null}>
            <spriteMaterial color={tone} map={puff} transparent opacity={w.o} depthWrite={false} />
          </sprite>
        ))}
      </group>
    </group>
  )
}
