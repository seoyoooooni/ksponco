import { useCallback, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { VenueBundle } from '../data/load'
import type { Layout } from '../data/types'
import type { Crowd as CrowdData } from '../lib/crowd'
import { bounds, zoneAt } from '../lib/polygon'
import { heightAt, sourceAt } from '../lib/terrainSample'
import { offLimits } from '../lib/offLimits'
import { sceneStore, useScene } from '../store/sceneStore'
import { Buildings } from './Buildings'
import { CameraRig } from './CameraRig'
import { sceneColors } from './colors'
import { Crowd } from './Crowd'
import { HeatOverlay, type OverlayCell } from './HeatOverlay'
import { MyMat } from './MyMat'
import { PerformerMesh, ScreenMesh, StageMesh } from './Stage'
import { SpotMarkers, type SpotMarker } from './SpotMarkers'
import { SunLight } from './SunLight'
import { Terrain } from './Terrain'
import { Trees } from './Trees'
import { Water } from './Water'
import { Paths } from './Paths'
import { Effects } from './Effects'
import { Tents } from './Tents'
import type { ClosedArea, Tent } from '../lib/operator'
import type { Vec2 } from '../data/types'

type Props = {
  bundle: VenueBundle
  layout: Layout | null
  crowd: CrowdData | null
  overlay: OverlayCell[] | null
  bubble: string | null
  markers?: SpotMarker[]
  overlayOverride?: OverlayCell[]
  ponds?: OverlayCell[] | null
  operator?: {
    tents: Tent[]
    palms: ClosedArea[]
    suggestion: { x: number; z: number } | null
    zoneStart: Vec2 | null
    onPick: (x: number, z: number) => void
    onTent?: (id: number) => void
  }
}

const BLOCKED: Record<string, string> = {
  standing: '스탠딩 구역에는 돗자리를 펼 수 없어요',
  aisle: '통로에는 돗자리를 펼 수 없어요',
  booth: '부스 자리에는 돗자리를 펼 수 없어요',
  closed: '들어갈 수 없는 구역이에요',
}

const DEFAULT_MAT = { w: 1.8, d: 1.8, people: 2 }

export function SceneCanvas({ bundle, layout, crowd, overlay: baseOverlay, bubble, markers, operator, overlayOverride, ponds }: Props) {
  const overlay = overlayOverride ?? baseOverlay
  const painted = !overlayOverride && ponds?.length ? [...(overlay ?? []), ...ponds] : overlay
  const { venue, terrain, trees, buildings } = bundle
  const mat = useScene((s) => s.mat)
  const eyeHeight = useScene((s) => s.eyeHeight)
  const camera = useScene((s) => s.camera)
  const crowdScale = useScene((s) => s.crowdScale)
  const personStyle = useScene((s) => s.personStyle)

  const stage = layout?.stage ?? venue.fixedStage ?? null

  const center = useMemo<[number, number, number]>(() => {
    const cx = terrain.x0 + ((terrain.nx - 1) * terrain.cell) / 2
    const cz = terrain.z0 + ((terrain.nz - 1) * terrain.cell) / 2
    return [cx, 0, cz]
  }, [terrain])

  const radius = Math.max(terrain.nx, terrain.nz) * terrain.cell * 0.62

  const fitKey = `${venue.id}|${layout?.id ?? ''}`
  const fit = useRef<{ key: string; pts: Vec2[] } | null>(null)
  if (markers?.length && fit.current?.key !== fitKey) fit.current = { key: fitKey, pts: markers.map((m) => [m.x, m.z] as Vec2) }
  const fitPts = fit.current?.key === fitKey ? fit.current.pts : null

  const home = useMemo(() => {
    const seats = layout?.zones.filter((z) => z.type === 'picnic' || z.type === 'standing') ?? []
    const a = stage ? (stage.azimuth * Math.PI) / 180 : 0
    const fx = Math.sin(a)
    const fz = -Math.cos(a)
    const side = 0.35
    if (stage && seats.length) {
      const bs = seats.map((z) => bounds(z.poly))
      const ax = (Math.min(...bs.map((b) => b.x0)) + Math.max(...bs.map((b) => b.x1))) / 2
      const az = (Math.min(...bs.map((b) => b.z0)) + Math.max(...bs.map((b) => b.z1))) / 2
      const tx = stage.x * 0.4 + ax * 0.6
      const tz = stage.z * 0.4 + az * 0.6
      const dx = fx * Math.cos(side) - fz * Math.sin(side)
      const dz = fz * Math.cos(side) + fx * Math.sin(side)
      const target: [number, number, number] = [tx, heightAt(terrain, tx, tz), tz]
      const position: [number, number, number] = [tx + dx * 72, target[1] + 82, tz + dz * 72]
      return { target, position }
    }
    const pts: Vec2[] = [...(fitPts ?? [])]
    if (stage) pts.push([stage.x, stage.z])
    if (!pts.length) return { target: center, position: [center[0] + 62, 105, center[2] + 128] as [number, number, number] }
    const xs = pts.map((p) => p[0])
    const zs = pts.map((p) => p[1])
    const x0 = Math.min(...xs)
    const x1 = Math.max(...xs)
    const z0 = Math.min(...zs)
    const z1 = Math.max(...zs)
    const tx = (x0 + x1) / 2
    const tz = (z0 + z1) / 2
    const extent = Math.max(x1 - x0, z1 - z0, 40)
    const reach = Math.min(150, extent * 0.95 + 24)
    let dx = 62 / Math.hypot(62, 128)
    let dz = 128 / Math.hypot(62, 128)
    if (stage) {
      dx = fx * Math.cos(side) - fz * Math.sin(side)
      dz = fz * Math.cos(side) + fx * Math.sin(side)
    }
    const target: [number, number, number] = [tx, heightAt(terrain, tx, tz), tz]
    const position: [number, number, number] = [tx + dx * reach, target[1] + reach * 1.15, tz + dz * reach]
    return { target, position }
  }, [stage, layout, center, terrain, fitPts])

  const performerTarget = useMemo<[number, number, number] | null>(() => {
    if (!layout?.performer || !stage) return null
    const floor = heightAt(terrain, stage.x, stage.z) + stage.deckH
    return [layout.performer.x, floor + layout.performer.h * 0.85, layout.performer.z]
  }, [layout, stage, terrain])

  const lookAt = useMemo<[number, number, number] | null>(() => {
    if (performerTarget) return performerTarget
    if (!mat) return null
    if (stage) return [stage.x, heightAt(terrain, stage.x, stage.z) + stage.deckH + 2, stage.z]
    const far = Math.hypot(mat.x - center[0], mat.z - center[2]) > 10
    const tz = far ? center[2] : center[2] - 30
    return [center[0], heightAt(terrain, center[0], tz) + 1.5, tz]
  }, [performerTarget, mat, center, terrain, stage])

  const eye = useMemo<[number, number, number] | null>(
    () => (mat ? [mat.x, heightAt(terrain, mat.x, mat.z) + eyeHeight, mat.z] : null),
    [mat, eyeHeight, terrain],
  )

  const reason = useCallback(
    (x: number, z: number): string | null => {
      const off = offLimits(venue, x, z)
      if (off) return off
      if (!layout) return sourceAt(terrain, x, z) === 0 ? null : '잔디 안을 눌러 주세요'
      const zone = zoneAt(layout.zones, x, z)
      if (!zone) return '피크닉존 안을 눌러 주세요'
      if (zone.type !== 'picnic') return BLOCKED[zone.type]
      return null
    },
    [layout, terrain, venue],
  )

  const canPlace = useCallback((x: number, z: number) => reason(x, z) === null, [reason])

  const handleMove = useCallback(
    (p: { x: number; z: number }) => sceneStore.set({ mat: p, matTouched: true, notice: null }),
    [],
  )

  const handlePick = useCallback(
    (x: number, z: number) => {
      const why = reason(x, z)
      if (why) sceneStore.set({ notice: why })
      else sceneStore.set({ mat: { x, z }, matTouched: true, notice: null })
    },
    [reason],
  )

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 2]}
      camera={{ position: [center[0] + 62, 105, center[2] + 128], fov: 44, near: 0.3, far: 1500 }}
      className="scene"
      style={{ position: 'fixed', touchAction: 'none' }}
    >
      <fog attach="fog" args={[sceneColors.fog, 260, 700]} />
      <SunLight center={center} radius={radius} />

      <Terrain terrain={terrain} venue={venue} osm={bundle.osm} layout={layout} onPick={operator ? operator.onPick : handlePick} />
      {venue.water && <Water poly={venue.water} terrain={terrain} />}
      {bundle.osm && <Paths paths={bundle.osm.paths} terrain={terrain} water={venue.water ?? null} />}
      <Trees trees={trees} terrain={terrain} water={venue.water ?? null} />
      <Buildings buildings={buildings} />

      {stage && <StageMesh stage={stage} terrain={terrain} />}
      {layout?.screens.map((s, i) => (
        <ScreenMesh key={i} screen={s} terrain={terrain} />
      ))}
      {layout?.performer && stage && (
        <PerformerMesh performer={layout.performer} floor={heightAt(terrain, stage.x, stage.z) + stage.deckH} />
      )}

      {layout && crowd && <Crowd crowd={crowd} terrain={terrain} myMat={mat} scale={crowdScale} styleId={camera === 'firstPerson' ? 'basic' : personStyle} faded={Boolean(overlay) && camera === 'orbit'} />}

      {painted && camera === 'orbit' && <HeatOverlay cells={painted} terrain={terrain} opacity={layout ? 0.9 : 0.62} />}
      {markers && camera === 'orbit' && <SpotMarkers markers={markers} terrain={terrain} />}

      {operator && <Tents tents={operator.tents} palms={operator.palms} suggestion={operator.suggestion} zoneStart={operator.zoneStart} terrain={terrain} onTent={operator.onTent} />}

      {mat && !operator && (
        <MyMat
          position={mat}
          spec={layout?.mat ?? DEFAULT_MAT}
          terrain={terrain}
          eyeHeight={eyeHeight}
          target={performerTarget}
          showPin={camera === 'orbit'}
          bubble={camera === 'orbit' ? bubble : null}
          canPlace={canPlace}
          onMove={handleMove}
        />
      )}

      <CameraRig eye={eye} lookAt={lookAt} orbitTarget={home.target} home={home.position} />
      <Effects />
      <FirstFrame />
    </Canvas>
  )
}

function FirstFrame() {
  const frames = useRef(0)
  useFrame(() => {
    if (frames.current > 2) return
    frames.current += 1
    if (frames.current === 2) sceneStore.set({ sceneReady: true })
  })
  return null
}
