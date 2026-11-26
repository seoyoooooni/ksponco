import { useEffect, useMemo, useState } from 'react'
import { PlaneGeometry, Vector2 } from 'three'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Terrain, Vec2 } from '../data/types'
import { MIN_SIDE, TENT_ROOF, TENT_SIZE, type ClosedArea, type Tent } from '../lib/operator'
import { bounds } from '../lib/polygon'
import { heightAt } from '../lib/terrainSample'
import { sceneStore, useScene } from '../store/sceneStore'
import { sceneColors } from './colors'

const LEG = TENT_SIZE / 2 - 0.15
const PALM = '#b08a5a'

type Props = {
  tents: Tent[]
  palms: ClosedArea[]
  suggestion: { x: number; z: number } | null
  zoneStart: Vec2 | null
  draft: 'zone' | 'palm' | null
  terrain: Terrain
  onTent?: (id: number) => void
  canMove?: (id: number, x: number, z: number) => boolean
  onMove?: (id: number, x: number, z: number) => void
}

function TentMesh({ lifted }: { lifted: boolean }) {
  return (
    <>
      <mesh position-y={TENT_ROOF + (lifted ? 0.6 : 0)} castShadow receiveShadow>
        <boxGeometry args={[TENT_SIZE, 0.14, TENT_SIZE]} />
        <meshLambertMaterial color={lifted ? sceneColors.tentSuggest : sceneColors.tent} />
      </mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
        <mesh key={`${sx}${sz}`} position={[sx * LEG, TENT_ROOF / 2 + (lifted ? 0.3 : 0), sz * LEG]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, TENT_ROOF + (lifted ? 0.6 : 0), 6]} />
          <meshLambertMaterial color="#8a9096" />
        </mesh>
      ))}
    </>
  )
}

function ZoneDraft({ start, kind, terrain }: { start: Vec2; kind: 'zone' | 'palm'; terrain: Terrain }) {
  const hover = useScene((s) => s.opHover)
  const rect = hover
    ? { x0: Math.min(start[0], hover[0]), x1: Math.max(start[0], hover[0]), z0: Math.min(start[1], hover[1]), z1: Math.max(start[1], hover[1]) }
    : null
  const w = rect ? rect.x1 - rect.x0 : 0
  const d = rect ? rect.z1 - rect.z0 : 0
  const ok = w >= MIN_SIDE && d >= MIN_SIDE
  const geometry = useMemo(() => {
    if (!rect || w < 0.2 || d < 0.2) return null
    const g = new PlaneGeometry(w, d, Math.max(1, Math.ceil(w / 2)), Math.max(1, Math.ceil(d / 2)))
    g.rotateX(-Math.PI / 2)
    g.translate((rect.x0 + rect.x1) / 2, 0, (rect.z0 + rect.z1) / 2)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) p.setY(i, heightAt(terrain, p.getX(i), p.getZ(i)) + 0.3)
    g.computeBoundingSphere()
    return g
  }, [rect?.x0, rect?.x1, rect?.z0, rect?.z1, terrain])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!rect || !geometry) return null
  const cx = (rect.x0 + rect.x1) / 2
  const cz = (rect.z0 + rect.z1) / 2
  return (
    <>
      <mesh geometry={geometry} raycast={() => null} userData={{ noAO: true }}>
        <meshBasicMaterial color={ok ? (kind === 'palm' ? PALM : sceneColors.mark) : '#8a9096'} transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <Html position={[cx, heightAt(terrain, cx, cz) + 1.2, cz]} center style={{ pointerEvents: 'none' }}>
        <div className="op-size">{`${Math.round(w)} × ${Math.round(d)}m`}</div>
      </Html>
    </>
  )
}

