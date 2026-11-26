import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import type { Terrain } from '../data/types'
import { heightAt } from '../lib/terrainSample'

export type SpotMarker = {
  x: number
  z: number
  label: string
}

const SIZE = 0.05

function markerTexture(label: string): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const g = c.getContext('2d')!
  g.beginPath()
  g.arc(64, 64, 60, 0, Math.PI * 2)
  g.fillStyle = '#ffffff'
  g.fill()
  g.beginPath()
  g.arc(64, 64, 50, 0, Math.PI * 2)
  g.fillStyle = '#191f28'
  g.fill()
  g.fillStyle = '#ffffff'
  if (!label) {
    g.beginPath()
    g.arc(64, 64, 18, 0, Math.PI * 2)
    g.fill()
  } else {
    g.font = '700 58px "Pretendard Variable", Pretendard, sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(label, 64, 68)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

function useFontsReady(): boolean {
  const [ready, setReady] = useState(() => document.fonts?.status === 'loaded')
  useEffect(() => {
    if (ready || !document.fonts) return
    let alive = true
    document.fonts.ready.then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [ready])
  return ready
}

export function SpotMarkers({ markers, terrain }: { markers: SpotMarker[]; terrain: Terrain }) {
  const fonts = useFontsReady()
  const labels = markers.map((m) => m.label).join(',')
  const textures = useMemo(() => markers.map((m) => markerTexture(m.label)), [labels, fonts])
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures])

  return (
    <>
      {markers.map((m, i) => (
        <sprite key={i} position={[m.x, heightAt(terrain, m.x, m.z) + 2.5, m.z]} scale={[SIZE, SIZE, 1]} renderOrder={20} raycast={() => null}>
          <spriteMaterial map={textures[i]} sizeAttenuation={false} depthTest={false} depthWrite={false} transparent />
        </sprite>
      ))}
    </>
  )
}
