import { Html } from '@react-three/drei'
import type { Terrain } from '../data/types'
import { heightAt } from '../lib/terrainSample'

export type SpotMarker = {
  x: number
  z: number
  label: string
}

export function SpotMarkers({ markers, terrain }: { markers: SpotMarker[]; terrain: Terrain }) {
  return (
    <>
      {markers.map((m, i) => (
        <Html key={i} position={[m.x, heightAt(terrain, m.x, m.z) + 2.5, m.z]} center zIndexRange={[10, 0]}>
          <span className="spot-marker">{m.label}</span>
        </Html>
      ))}
    </>
  )
}
