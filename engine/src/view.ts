/**
 * 무대·스크린 시야 %
 * - 앉은 눈높이 0.8m(서면 1.6m)에서 대상까지 15개 시선을 쏘고, 막히지 않은 비율
 * - 무대: 공연자 위치(무대 바닥 + 0.3~1.7m), 좌우 3줄 × 높이 5단
 * - 스크린: 스크린 면 위 가로 5 × 세로 3
 * - 가리는 것: 지형·나무·건물·행사 물체·앞 관객(구역 밀도로 배치한 원기둥)
 */
import type { Layout, Vec2, Vec3, ViewResult, ViewTargetResult, VenueData, Zone } from "./types.js";
import { type Cylinder, pointInPoly } from "./geometry.js";
import { type Scene, Terrain, occluded } from "./scene.js";

export const EYE_SIT = 0.8;
export const EYE_STAND = 1.6;

/** 관객 원기둥 크기 */
const PERSON_R = 0.22;
const HEAD_TOP_SIT = 0.95;
const HEAD_TOP_STAND = 1.75;

function hash01(i: number, j: number, s: number): number {
  const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * 구역 밀도대로 관객을 배치 (같은 입력이면 항상 같은 배치)
 * standing → 선 사람, picnic → 앉은 사람. aisle/booth/closed는 비움
 */
export function placeAudience(layout: Layout, terrain: Terrain): Cylinder[] {
  const out: Cylinder[] = [];
  layout.zones.forEach((zone: Zone, zi) => {
    if ((zone.type !== "standing" && zone.type !== "picnic") || !zone.density || zone.density <= 0) return;
    const sp = 1 / Math.sqrt(zone.density);
    const top = zone.type === "standing" ? HEAD_TOP_STAND : HEAD_TOP_SIT;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of zone.poly) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    for (let i = 0, x = minX + sp / 2; x < maxX; x += sp, i++) {
      for (let j = 0, z = minZ + sp / 2; z < maxZ; z += sp, j++) {
        const jx = x + (hash01(i, j, zi) - 0.5) * sp * 0.6;
        const jz = z + (hash01(j, i, zi + 7) - 0.5) * sp * 0.6;
        if (!pointInPoly(jx, jz, zone.poly)) continue;
        const g = terrain.heightAt(jx, jz);
        out.push({ x: jx, z: jz, r: PERSON_R, y0: g, y1: g + top });
      }
    }
  });
  return out;
}

/** 시선 범위 안의 관객만 골라 장면에 넣기 (속도용) */
function audienceNear(all: Cylinder[], a: Vec2, b: Vec2, margin = 1): Cylinder[] {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const L2 = dx * dx + dz * dz || 1;
  return all.filter((c) => {
    const t = Math.max(0, Math.min(1, ((c.x - a[0]) * dx + (c.z - a[1]) * dz) / L2));
    const px = a[0] + dx * t - c.x, pz = a[1] + dz * t - c.z;
    return px * px + pz * pz < (margin + c.r) ** 2;
  });
}

function visiblePct(scene: Scene, audience: Cylinder[], eye: Vec3, targets: Vec3[], ignoreTag?: string): number {
  if (targets.length === 0) return 0;
  // 자기 자신(눈 0.6m 안의 관객)은 뺀다
  const others = audience.filter((c) => (c.x - eye[0]) ** 2 + (c.z - eye[2]) ** 2 > 0.36);
  let seen = 0;
  for (const t of targets) {
    const v: Vec3 = [t[0] - eye[0], t[1] - eye[1], t[2] - eye[2]];
    const L = Math.hypot(v[0], v[1], v[2]);
    const d: Vec3 = [v[0] / L, v[1] / L, v[2] / L];
    const near = audienceNear(others, [eye[0], eye[2]], [t[0], t[2]]);
    const sc: Scene = { ...scene, cylinders: near };
    if (!occluded(sc, eye, d, L - 0.3, { ignoreTag })) seen++;
  }
  return (seen / targets.length) * 100;
}

/** 공연자 위치 (없으면 무대 중심, 높이 1.7m) */
export function performerOf(data: VenueData, layout: Layout): { x: number; z: number; h: number } {
  if (layout.performer) return layout.performer;
  const s = layout.stage ?? data.venue.fixedStage;
  return { x: s?.x ?? 0, z: s?.z ?? 0, h: 1.7 };
}

/** 공연자 위치 15점 */
export function performerTargets(data: VenueData, layout: Layout, terrain: Terrain, eye: Vec3): Vec3[] {
  const p = performerOf(data, layout);
  const deck = layout.stage?.deckH ?? data.venue.fixedStage?.deckH ?? 0;
  const g = terrain.heightAt(p.x, p.z) + deck;
  const vx = p.x - eye[0], vz = p.z - eye[2];
  const L = Math.hypot(vx, vz) || 1;
  const rx = -vz / L, rz = vx / L; // 시선에 수직인 좌우 방향
  const out: Vec3[] = [];
  for (const off of [-0.4, 0, 0.4]) {
    for (let k = 0; k < 5; k++) {
      const h = 0.3 + (k * (p.h - 0.3)) / 4;
      out.push([p.x + rx * off, g + h, p.z + rz * off]);
    }
  }
  return out;
}

/** 스크린 면 위 15점 (가로 5 × 세로 3) */
export function screenTargets(layout: Layout, idx: number, terrain: Terrain): Vec3[] {
  const s = layout.screens[idx];
  const a = (s.azimuth * Math.PI) / 180;
  const rx = Math.cos(a), rz = Math.sin(a); // 방위에 수직
  const g = terrain.heightAt(s.x, s.z);
  const out: Vec3[] = [];
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 3; j++) {
      const u = (i / 4 - 0.5) * s.w * 0.9;
      const y = g + s.bottom + s.h * (0.15 + 0.35 * j);
      out.push([s.x + rx * u, y, s.z + rz * u]);
    }
  }
  return out;
}

/** 스크린 앞면에서 보는가 (뒷면이면 안 보이는 것으로) */
function facesViewer(layout: Layout, idx: number, eye: Vec3): boolean {
  const s = layout.screens[idx];
  const a = (s.azimuth * Math.PI) / 180;
  const fx = Math.sin(a), fz = -Math.cos(a);
  return (eye[0] - s.x) * fx + (eye[2] - s.z) * fz > 0;
}

/**
 * 한 자리의 무대·스크린 시야
 * scene: mergeScenes(고정 장면, 행사 장면), audience: placeAudience() 결과 (한 번 만들어 재사용)
 */
export function viewFrom(data: VenueData, layout: Layout, scene: Scene, terrain: Terrain, audience: Cylinder[], x: number, z: number, eyeHeight = EYE_SIT): ViewResult {
  const eye: Vec3 = [x, terrain.heightAt(x, z) + eyeHeight, z];
  const p = performerOf(data, layout);
  const stage: ViewTargetResult = {
    pct: visiblePct(scene, audience, eye, performerTargets(data, layout, terrain, eye)),
    dist: Math.hypot(p.x - x, p.z - z),
  };
  const screens = layout.screens.map((s, i) => ({
    pct: facesViewer(layout, i, eye) ? visiblePct(scene, audience, eye, screenTargets(layout, i, terrain), `screen${i}`) : 0,
    dist: Math.hypot(s.x - x, s.z - z),
  }));
  let bestScreen: number | null = null;
  screens.forEach((s, i) => {
    if (bestScreen === null || s.pct > screens[bestScreen].pct || (s.pct === screens[bestScreen].pct && s.dist < screens[bestScreen].dist)) bestScreen = i;
  });
  return { stage, screens, bestScreen };
}
