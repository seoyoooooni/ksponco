import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Fog, PerspectiveCamera, Spherical, TOUCH, Vector3 } from 'three'
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
const PAN_LIMIT = 90
const MAP_TOUCHES = { ONE: TOUCH.PAN, TWO: -1 as unknown as TOUCH }
const ORBIT_TOUCHES = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }

type Controls = { target: Vector3; object: { position: Vector3 } }

const MIN_DIST = 15
const MAX_DIST = 320
const MIN_POLAR = 0.12
const MAX_POLAR = Math.PI * 0.47
const TILT_SPEED = 1.4

function TwoFingerMap() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as unknown as (Controls & { enabled: boolean; update: () => void }) | null
  const pts = useRef(new Map<number, { x: number; y: number }>())
  const last = useRef<{ d: number; a: number; y0: number; y1: number } | null>(null)
  const sph = useMemo(() => new Spherical(), [])
  const off = useMemo(() => new Vector3(), [])

  useEffect(() => {
    const el = gl.domElement
    const map = pts.current
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      map.set(e.pointerId, { x: e.clientX, y: e.clientY })
      last.current = null
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || !map.has(e.pointerId)) return
      map.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    const up = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return
      map.delete(e.pointerId)
      last.current = null
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      map.clear()
    }
  }, [gl])

  useFrame(() => {
    const map = pts.current
    if (map.size !== 2 || !controls || !controls.enabled) {
      last.current = null
      return
    }
    const [p, q] = [...map.values()]
    const now = { d: Math.hypot(q.x - p.x, q.y - p.y), a: Math.atan2(q.y - p.y, q.x - p.x), y0: p.y, y1: q.y }
    const prev = last.current
    last.current = now
    if (!prev) return
    const t = controls.target
    off.copy(camera.position).sub(t)
    sph.setFromVector3(off)
    if (now.d > 0 && prev.d > 0) sph.radius = Math.min(MAX_DIST, Math.max(MIN_DIST, (sph.radius * prev.d) / now.d))
    let da = now.a - prev.a
    if (da > Math.PI) da -= 2 * Math.PI
    if (da < -Math.PI) da += 2 * Math.PI
    sph.theta += da
    const dy0 = now.y0 - prev.y0
    const dy1 = now.y1 - prev.y1
    if (dy0 !== 0 && Math.sign(dy0) === Math.sign(dy1)) {
      const dy = Math.sign(dy0) * Math.min(Math.abs(dy0), Math.abs(dy1))
      sph.phi = Math.min(MAX_POLAR, Math.max(MIN_POLAR, sph.phi - (dy / gl.domElement.clientHeight) * TILT_SPEED))
    }
    off.setFromSpherical(sph)
    camera.position.copy(t).add(off)
    camera.lookAt(t)
    controls.update()
  })

  return null
}

const FLIGHT = 3.6

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function IntroFlight({ target, home }: { target: Vec3; home: Vec3 }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const controls = useThree((s) => s.controls) as unknown as (Controls & { enabled: boolean; update: () => void }) | null
  const ready = useScene((s) => s.sceneReady)
  const intro = useScene((s) => s.intro)
  const latest = useRef({ target, home })
  latest.current = { target, home }
  const run = useRef<{ t: number; from: Spherical; drop: number; fog: [number, number] | null } | null>(null)
  const sph = useMemo(() => new Spherical(), [])
  const end = useMemo(() => new Spherical(), [])
  const off = useMemo(() => new Vector3(), [])
  const look = useMemo(() => new Vector3(), [])

  const finish = () => {
    const r = run.current
    run.current = null
    const fog = scene.fog
    if (r?.fog && fog instanceof Fog) {
      fog.near = r.fog[0]
      fog.far = r.fog[1]
    }
    const { target: t, home: h } = latest.current
    camera.position.set(h[0], h[1], h[2])
    camera.lookAt(t[0], t[1], t[2])
    if (controls) {
      controls.target.set(t[0], t[1], t[2])
      controls.enabled = true
      controls.update()
    }
    sceneStore.set({ intro: false })
  }

  useEffect(() => {
    if (!intro || !ready || !controls || run.current) return
    const { target: t, home: h } = latest.current
    end.setFromVector3(off.set(h[0] - t[0], h[1] - t[1], h[2] - t[2]))
    const from = new Spherical(Math.max(end.radius * 2.8, 470), Math.min(1.3, end.phi + 0.5), end.theta + 1.15)
    const fog = scene.fog instanceof Fog ? ([scene.fog.near, scene.fog.far] as [number, number]) : null
    run.current = { t: 0, from, drop: 55, fog }
    controls.enabled = false
    const el = gl.domElement
    const skip = () => {
      if (run.current) finish()
    }
    el.addEventListener('pointerdown', skip)
    el.addEventListener('wheel', skip, { passive: true })
    return () => {
      el.removeEventListener('pointerdown', skip)
      el.removeEventListener('wheel', skip)
      if (run.current) finish()
    }
  }, [intro, ready, controls])

  useFrame((_, dt) => {
    const r = run.current
    if (!r) return
    r.t = Math.min(1, r.t + Math.min(dt, 0.1) / FLIGHT)
    const e = ease(r.t)
    const { target: t, home: h } = latest.current
    end.setFromVector3(off.set(h[0] - t[0], h[1] - t[1], h[2] - t[2]))
    sph.radius = Math.exp(Math.log(r.from.radius) + (Math.log(end.radius) - Math.log(r.from.radius)) * e)
    sph.phi = r.from.phi + (end.phi - r.from.phi) * e
    sph.theta = r.from.theta + (end.theta - r.from.theta) * e
    look.set(t[0], t[1] - r.drop * (1 - e), t[2])
    camera.position.copy(look).add(off.setFromSpherical(sph))
    camera.lookAt(look)
    const fog = scene.fog
    if (r.fog && fog instanceof Fog) {
      const extra = Math.max(0, sph.radius - 200)
      fog.near = r.fog[0] + extra
      fog.far = r.fog[1] + extra * 1.6
    }
    if (r.t >= 1) finish()
  })

  return null
}

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

  const coarse = useMemo(() => window.matchMedia('(pointer: coarse)').matches, [])

  const keepNear = (e?: { target: unknown }) => {
    const c = e?.target as Controls | undefined
    if (!c) return
    const t = c.target
    const dx = t.x - orbitTarget[0]
    const dz = t.z - orbitTarget[2]
    const d = Math.hypot(dx, dz)
    if (d <= PAN_LIMIT) return
    const k = PAN_LIMIT / d
    const nx = orbitTarget[0] + dx * k
    const nz = orbitTarget[2] + dz * k
    c.object.position.x += nx - t.x
    c.object.position.z += nz - t.z
    t.x = nx
    t.z = nz
  }

  if (view) return <FirstPersonLook eye={view.eye} lookAt={view.lookAt} />
  return (
    <>
      {coarse && <TwoFingerMap />}
      <OrbitControls
        makeDefault
        target={orbitTarget}
        touches={coarse ? MAP_TOUCHES : ORBIT_TOUCHES}
        screenSpacePanning={!coarse}
        onChange={keepNear}
        maxPolarAngle={MAX_POLAR}
        minDistance={MIN_DIST}
        maxDistance={MAX_DIST}
        enableDamping
      />
      <IntroFlight target={orbitTarget} home={home} />
    </>
  )
}
