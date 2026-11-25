import type { Performer, ScreenSpec, StageSpec, Terrain } from '../data/types'
import { heightAt } from '../lib/terrainSample'
import { sceneColors } from './colors'

const DEG = Math.PI / 180

export function facingRotation(azimuth: number): number {
  return Math.PI - azimuth * DEG
}

type BoxProps = {
  size: [number, number, number]
  position: [number, number, number]
  color: string
}

function Box({ size, position, color }: BoxProps) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
    </mesh>
  )
}

export function StageMesh({ stage, terrain }: { stage: StageSpec; terrain: Terrain }) {
  const g = heightAt(terrain, stage.x, stage.z)
  const { w, d, deckH, roofH } = stage
  if (stage.shape === 'circle') {
    const r = stage.r ?? w / 2
    return (
      <mesh position={[stage.x, g + deckH / 2, stage.z]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r, Math.max(deckH, 0.05), 48]} />
        <meshLambertMaterial color={sceneColors.stageDeck} />
      </mesh>
    )
  }
  if (roofH == null) {
    return (
      <group position={[stage.x, g, stage.z]} rotation-y={facingRotation(stage.azimuth)}>
        <Box size={[w, deckH, d]} position={[0, deckH / 2, 0]} color={sceneColors.stageDeck} />
      </group>
    )
  }
  return (
    <group position={[stage.x, g, stage.z]} rotation-y={facingRotation(stage.azimuth)}>
      <Box size={[w, deckH, d]} position={[0, deckH / 2, 0]} color={sceneColors.stageDeck} />
      <Box
        size={[w, roofH - deckH, 0.6]}
        position={[0, deckH + (roofH - deckH) / 2, -d / 2]}
        color={sceneColors.stage}
      />
      <Box size={[0.6, roofH, 0.6]} position={[-w / 2, roofH / 2, d / 2 - 0.3]} color={sceneColors.stageFrame} />
      <Box size={[0.6, roofH, 0.6]} position={[w / 2, roofH / 2, d / 2 - 0.3]} color={sceneColors.stageFrame} />
      <Box size={[w + 1, 0.8, d + 1]} position={[0, roofH, 0]} color={sceneColors.stageRoof} />
    </group>
  )
}

export function ScreenMesh({ screen, terrain }: { screen: ScreenSpec; terrain: Terrain }) {
  const g = heightAt(terrain, screen.x, screen.z)
  return (
    <group position={[screen.x, g, screen.z]} rotation-y={facingRotation(screen.azimuth)}>
      <Box size={[screen.w, screen.h, 0.4]} position={[0, screen.bottom + screen.h / 2, 0]} color={sceneColors.screen} />
      <Box size={[0.5, screen.bottom, 0.5]} position={[0, screen.bottom / 2, -0.4]} color={sceneColors.stageFrame} />
    </group>
  )
}

export function PerformerMesh({ performer, floor }: { performer: Performer; floor: number }) {
  const r = 0.28
  return (
    <mesh position={[performer.x, floor + performer.h / 2, performer.z]} castShadow>
      <capsuleGeometry args={[r, performer.h - 2 * r, 4, 10]} />
      <meshLambertMaterial color={sceneColors.performer} />
    </mesh>
  )
}
