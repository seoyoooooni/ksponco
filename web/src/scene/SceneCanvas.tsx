import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { sceneColors } from './colors'

export function SceneCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [60, 105, 168], fov: 44, near: 0.5, far: 1200 }}
      style={{ position: 'fixed', inset: 0, touchAction: 'none' }}
    >
      <color attach="background" args={[sceneColors.sky]} />
      <fog attach="fog" args={[sceneColors.fog, 220, 520]} />
      <hemisphereLight args={[sceneColors.hemiSky, sceneColors.hemiGround, 0.9]} />
      <directionalLight position={[-60, 80, 30]} intensity={1.6} color={sceneColors.sun} />

      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 40]}>
        <planeGeometry args={[300, 300]} />
        <meshLambertMaterial color={sceneColors.outerGrass} />
      </mesh>

      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[4, 2, 4]} />
        <meshLambertMaterial color={sceneColors.stage} />
      </mesh>
      <mesh position={[20, 1, 0]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshLambertMaterial color="#e2574c" />
      </mesh>
      <mesh position={[0, 1, -20]}>
        <boxGeometry args={[2, 2, 2]} />
        <meshLambertMaterial color="#2f6690" />
      </mesh>

      <OrbitControls
        makeDefault
        target={[-2, 0, 40]}
        maxPolarAngle={Math.PI * 0.47}
        minDistance={15}
        maxDistance={320}
        enableDamping
      />
    </Canvas>
  )
}
