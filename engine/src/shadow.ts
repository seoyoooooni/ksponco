/**
 * 햇볕 판정
 * ① 고정 물체(지형·나무·건물) 그림자: 날짜만으로 결정 → sunGridFixed()로 사전계산
 * ② 행사 물체(무대 지붕·스크린·그늘막) 그림자: 상자 몇 개 → applyEventShadows()로 화면에서 바로 계산해 합침
 */
import type { SpotSun, SunGrid, SunPosition, SunState, Vec3, VenueData } from "./types.js";
import { type Scene, Terrain, buildFixedScene, occluded } from "./scene.js";
import { type SunOptions, parseTime, sunPosition, timeSeries } from "./sun.js";
import { decodeBits, encodeBits } from "./codec.js";

/** 해를 향해 쏘는 광선 최대 거리 (m) */
export const SUN_RAY_MAX = 1500;
/** 햇볕 판정 높이: 바닥 위 0.3m (앉은 사람 몸) */
export const DEFAULT_SAMPLE_HEIGHT = 0.3;

export interface GridSpec {
  x0: number;
  z0: number;
  cell: number;
  nx: number;
  nz: number;
}

/** 지형 범위를 덮는 cell 간격 격자 (첫 칸 중심 x0, z0) */
export function gridFromTerrain(t: Terrain, cell = 2): GridSpec {
  const w = t.maxX - t.minX, d = t.maxZ - t.minZ;
  const nx = Math.max(1, Math.floor(w / cell)), nz = Math.max(1, Math.floor(d / cell));
  return { x0: t.minX + (w - (nx - 1) * cell) / 2, z0: t.minZ + (d - (nz - 1) * cell) / 2, cell, nx, nz };
}

export function cellCenter(g: GridSpec, i: number): [number, number] {
  return [g.x0 + (i % g.nx) * g.cell, g.z0 + Math.floor(i / g.nx) * g.cell];
}

export function cellIndex(g: GridSpec, x: number, z: number): number {
  const ix = Math.round((x - g.x0) / g.cell), iz = Math.round((z - g.z0) / g.cell);
  if (ix < 0 || iz < 0 || ix >= g.nx || iz >= g.nz) return -1;
  return iz * g.nx + ix;
}

/** 한 점이 햇볕을 받는가 (해가 지평선 아래면 false) */
export function isSunlit(scene: Scene, terrain: Terrain, x: number, z: number, sun: SunPosition, sampleHeight = DEFAULT_SAMPLE_HEIGHT): boolean {
  if (sun.altitude <= 0) return false;
  const p: Vec3 = [x, terrain.heightAt(x, z) + sampleHeight, z];
  return !occluded(scene, p, sun.dir, SUN_RAY_MAX);
}

export interface SunGridOptions {
  cell?: number;
  t0?: string;
  step?: number;
  nt?: number;
  sampleHeight?: number;
  sun?: SunOptions;
  grid?: GridSpec;
}

/**
 * sun_YYYYMMDD.json 만들기 (고정 물체 그림자만). 백엔드 사전계산·프론트 Worker 즉석 계산 공용
 * 기본: 09:00부터 15분 간격 52개 (09:00~21:45), 2m 칸
 */
export function sunGridFixed(data: VenueData, date: string, opts: SunGridOptions = {}): SunGrid {
  const scene = buildFixedScene(data);
  const terrain = scene.terrain!;
  const g = opts.grid ?? gridFromTerrain(terrain, opts.cell ?? 2);
  const t0 = opts.t0 ?? "09:00", step = opts.step ?? 15, nt = opts.nt ?? 52;
  const sunOpts = { lat: data.venue.lat, lon: data.venue.lon, ...opts.sun };
  const n = g.nx * g.nz;
  const out: string[] = [];
  for (const time of timeSeries(t0, step, nt)) {
    const sun = sunPosition(date, time, sunOpts);
    const bits = new Uint8Array(n);
    if (sun.altitude > 0) {
      for (let i = 0; i < n; i++) {
        const [x, z] = cellCenter(g, i);
        bits[i] = isSunlit(scene, terrain, x, z, sun, opts.sampleHeight) ? 1 : 0;
      }
    }
    out.push(encodeBits(bits));
  }
  return { date, x0: g.x0, z0: g.z0, cell: g.cell, nx: g.nx, nz: g.nz, t0, step, nt, sun: out };
}

/** SunGrid → 시각별 0/1 배열 */
export function decodeSunGrid(sg: SunGrid): Uint8Array[] {
  const n = sg.nx * sg.nz;
  return sg.sun.map((s) => decodeBits(s, n));
}

export function gridOf(sg: SunGrid): GridSpec {
  return { x0: sg.x0, z0: sg.z0, cell: sg.cell, nx: sg.nx, nz: sg.nz };
}

