import { useEffect, useMemo } from 'react'
import { CanvasTexture, LinearFilter, PlaneGeometry, SRGBColorSpace } from 'three'
import type { Terrain } from '../data/types'
import { heightAt } from '../lib/terrainSample'

export type OverlayCell = {
  x: number
  z: number
  size: number
  color: string
}

const LIFT = 0.15
const PX = 12
const PAD = 2
const STEP = 1

function smooth(a: number, e0: number, e1: number) {
  const t = Math.min(1, Math.max(0, (a - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

function paint(cells: OverlayCell[]) {
  const size = cells[0].size
  const xs = cells.map((c) => c.x)
  const zs = cells.map((c) => c.z)
  const x0 = Math.min(...xs) - size / 2 - PAD * size
  const z0 = Math.min(...zs) - size / 2 - PAD * size
  const nx = Math.round((Math.max(...xs) - Math.min(...xs)) / size) + 1 + PAD * 2
  const nz = Math.round((Math.max(...zs) - Math.min(...zs)) / size) + 1 + PAD * 2

  const base = document.createElement('canvas')
  base.width = nx * PX
  base.height = nz * PX
  const bctx = base.getContext('2d')!
  for (const c of cells) {
    const i = Math.round((c.x - size / 2 - x0) / size)
    const j = Math.round((c.z - size / 2 - z0) / size)
    bctx.fillStyle = c.color
    bctx.fillRect(i * PX, j * PX, PX, PX)
  }

  const canvas = document.createElement('canvas')
  canvas.width = base.width
  canvas.height = base.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.filter = `blur(${PX * 0.4}px)`
  ctx.drawImage(base, 0, 0)
  ctx.filter = 'none'

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let k = 3; k < d.length; k += 4) d[k] = Math.round(smooth(d[k] / 255, 0.46, 0.53) * 255)
  ctx.putImageData(img, 0, 0)

  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.magFilter = LinearFilter
  tex.minFilter = LinearFilter
  tex.generateMipmaps = false
  return { tex, x0, z0, w: nx * size, d: nz * size }
}

export function HeatOverlay({ cells, terrain, opacity = 0.9 }: { cells: OverlayCell[]; terrain: Terrain; opacity?: number }) {
  const layer = useMemo(() => {
    if (cells.length === 0) return null
    const { tex, x0, z0, w, d } = paint(cells)
    const g = new PlaneGeometry(w, d, Math.ceil(w / STEP), Math.ceil(d / STEP))
    g.rotateX(-Math.PI / 2)
    g.translate(x0 + w / 2, 0, z0 + d / 2)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(terrain, pos.getX(i), pos.getZ(i)) + LIFT)
    g.computeVertexNormals()
    g.computeBoundingSphere()
    return { tex, g }
  }, [cells, terrain])

  useEffect(
    () => () => {
      layer?.tex.dispose()
      layer?.g.dispose()
    },
    [layer],
  )

  if (!layer) return null
  return (
    <mesh geometry={layer.g} raycast={() => null} userData={{ noAO: true }}>
      <meshLambertMaterial map={layer.tex} transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
    </mesh>
  )
}
