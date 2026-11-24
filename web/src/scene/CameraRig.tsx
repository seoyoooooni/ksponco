import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { PerspectiveCamera, Vector3 } from 'three'
import { useScene } from '../store/sceneStore'
import { useWide } from '../ui/useMediaQuery'

type Vec3 = [number, number, number]

type Props = {
  eye: Vec3 | null
  lookAt: Vec3 | null
  orbitTarget: Vec3
}

const FIRST_PERSON_FOV = 58
const ORBIT_HFOV = 34
const PANEL_SHIFT = (400 + 32) / 2

function orbitFov(aspect: number): number {
  const half = (ORBIT_HFOV / 2) * (Math.PI / 180)
  const v = (2 * Math.atan(Math.tan(half) / aspect) * 180) / Math.PI
  return Math.min(68, Math.max(50, v))
}

export function CameraRig({ eye, lookAt, orbitTarget }: Props) {
  const mode = useScene((s) => s.camera)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const wide = useWide()
  const sheetH = useScene((s) => s.sheetH)
  const saved = useRef<{ position: Vector3; fov: number } | null>(null)
  const view = mode === 'firstPerson' && eye && lookAt ? { eye, lookAt } : null
  const key = view ? `${view.eye.join(',')}|${view.lookAt.join(',')}` : 'orbit'

  useEffect(() => {
    if (view) {
      if (!saved.current) saved.current = { position: camera.position.clone(), fov: camera.fov }
      camera.position.set(view.eye[0], view.eye[1], view.eye[2])
      camera.fov = FIRST_PERSON_FOV
      camera.lookAt(view.lookAt[0], view.lookAt[1], view.lookAt[2])
      camera.updateProjectionMatrix()
    } else if (saved.current) {
      camera.position.copy(saved.current.position)
      camera.updateProjectionMatrix()
      saved.current = null
    }
  }, [key])

  useEffect(() => {
    if (view) {
      camera.clearViewOffset()
    } else {
      camera.fov = orbitFov(size.width / size.height)
      if (wide) camera.setViewOffset(size.width, size.height, PANEL_SHIFT, 0, size.width, size.height)
      else camera.setViewOffset(size.width, size.height, 0, Math.min(sheetH, size.height * 0.6) / 2, size.width, size.height)
    }
    camera.updateProjectionMatrix()
  }, [key, size.width, size.height, wide, sheetH])

  if (view) return null
  return (
    <OrbitControls
      makeDefault
      target={orbitTarget}
      maxPolarAngle={Math.PI * 0.47}
      minDistance={15}
      maxDistance={320}
      enableDamping
    />
  )
}
