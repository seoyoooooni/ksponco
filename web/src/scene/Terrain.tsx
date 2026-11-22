import { useMemo } from 'react'
import { Color, Float32BufferAttribute, PlaneGeometry } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { Layout, Terrain as TerrainData, ZoneType } from '../data/types'
import { zoneAt } from '../lib/polygon'
import { heightAt, sourceAt } from '../lib/terrainSample'
import { sceneColors } from './colors'

const zoneColor: Record<ZoneType, string> = {
  standing: sceneColors.standing,
  picnic: sceneColors.picnic,
  aisle: sceneColors.aisle,
  booth: sceneColors.booth,
  closed: sceneColors.closed,
}

type Props = {
  terrain: TerrainData
  layout: Layout | null
  onPick?: (x: number, z: number) => void
}

export function Terrain({ terrain, layout, onPick }: Props) {
  const geometry = useMemo(() => {
    const w = (terrain.nx - 1) * terrain.cell
    const d = (terrain.nz - 1) * terrain.cell
    const g = new PlaneGeometry(w, d, terrain.nx - 1, terrain.nz - 1)
    g.rotateX(-Math.PI / 2)
    g.translate(terrain.x0 + w / 2, 0, terrain.z0 + d / 2)
    const pos = g.attributes.position
    const colors: number[] = []
    const c = new Color()
    const edge = new Color(sceneColors.outerGrass)
    const xMax = terrain.x0 + w
    const zMax = terrain.z0 + d
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const onBorder =
        x <= terrain.x0 + 1e-6 || x >= xMax - 1e-6 || z <= terrain.z0 + 1e-6 || z >= zMax - 1e-6
      pos.setY(i, onBorder ? 0 : heightAt(terrain, x, z))
      const zone = layout ? zoneAt(layout.zones, x, z) : null
      c.set(zone ? zoneColor[zone.type] : sceneColors.lawn)
      if (sourceAt(terrain, x, z) === 1) c.lerp(edge, 0.55)
      colors.push(c.r, c.g, c.b)
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [terrain, layout])

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!onPick || e.delta > 6) return
    e.stopPropagation()
    onPick(e.point.x, e.point.z)
  }

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 40]} receiveShadow>
        <planeGeometry args={[1200, 1200]} />
        <meshLambertMaterial color={sceneColors.outerGrass} />
      </mesh>
      <mesh name="terrain" geometry={geometry} receiveShadow onClick={handleClick}>
        <meshLambertMaterial vertexColors />
      </mesh>
    </>
  )
}
