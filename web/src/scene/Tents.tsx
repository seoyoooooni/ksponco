import type { Terrain, Vec2 } from '../data/types'
import { TENT_ROOF, TENT_SIZE, type ClosedArea, type Tent } from '../lib/operator'
import { bounds } from '../lib/polygon'
import { heightAt } from '../lib/terrainSample'
import { sceneColors } from './colors'

const LEG = TENT_SIZE / 2 - 0.15

export function Tents({ tents, palms, suggestion, zoneStart, terrain, onTent }: { tents: Tent[]; palms: ClosedArea[]; suggestion: { x: number; z: number } | null; zoneStart: Vec2 | null; terrain: Terrain; onTent?: (id: number) => void }) {
  return (
    <>
      {tents.map((t) => {
        const g = heightAt(terrain, t.x, t.z)
        return (
          <group
            key={t.id}
            position={[t.x, g, t.z]}
            onClick={
              onTent
                ? (e) => {
                    if (e.delta > 6) return
                    e.stopPropagation()
                    onTent(t.id)
                  }
                : undefined
            }
          >
            <mesh position-y={TENT_ROOF} castShadow receiveShadow>
              <boxGeometry args={[TENT_SIZE, 0.14, TENT_SIZE]} />
              <meshLambertMaterial color={sceneColors.tent} />
            </mesh>
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => (
              <mesh key={`${sx}${sz}`} position={[sx * LEG, TENT_ROOF / 2, sz * LEG]} castShadow>
                <cylinderGeometry args={[0.05, 0.05, TENT_ROOF, 6]} />
                <meshLambertMaterial color="#8a9096" />
              </mesh>
            ))}
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
            <meshLambertMaterial color="#b08a5a" />
          </mesh>
        )
      })}
      {suggestion && (
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
    </>
  )
}
