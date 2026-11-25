/**
 * 광선 교차 검사 기본 도형
 * 모든 검사는 "p에서 방향 d로 거리 tMax 안에 막히는가"를 묻는다 (d는 단위 벡터)
 */
import type { Vec2, Vec3 } from "./types.js";

const EPS = 1e-6;

/** 나무 수관: 회전타원체 (가로 반지름 r, 세로 반지름 ry, 중심 cy) */
export interface Crown {
  cx: number;
  cy: number;
  cz: number;
  r: number;
  ry: number;
}

/** 윤곽을 y0~y1로 세운 기둥 (건물, 무대 지붕, 스크린, 그늘막) */
export interface Prism {
  poly: Vec2[];
  y0: number;
  y1: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** 시야 계산에서 대상 스크린 자신을 빼기 위한 표시 */
  tag?: string;
}

/** 세로 원기둥 (관객 몸) */
export interface Cylinder {
  x: number;
  z: number;
  r: number;
  y0: number;
  y1: number;
}

export function makePrism(poly: Vec2[], y0: number, y1: number, tag?: string): Prism {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of poly) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { poly, y0: Math.min(y0, y1), y1: Math.max(y0, y1), minX, maxX, minZ, maxZ, tag };
}

/** 중심·크기·방위로 회전한 사각형 윤곽. w는 좌우(방위에 수직), d는 앞뒤(방위 방향) */
export function rectPoly(cx: number, cz: number, w: number, d: number, azimuthDeg = 0): Vec2[] {
  const a = (azimuthDeg * Math.PI) / 180;
  // 방위 방향 단위벡터 (+x 동, +z 남): 북 = (0,-1)
  const fx = Math.sin(a), fz = -Math.cos(a);
  // 오른쪽 방향
  const rx = -fz, rz = fx;
  const hw = w / 2, hd = d / 2;
  return [
    [cx - rx * hw - fx * hd, cz - rz * hw - fz * hd],
    [cx + rx * hw - fx * hd, cz + rz * hw - fz * hd],
    [cx + rx * hw + fx * hd, cz + rz * hw + fz * hd],
    [cx - rx * hw + fx * hd, cz - rz * hw + fz * hd],
  ];
}

/** 원을 n각형으로 */
export function circlePoly(cx: number, cz: number, r: number, n = 32): Vec2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return [cx + r * Math.cos(a), cz + r * Math.sin(a)] as Vec2;
  });
}

export function pointInPoly(x: number, z: number, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function segIntersect(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
  const d1x = bx - ax, d1z = bz - az, d2x = dx - cx, d2z = dz - cz;
  const den = d1x * d2z - d1z * d2x;
  if (Math.abs(den) < 1e-12) return false;
  const t = ((cx - ax) * d2z - (cz - az) * d2x) / den;
  const u = ((cx - ax) * d1z - (cz - az) * d1x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function hitCrown(p: Vec3, d: Vec3, tMax: number, c: Crown): boolean {
  // 단위 구로 바꿔서 이차방정식
  const ox = (p[0] - c.cx) / c.r, oy = (p[1] - c.cy) / c.ry, oz = (p[2] - c.cz) / c.r;
  const dx = d[0] / c.r, dy = d[1] / c.ry, dz = d[2] / c.r;
  const A = dx * dx + dy * dy + dz * dz;
  const B = 2 * (ox * dx + oy * dy + oz * dz);
  const C = ox * ox + oy * oy + oz * oz - 1;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return false;
  const s = Math.sqrt(disc);
  const t1 = (-B - s) / (2 * A), t2 = (-B + s) / (2 * A);
  return t2 > EPS && t1 < tMax;
}

export function hitPrism(p: Vec3, d: Vec3, tMax: number, b: Prism): boolean {
  let ta: number, tb: number;
  if (Math.abs(d[1]) < 1e-9) {
    if (p[1] < b.y0 || p[1] > b.y1) return false;
    ta = 0;
    tb = tMax;
  } else {
    ta = (b.y0 - p[1]) / d[1];
    tb = (b.y1 - p[1]) / d[1];
    if (ta > tb) [ta, tb] = [tb, ta];
  }
  ta = Math.max(ta, EPS);
  tb = Math.min(tb, tMax);
  if (ta > tb) return false;
  const ax = p[0] + d[0] * ta, az = p[2] + d[2] * ta;
  const bx = p[0] + d[0] * tb, bz = p[2] + d[2] * tb;
  if (Math.max(ax, bx) < b.minX || Math.min(ax, bx) > b.maxX || Math.max(az, bz) < b.minZ || Math.min(az, bz) > b.maxZ) return false;
  if (pointInPoly(ax, az, b.poly) || pointInPoly(bx, bz, b.poly)) return true;
  const n = b.poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (segIntersect(ax, az, bx, bz, b.poly[j][0], b.poly[j][1], b.poly[i][0], b.poly[i][1])) return true;
  }
  return false;
}

export function hitCylinder(p: Vec3, d: Vec3, tMax: number, c: Cylinder): boolean {
  const ox = p[0] - c.x, oz = p[2] - c.z;
  const A = d[0] * d[0] + d[2] * d[2];
  let t1: number, t2: number;
  if (A < 1e-12) {
    if (ox * ox + oz * oz > c.r * c.r) return false;
    t1 = 0;
    t2 = tMax;
  } else {
    const B = 2 * (ox * d[0] + oz * d[2]);
    const C = ox * ox + oz * oz - c.r * c.r;
    const disc = B * B - 4 * A * C;
    if (disc < 0) return false;
    const s = Math.sqrt(disc);
    t1 = (-B - s) / (2 * A);
    t2 = (-B + s) / (2 * A);
  }
  t1 = Math.max(t1, EPS);
  t2 = Math.min(t2, tMax);
  if (t1 > t2) return false;
  const y1 = p[1] + d[1] * t1, y2 = p[1] + d[1] * t2;
  return Math.max(y1, y2) >= c.y0 && Math.min(y1, y2) <= c.y1;
}
