import { useCallback, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import type { VenueBundle } from '../data/load'
import type { Layout } from '../data/types'
import type { Crowd as CrowdData } from '../lib/crowd'
import { bounds, zoneAt } from '../lib/polygon'
import { heightAt, sourceAt } from '../lib/terrainSample'
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

export function SceneCanvas({ bundle, layout, crowd, overlay: baseOverlay, bubble, markers, operator, overlayOverride }: Props) {
  const overlay = overlayOverride ?? baseOverlay
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

  const home = useMemo(() => {
    if (!stage) return { target: center, position: [center[0] + 62, 105, center[2] + 128] as [number, number, number] }
    const a = (stage.azimuth * Math.PI) / 180
    const fx = Math.sin(a)
    const fz = -Math.cos(a)
    const seats = layout?.zones.filter((z) => z.type === 'picnic' || z.type === 'standing') ?? []
    let ax = stage.x + fx * 25
    let az = stage.z + fz * 25
    if (seats.length) {
      const bs = seats.map((z) => bounds(z.poly))
      ax = (Math.min(...bs.map((b) => b.x0)) + Math.max(...bs.map((b) => b.x1))) / 2
      az = (Math.min(...bs.map((b) => b.z0)) + Math.max(...bs.map((b) => b.z1))) / 2
    }
    const tx = stage.x * 0.4 + ax * 0.6
    const tz = stage.z * 0.4 + az * 0.6
    const side = 0.35
    const dx = fx * Math.cos(side) - fz * Math.sin(side)
    const dz = fz * Math.cos(side) + fx * Math.sin(side)
    const target: [number, number, number] = [tx, heightAt(terrain, tx, tz), tz]
    const position: [number, number, number] = [tx + dx * 72, target[1] + 82, tz + dz * 72]
    return { target, position }
  }, [stage, layout, center, terrain])

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
      if (!layout) return sourceAt(terrain, x, z) === 0 ? null : '잔디 안을 눌러 주세요'
      const zone = zoneAt(layout.zones, x, z)
      if (!zone) return '피크닉존 안을 눌러 주세요'
      if (zone.type !== 'picnic') return BLOCKED[zone.type]
      return null
    },
    [layout, terrain],
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
      shadows
      dpr={[1, 2]}
      camera={{ position: [center[0] + 62, 105, center[2] + 128], fov: 44, near: 0.3, far: 1500 }}
      className="scene"
      style={{ position: 'fixed', touchAction: 'none' }}
    >
      <fog attach="fog" args={[sceneColors.fog, 220, 560]} />
      <SunLight center={center} radius={radius} />

      <Terrain terrain={terrain} layout={layout} onPick={operator ? operator.onPick : handlePick} />
      {venue.water && <Water poly={venue.water} terrain={terrain} />}
      <Trees trees={trees} terrain={terrain} />
      <Buildings buildings={buildings} />

      {stage && <StageMesh stage={stage} terrain={terrain} />}
      {layout?.screens.map((s, i) => (
        <ScreenMesh key={i} screen={s} terrain={terrain} />
      ))}
      {layout?.performer && stage && (
        <PerformerMesh performer={layout.performer} floor={heightAt(terrain, stage.x, stage.z) + stage.deckH} />
      )}

      {layout && crowd && <Crowd crowd={crowd} layout={layout} terrain={terrain} myMat={mat} scale={crowdScale} styleId={camera === 'firstPerson' ? 'basic' : personStyle} faded={Boolean(overlay) && camera === 'orbit'} />}

      {overlay && camera === 'orbit' && <HeatOverlay cells={overlay} terrain={terrain} opacity={layout ? 0.9 : 0.62} />}
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
