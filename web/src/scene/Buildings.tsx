import { useMemo } from 'react'
import { ExtrudeGeometry, Shape } from 'three'
import type { Building, Terrain } from '../data/types'
import { discOf, inDisc } from '../lib/diorama'
import { sceneColors } from './colors'
import { SHADOW_ONLY } from './SunLight'

function BuildingMesh({ building, ghost = false }: { building: Building; ghost?: boolean }) {
  const geometry = useMemo(() => {
    const shape = new Shape()
    building.footprint.forEach(([x, z], i) => {
      if (i === 0) shape.moveTo(x, -z)
      else shape.lineTo(x, -z)
    })
    shape.closePath()
    const g = new ExtrudeGeometry(shape, { depth: building.height, bevelEnabled: false })
    g.rotateX(-Math.PI / 2)
    return g
  }, [building])

  if (ghost) {
    return (
      <mesh geometry={geometry} position-y={building.base} castShadow raycast={() => null} layers={SHADOW_ONLY} userData={{ noAO: true }}>
        <meshBasicMaterial />
      </mesh>
    )
  }

  const estimated = building.source === 'gis'

  return (
    <mesh geometry={geometry} position-y={building.base} castShadow receiveShadow>
      <meshLambertMaterial color={sceneColors.building} transparent={estimated} opacity={estimated ? 0.85 : 1} />
    </mesh>
  )
}

export function Buildings({ buildings, terrain }: { buildings: Building[]; terrain: Terrain }) {
  const { shown, beyond } = useMemo(() => {
    const disc = discOf(terrain)
    const shown: Building[] = []
    const beyond: Building[] = []
    for (const b of buildings) (b.footprint.every(([x, z]) => inDisc(disc, x, z, 2)) ? shown : beyond).push(b)
    return { shown, beyond }
  }, [buildings, terrain])

  return (
    <>
      {shown.map((b, i) => (
        <BuildingMesh key={`s${i}`} building={b} />
      ))}
      {beyond.map((b, i) => (
        <BuildingMesh key={`g${i}`} building={b} ghost />
      ))}
    </>
  )
}
