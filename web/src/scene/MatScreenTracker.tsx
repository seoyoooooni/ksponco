import { useMemo } from 'react'
import { Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import type { Terrain } from '../data/types'
import { heightAt } from '../lib/terrainSample'
import type { MatPosition } from '../store/sceneStore'
import { matScreen } from './matScreen'

type Props = {
  mat: MatPosition | null
  terrain: Terrain
}

export function MatScreenTracker({ mat, terrain }: Props) {
  const v = useMemo(() => new Vector3(), [])
  useFrame(({ camera, gl }) => {
    if (!mat) {
      matScreen.ok = false
      return
    }
    const h = heightAt(terrain, mat.x, mat.z)
    const rect = gl.domElement.getBoundingClientRect()
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    let ok = true
    const pts: [number, number, number][] = [
      [-1.3, 0, -1.3],
      [1.3, 0, -1.3],
      [-1.3, 0, 1.3],
      [1.3, 0, 1.3],
      [0, 4.8, 0],
    ]
    for (const [dx, dy, dz] of pts) {
      v.set(mat.x + dx, h + dy, mat.z + dz).project(camera)
      if (v.z > 1) ok = false
      const sx = rect.left + ((v.x + 1) / 2) * rect.width
      const sy = rect.top + ((1 - v.y) / 2) * rect.height
      x0 = Math.min(x0, sx)
      y0 = Math.min(y0, sy)
      x1 = Math.max(x1, sx)
      y1 = Math.max(y1, sy)
    }
    matScreen.x = x0
    matScreen.y = y0
    matScreen.w = x1 - x0
    matScreen.h = y1 - y0
    matScreen.ok = ok
  })
  return null
}
