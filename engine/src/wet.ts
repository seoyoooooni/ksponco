import type { Vec3 } from "./types.js";
import { type Scene, Terrain, occluded } from "./scene.js";
import { DEFAULT_SAMPLE_HEIGHT, SUN_RAY_MAX } from "./shadow.js";
import { type SunOptions, sunPosition } from "./sun.js";

export type WetReason = "heavy" | "low" | "shade";

export const WET_RAIN_MM = 1;
export const HEAVY_RAIN_MM = 10;

export interface PondOptions {
  reach?: number;
  rim?: number;
  escapes?: number;
}

export interface WetOptions extends PondOptions {
  shadeShare?: number;
  sampleHeight?: number;
}

export function pondAt(terrain: Terrain, x: number, z: number, opts: PondOptions = {}): boolean {
  const reach = opts.reach ?? 4;
  const rim = opts.rim ?? 0.02;
  const h = terrain.heightAt(x, z);
  let open = 0;
  for (const dx of [-reach, 0, reach]) {
    for (const dz of [-reach, 0, reach]) {
      if (!dx && !dz) continue;
      if (terrain.heightAt(x + dx, z + dz) < h + rim) open++;
    }
  }
  return open <= (opts.escapes ?? 1);
}

export function morningSun(date: string, opts: SunOptions = {}, from = "09:00", to = "12:00", step = 15): Vec3[] {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const out: Vec3[] = [];
  for (let m = fh * 60 + fm; m < th * 60 + tm; m += step) {
    const mid = m + step / 2;
    const h = Math.floor(mid / 60);
    const s = sunPosition(date, `${h}:${mid - h * 60}`, opts);
    if (s.altitude > 0.5) out.push(s.dir);
  }
  return out;
}

export function wetAt(scene: Scene, terrain: Terrain, x: number, z: number, rainMm: number, morning: Vec3[], opts: WetOptions = {}): WetReason | null {
  if (!(rainMm >= WET_RAIN_MM)) return null;
  if (rainMm >= HEAVY_RAIN_MM) return "heavy";
  if (pondAt(terrain, x, z, opts)) return "low";
  if (morning.length === 0) return null;
  const p: Vec3 = [x, terrain.heightAt(x, z) + (opts.sampleHeight ?? DEFAULT_SAMPLE_HEIGHT), z];
  const shaded = morning.filter((d) => occluded(scene, p, d, SUN_RAY_MAX)).length;
  return shaded / morning.length >= (opts.shadeShare ?? 0.7) ? "shade" : null;
}
