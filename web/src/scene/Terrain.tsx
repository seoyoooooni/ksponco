import { useMemo } from 'react'
import { Color, Float32BufferAttribute, PlaneGeometry } from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { Layout, Terrain as TerrainData, ZoneType } from '../data/types'
import { zoneAt } from '../lib/polygon'
import { heightAt } from '../lib/terrainSample'
import { sceneColors } from './colors'

const zoneColor: Record<ZoneType, string> = {
  standing: sceneColors.standing,
  picnic: sceneColors.picnic,
  aisle: sceneColors.aisle,
  booth: sceneColors.booth,
  closed: sceneColors.closed,
}

const PATH_W = 3.5
const FADE = 28

function edgeDistance(t: TerrainData): Float32Array {
  const { nx, nz } = t
  const d = new Float32Array(nx * nz)
  for (let k = 0; k < d.length; k++) d[k] = t.src[k] === 0 ? 0 : 1e9
  const D = Math.SQRT2
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i
      if (i > 0) d[k] = Math.min(d[k], d[k - 1] + 1)
      if (j > 0) {
        d[k] = Math.min(d[k], d[k - nx] + 1)
        if (i > 0) d[k] = Math.min(d[k], d[k - nx - 1] + D)
        if (i < nx - 1) d[k] = Math.min(d[k], d[k - nx + 1] + D)
      }
    }
  }
  for (let j = nz - 1; j >= 0; j--) {
    for (let i = nx - 1; i >= 0; i--) {
      const k = j * nx + i
      if (i < nx - 1) d[k] = Math.min(d[k], d[k + 1] + 1)
      if (j < nz - 1) {
        d[k] = Math.min(d[k], d[k + nx] + 1)
        if (i < nx - 1) d[k] = Math.min(d[k], d[k + nx + 1] + D)
        if (i > 0) d[k] = Math.min(d[k], d[k + nx - 1] + D)
      }
    }
  }
  for (let k = 0; k < d.length; k++) d[k] *= t.cell
  return d
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
    const outer = new Color(sceneColors.outerGrass)
    const park = new Color(sceneColors.parkGrass)
    const path = new Color(sceneColors.path)
    const dist = edgeDistance(terrain)
    const xMax = terrain.x0 + w
    const zMax = terrain.z0 + d
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const onBorder =
        x <= terrain.x0 + 1e-6 || x >= xMax - 1e-6 || z <= terrain.z0 + 1e-6 || z >= zMax - 1e-6
      pos.setY(i, onBorder ? 0 : heightAt(terrain, x, z))
      const zone = layout ? zoneAt(layout.zones, x, z) : null
      const gi = Math.min(terrain.nx - 1, Math.max(0, Math.round((x - terrain.x0) / terrain.cell)))
      const gj = Math.min(terrain.nz - 1, Math.max(0, Math.round((z - terrain.z0) / terrain.cell)))
      const e = dist[gj * terrain.nx + gi]
      if (zone) c.set(zoneColor[zone.type])
      else if (e === 0) c.set(sceneColors.lawn)
      else if (e <= PATH_W) c.copy(path)
      else c.copy(park).lerp(outer, Math.min(1, (e - PATH_W) / FADE))
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