/**
 * 고정 그림자 결과에 행사 물체 그림자를 합침 (햇볕 칸 중 행사 물체에 가린 칸만 0으로)
 * eventScene: buildEventScene() 결과. 행사 물체가 없으면 그대로 돌려줌
 */
export function applyEventShadows(sg: SunGrid, fixed: Uint8Array[], eventScene: Scene, terrain: Terrain, opts: { sampleHeight?: number; sun?: SunOptions } = {}): Uint8Array[] {
  if (eventScene.prisms.length === 0 && eventScene.crowns.length === 0) return fixed;
  const g = gridOf(sg);
  const times = timeSeries(sg.t0, sg.step, sg.nt);
  return fixed.map((bits, k) => {
    const sun = sunPosition(sg.date, times[k], opts.sun);
    const out = bits.slice();
    for (let i = 0; i < out.length; i++) {
      if (!out[i]) continue;
      const [x, z] = cellCenter(g, i);
      const p: Vec3 = [x, terrain.heightAt(x, z) + (opts.sampleHeight ?? DEFAULT_SAMPLE_HEIGHT), z];
      if (occluded(eventScene, p, sun.dir, SUN_RAY_MAX)) out[i] = 0;
    }
    return out;
  });
}

/** 시각 "HH:MM" → SunGrid 시각 인덱스 (범위 밖이면 -1) */
export function timeIndex(sg: SunGrid, time: string): number {
  const k = Math.round((parseTime(time) - parseTime(sg.t0)) / sg.step);
  return k >= 0 && k < sg.nt ? k : -1;
}

/**
 * 칸별 그늘 비율 (평소 모드 그늘 지도). from 포함 ~ to 미포함 구간
 * 해 진 시각은 빼고 계산. 구간 전체가 밤이면 NaN
 */
export function shadeRatio(sg: SunGrid, bits: Uint8Array[], from: string, to: string): Float32Array {
  const n = sg.nx * sg.nz;
  const out = new Float32Array(n);
  const times = timeSeries(sg.t0, sg.step, sg.nt);
  const k0 = Math.max(0, timeIndex(sg, from)), k1 = timeIndex(sg, to) < 0 ? sg.nt : timeIndex(sg, to);
  const day: number[] = [];
  for (let k = k0; k < k1; k++) if (sunPosition(sg.date, times[k]).altitude > 0) day.push(k);
  for (let i = 0; i < n; i++) {
    if (day.length === 0) {
      out[i] = NaN;
      continue;
    }
    let shade = 0;
    for (const k of day) if (!bits[k][i]) shade++;
    out[i] = shade / day.length;
  }
  return out;
}

/** "지금부터 구간 끝까지 계속 그늘" 칸 중 (x, z)에서 가까운 순 limit개 */
export function findShadeSpots(sg: SunGrid, bits: Uint8Array[], from: string, to: string, x: number, z: number, limit = 3): { x: number; z: number; dist: number }[] {
  const ratio = shadeRatio(sg, bits, from, to);
  const g = gridOf(sg);
  const hits: { x: number; z: number; dist: number }[] = [];
  for (let i = 0; i < ratio.length; i++) {
    if (ratio[i] === 1) {
      const [cx, cz] = cellCenter(g, i);
      hits.push({ x: cx, z: cz, dist: Math.hypot(cx - x, cz - z) });
    }
  }
  return hits.sort((a, b) => a.dist - b.dist).slice(0, limit);
}

/**
 * 한 자리(돗자리)의 시간대별 햇볕. 사전계산 없이 직접 계산 (프론트에서 돗자리 옮길 때)
 * scene = mergeScenes(고정 장면, 행사 장면)
 */
export function spotSun(scene: Scene, terrain: Terrain, x: number, z: number, date: string, from: string, to: string, step = 15, opts: { sampleHeight?: number; sun?: SunOptions } = {}): SpotSun {
  const nt = Math.max(0, Math.round((parseTime(to) - parseTime(from)) / step));
  const times = timeSeries(from, step, nt);
  const state: SunState[] = times.map((t) => {
    const sun = sunPosition(date, t, opts.sun);
    if (sun.altitude <= 0) return "night";
    return isSunlit(scene, terrain, x, z, sun, opts.sampleHeight) ? "sun" : "shade";
  });
  const sunMinutes = state.filter((s) => s === "sun").length * step;
  let shadeFrom: string | null = null;
  for (let k = state.length - 1; k >= 0 && state[k] !== "sun"; k--) shadeFrom = times[k];
  if (shadeFrom === times[0] && state.every((s) => s === "night")) shadeFrom = null;
  return { times, state, sunMinutes, shadeFrom };
}
