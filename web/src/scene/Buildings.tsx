import { useMemo } from 'react'
import { ExtrudeGeometry, Shape } from 'three'
import type { Building } from '../data/types'
import { sceneColors } from './colors'

function BuildingMesh({ building }: { building: Building }) {
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

  const estimated = building.source === 'gis'

  return (
    <mesh geometry={geometry} position-y={building.base} castShadow receiveShadow>
      <meshLambertMaterial color={sceneColors.building} transparent={estimated} opacity={estimated ? 0.85 : 1} />
    </mesh>
  )
}

export function Buildings({ buildings }: { buildings: Building[] }) {
  return (
    <>
      {buildings.map((b, i) => (
        <BuildingMesh key={i} building={b} />
      ))}
    </>
  )
}
