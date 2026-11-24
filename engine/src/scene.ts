/**
 * 계산용 장면: 장소 데이터(고정) / 행사 물체(배치·그늘막)를 따로 만든다
 * - 고정 장면 → 사전계산(sun_YYYYMMDD.json)에 쓰임
 * - 행사 장면 → 화면에서 바로 계산해 고정 결과와 합침
 */
import type { Building, Canopy, Layout, TerrainGrid, Tree, Vec3, VenueData } from "./types.js";
import { type Crown, type Cylinder, type Prism, circlePoly, hitCrown, hitCylinder, hitPrism, makePrism, rectPoly } from "./geometry.js";

/** 지형 높이 조회 (쌍선형 보간, 범위 밖은 가장자리 값) */
export class Terrain {
  readonly maxH: number;
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  constructor(readonly g: TerrainGrid) {
    let m = -Infinity;
    for (let i = 0; i < g.h.length; i++) if (g.h[i] > m) m = g.h[i];
    this.maxH = m;
    this.minX = g.x0;
    this.maxX = g.x0 + (g.nx - 1) * g.cell;
    this.minZ = g.z0;
    this.maxZ = g.z0 + (g.nz - 1) * g.cell;
  }
  heightAt(x: number, z: number): number {
    const g = this.g;
    const fx = Math.min(Math.max((x - g.x0) / g.cell, 0), g.nx - 1);
    const fz = Math.min(Math.max((z - g.z0) / g.cell, 0), g.nz - 1);
    const ix = Math.min(Math.floor(fx), g.nx - 2), iz = Math.min(Math.floor(fz), g.nz - 2);
    const tx = fx - ix, tz = fz - iz;
    const h = g.h, n = g.nx;
    const a = h[iz * n + ix], b = h[iz * n + ix + 1], c = h[(iz + 1) * n + ix], d = h[(iz + 1) * n + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  inside(x: number, z: number): boolean {
    return x >= this.minX && x <= this.maxX && z >= this.minZ && z <= this.maxZ;
  }
  /** 지형이 광선을 막는가 (cell 절반 간격으로 걸어가며 검사) */
  blocks(p: Vec3, d: Vec3, tMax: number): boolean {
    const step = this.g.cell * 0.5;
    for (let t = step; t <= tMax; t += step) {
      const y = p[1] + d[1] * t;
      if (d[1] > 0 && y > this.maxH) return false;
      const x = p[0] + d[0] * t, z = p[2] + d[2] * t;
      if (!this.inside(x, z)) return false;
      if (y < this.heightAt(x, z)) return true;
    }
    return false;
  }
}

/** 막힘 검사용 장면 */
export interface Scene {
  terrain: Terrain | null;
  crowns: Crown[];
  prisms: Prism[];
  cylinders: Cylinder[];
}

export function crownOf(t: Tree, ground: number): Crown {
  const ry = Math.max((t.h - t.base) / 2, 0.3);
  return { cx: t.x, cz: t.z, cy: ground + t.base + ry, r: t.r, ry };
}

export function prismOfBuilding(b: Building): Prism {
  return makePrism(b.footprint, b.base, b.base + b.height, b.name);
}

/** 장소 데이터(지형·나무·건물)만으로 만든 장면 */
export function buildFixedScene(data: VenueData, opts: { terrain?: boolean } = {}): Scene {
  const terrain = new Terrain(data.terrain);
  const crowns = data.trees.map((t) => crownOf(t, terrain.heightAt(t.x, t.z)));
  const prisms = data.buildings.map(prismOfBuilding);
  // 고정 무대 지붕이 있으면 고정 물체로 포함
  const fs = data.venue.fixedStage;
  if (fs && fs.roofH != null) {
    const g = terrain.heightAt(fs.x, fs.z);
    const poly = fs.shape === "circle" ? circlePoly(fs.x, fs.z, fs.r) : rectPoly(fs.x, fs.z, fs.w, fs.d, fs.azimuth ?? 0);
    prisms.push(makePrism(poly, g + fs.roofH, g + fs.roofH + 0.5, "fixedStageRoof"));
  }
  return { terrain: opts.terrain === false ? null : terrain, crowns, prisms, cylinders: [] };
}

/** 행사 물체(무대 지붕·무대 바닥·스크린·그늘막) 장면. 지형은 높이 기준으로만 씀 */
export function buildEventScene(data: VenueData, layout: Layout | null, canopies: Canopy[] = []): Scene {
  const terrain = new Terrain(data.terrain);
  const prisms: Prism[] = [];
  if (layout?.stage) {
    const s = layout.stage;
    const g = terrain.heightAt(s.x, s.z);
    const poly = rectPoly(s.x, s.z, s.w, s.d, s.azimuth);
    if (s.deckH > 0) prisms.push(makePrism(poly, g, g + s.deckH, "stageDeck"));
    if (s.roofH != null) prisms.push(makePrism(poly, g + s.roofH, g + s.roofH + 0.8, "stageRoof"));
  }
  layout?.screens.forEach((sc, i) => {
    const g = terrain.heightAt(sc.x, sc.z);
    prisms.push(makePrism(rectPoly(sc.x, sc.z, sc.w, 0.3, sc.azimuth), g + sc.bottom, g + sc.bottom + sc.h, `screen${i}`));
  });
  for (const c of canopies) {
    const g = terrain.heightAt(c.x, c.z);
    prisms.push(makePrism(rectPoly(c.x, c.z, c.w, c.d, c.azimuth ?? 0), g + c.h - 0.05, g + c.h, "canopy"));
  }
  return { terrain: null, crowns: [], prisms, cylinders: [] };
}

/** 장면들 합치기 (지형은 앞쪽 것 사용) */
export function mergeScenes(...scenes: Scene[]): Scene {
  return {
    terrain: scenes.find((s) => s.terrain)?.terrain ?? null,
    crowns: scenes.flatMap((s) => s.crowns),
    prisms: scenes.flatMap((s) => s.prisms),
    cylinders: scenes.flatMap((s) => s.cylinders),
  };
}

export interface OccludeOptions {
  /** 이 tag를 가진 기둥은 무시 (시야 대상 스크린 자신) */
  ignoreTag?: string;
}

/** p에서 d 방향으로 tMax 안에 막히는가 */
export function occluded(scene: Scene, p: Vec3, d: Vec3, tMax: number, opts: OccludeOptions = {}): boolean {
  for (const c of scene.crowns) if (hitCrown(p, d, tMax, c)) return true;
  for (const b of scene.prisms) if (b.tag !== opts.ignoreTag && hitPrism(p, d, tMax, b)) return true;
  for (const c of scene.cylinders) if (hitCylinder(p, d, tMax, c)) return true;
  if (scene.terrain && scene.terrain.blocks(p, d, tMax)) return true;
  return false;
}
