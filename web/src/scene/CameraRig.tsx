import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { PerspectiveCamera, Vector3 } from 'three'
import { sceneStore, useScene } from '../store/sceneStore'
import { useWide } from '../ui/useMediaQuery'

type Vec3 = [number, number, number]

type Props = {
  eye: Vec3 | null
  lookAt: Vec3 | null
  orbitTarget: Vec3
  home: Vec3
}

const FIRST_PERSON_FOV = 58
const ORBIT_HFOV = 34
const PANEL_SHIFT = (400 + 32) / 2

function uiZoom(): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom'))
  return Number.isFinite(v) && v > 0 ? v : 1
}
const MAX_PITCH = Math.PI / 6
const AWAY = Math.PI / 4
const TAU = Math.PI * 2

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

function FirstPersonLook({ eye, lookAt }: { eye: Vec3; lookAt: Vec3 }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const recenter = useScene((s) => s.fpRecenter)
  const look = useRef({ yaw: 0, pitch: 0, ty: 0, tp: 0, away: false })
  const spot = `${eye[0]},${eye[2]}`
  const base = useMemo(() => {
    const dx = lookAt[0] - eye[0]
    const dy = lookAt[1] - eye[1]
    const dz = lookAt[2] - eye[2]
    return { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }
  }, [eye, lookAt])

  useEffect(() => {
    look.current = { yaw: 0, pitch: 0, ty: 0, tp: 0, away: false }
    sceneStore.set({ fpAway: false })
    return () => sceneStore.set({ fpAway: false })
  }, [spot])

  useEffect(() => {
    if (!recenter) return
    const l = look.current
    l.ty = Math.round(l.ty / TAU) * TAU
    l.tp = 0
  }, [recenter])

  useEffect(() => {
    const el = gl.domElement
    const prevTouch = el.style.touchAction
    const prevCursor = el.style.cursor
    let drag: { id: number; x: number; y: number } | null = null
    el.style.touchAction = 'none'
    el.style.cursor = 'grab'
    const down = (e: PointerEvent) => {
      if (drag) return
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
      el.setPointerCapture(e.pointerId)
      el.style.cursor = 'grabbing'
    }
    const move = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      const k = (camera.fov * Math.PI) / 180 / el.clientHeight
      const l = look.current
      l.ty += (e.clientX - drag.x) * k
      l.tp = clamp(l.tp + (e.clientY - drag.y) * k, -MAX_PITCH - base.pitch, MAX_PITCH - base.pitch)
      drag.x = e.clientX
      drag.y = e.clientY
    }
    const up = (e: PointerEvent) => {
      if (!drag || e.pointerId !== drag.id) return
      drag = null
      el.style.cursor = 'grab'
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.style.touchAction = prevTouch
      el.style.cursor = prevCursor
    }
  }, [gl, camera, base])

  useFrame((_, dt) => {
    const l = look.current
    const a = 1 - Math.exp(-dt * 14)
    l.yaw += (l.ty - l.yaw) * a
    l.pitch += (l.tp - l.pitch) * a
    const y = base.yaw + l.yaw
    const p = clamp(base.pitch + l.pitch, -MAX_PITCH, MAX_PITCH)
    camera.lookAt(eye[0] + Math.cos(p) * Math.sin(y), eye[1] + Math.sin(p), eye[2] + Math.cos(p) * Math.cos(y))
    const away = Math.abs(wrap(l.ty)) > AWAY
    if (away !== l.away) {
      l.away = away
      sceneStore.set({ fpAway: away })
    }
  })

  return null
}

function orbitFov(aspect: number): number {
  const half = (ORBIT_HFOV / 2) * (Math.PI / 180)
  const v = (2 * Math.atan(Math.tan(half) / aspect) * 180) / Math.PI
  return Math.min(68, Math.max(50, v))
}

export function CameraRig({ eye, lookAt, orbitTarget, home }: Props) {
  const mode = useScene((s) => s.camera)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const wide = useWide()
  const sheetH = useScene((s) => s.sheetH)
  const saved = useRef<{ position: Vector3; fov: number } | null>(null)
  const view = mode === 'firstPerson' && eye && lookAt ? { eye, lookAt } : null
  const key = view ? `${view.eye.join(',')}|${view.lookAt.join(',')}` : 'orbit'

  const homeKey = home.join(',')
  useEffect(() => {
    if (view) return
    camera.position.set(home[0], home[1], home[2])
    camera.updateProjectionMatrix()
  }, [homeKey])

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
      if (wide) camera.setViewOffset(size.width, size.height, PANEL_SHIFT * uiZoom(), 0, size.width, size.height)
      else camera.setViewOffset(size.width, size.height, 0, Math.min(sheetH, size.height * 0.6) / 2, size.width, size.height)
    }
    camera.updateProjectionMatrix()
  }, [key, size.width, size.height, wide, sheetH])

  if (view) return <FirstPersonLook eye={view.eye} lookAt={view.lookAt} />
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