export function Tents({ tents, palms, suggestion, zoneStart, draft, terrain, onTent, canMove, onMove }: Props) {
  const [drag, setDrag] = useState<{ id: number; x: number; z: number } | null>(null)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const raycaster = useThree((s) => s.raycaster)
  const controls = useThree((s) => s.controls) as unknown as { enabled: boolean } | null
  const movable = Boolean(onMove && canMove)

  const startDrag = (t: Tent) => (e: ThreeEvent<PointerEvent>) => {
    if (!onMove || !canMove) return
    e.stopPropagation()
    const ground = scene.getObjectByName('terrain')
    if (!ground) return
    if (controls) controls.enabled = false
    document.body.style.cursor = 'grabbing'
    const ndc = new Vector2()
    const grab = { dx: t.x - e.point.x, dz: t.z - e.point.z }
    let last = { x: t.x, z: t.z }
    setDrag({ id: t.id, ...last })

    const move = (ev: PointerEvent) => {
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, camera)
      const hit = raycaster.intersectObject(ground, false)[0]
      if (!hit) return
      const x = hit.point.x + grab.dx
      const z = hit.point.z + grab.dz
      if (!canMove(t.id, x, z)) return
      last = { x, z }
      setDrag({ id: t.id, ...last })
    }

    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      if (controls) controls.enabled = true
      document.body.style.cursor = ''
      setDrag(null)
      if (Math.hypot(last.x - t.x, last.z - t.z) > 0.3) onMove(t.id, last.x, last.z)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const handleClick = (t: Tent) => (e: ThreeEvent<MouseEvent>) => {
    if (onTent) {
      if (e.delta > 6) return
      e.stopPropagation()
      onTent(t.id)
    } else if (movable) {
      e.stopPropagation()
      if (e.delta <= 6) sceneStore.set({ notice: '그늘막을 끌어서 옮길 수 있어요' })
    }
  }

  const hover = (on: boolean) => () => {
    if (!drag && (movable || onTent)) document.body.style.cursor = on ? (onTent ? 'pointer' : 'grab') : ''
  }

  return (
    <>
      {tents.map((t) => {
        const p = drag?.id === t.id ? drag : t
        const g = heightAt(terrain, p.x, p.z)
        return (
          <group
            key={t.id}
            position={[p.x, g, p.z]}
            onClick={onTent || movable ? handleClick(t) : undefined}
            onPointerDown={movable && !onTent ? startDrag(t) : undefined}
            onPointerOver={hover(true)}
            onPointerOut={hover(false)}
          >
            <TentMesh lifted={drag?.id === t.id} />
          </group>
        )
      })}
      {palms.map((p) => {
        const b = bounds(p.poly)
        const cx = (b.x0 + b.x1) / 2
        const cz = (b.z0 + b.z1) / 2
        return (
          <mesh key={p.id} position={[cx, heightAt(terrain, cx, cz) + 0.22, cz]} receiveShadow raycast={() => null}>
            <boxGeometry args={[b.x1 - b.x0, 0.05, b.z1 - b.z0]} />
            <meshLambertMaterial color={PALM} />
          </mesh>
        )
      })}
      {suggestion && !drag && (
        <mesh position={[suggestion.x, heightAt(terrain, suggestion.x, suggestion.z) + TENT_ROOF / 2, suggestion.z]} raycast={() => null} userData={{ noAO: true }}>
          <boxGeometry args={[TENT_SIZE, TENT_ROOF, TENT_SIZE]} />
          <meshBasicMaterial color={sceneColors.tentSuggest} transparent opacity={0.35} depthWrite={false} />
        </mesh>
      )}
      {zoneStart && (
        <mesh position={[zoneStart[0], heightAt(terrain, zoneStart[0], zoneStart[1]) + 0.3, zoneStart[1]]} raycast={() => null}>
          <sphereGeometry args={[0.5, 12, 8]} />
          <meshBasicMaterial color={sceneColors.mark} />
        </mesh>
      )}
      {zoneStart && draft && <ZoneDraft start={zoneStart} kind={draft} terrain={terrain} />}
    </>
  )
}
