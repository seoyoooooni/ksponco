/**
 * 해 위치 계산 (NOAA Solar Calculator 식, Meeus 기반)
 * 정확도: 고도·방위 ±0.1° 수준 (1901~2099년)
 */
import type { SunPosition, Vec3 } from "./types.js";

/** 올림픽공원 대략 위치 (venue.json에 lat/lon이 없을 때) */
export const OLYMPIC_PARK = { lat: 37.5207, lon: 127.1215 };
/** 한국 표준시 UTC+9 */
export const KST_OFFSET_HOURS = 9;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface SunOptions {
  lat?: number;
  lon?: number;
  /** 입력 시각의 UTC 기준 시간대 (시간). 기본 9 (KST) */
  tzHours?: number;
  /** 대기 굴절 보정 여부. 기본 true */
  refraction?: boolean;
}

/** "HH:MM" → 분 */
export function parseTime(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** 분 → "HH:MM" */
export function formatTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min - h * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** t0부터 step분 간격 nt개 시각 */
export function timeSeries(t0: string, step: number, nt: number): string[] {
  const s = parseTime(t0);
  return Array.from({ length: nt }, (_, i) => formatTime(s + i * step));
}

function julianDay(y: number, mo: number, d: number, utcMinutes: number): number {
  // 그레고리력 → 율리우스일 (UTC 분이 음수나 1440 이상이어도 그대로 더하면 됨)
  if (mo <= 2) {
    y -= 1;
    mo += 12;
  }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (mo + 1)) + d + B - 1524.5 + utcMinutes / 1440;
}

/**
 * 날짜("YYYY-MM-DD")와 현지 시각("HH:MM")의 해 위치
 */
export function sunPosition(date: string, time: string, opts: SunOptions = {}): SunPosition {
  const lat = opts.lat ?? OLYMPIC_PARK.lat;
  const lon = opts.lon ?? OLYMPIC_PARK.lon;
  const tz = opts.tzHours ?? KST_OFFSET_HOURS;
  const [y, mo, d] = date.split("-").map(Number);
  const localMin = parseTime(time);

  const jd = julianDay(y, mo, d, localMin - tz * 60);
  const jc = (jd - 2451545) / 36525;

  const L0 = (((280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const C =
    Math.sin(M * RAD) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
    Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * jc) +
    Math.sin(3 * M * RAD) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * jc;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const meanObliq = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const obliq = meanObliq + 0.00256 * Math.cos(omega * RAD);
  const decl = Math.asin(Math.sin(obliq * RAD) * Math.sin(appLong * RAD));

  const yv = Math.tan((obliq / 2) * RAD) ** 2;
  const eqTime =
    4 *
    DEG *
    (yv * Math.sin(2 * L0 * RAD) -
      2 * e * Math.sin(M * RAD) +
      4 * e * yv * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD) -
      0.5 * yv * yv * Math.sin(4 * L0 * RAD) -
      1.25 * e * e * Math.sin(2 * M * RAD));

  let tst = (localMin + eqTime + 4 * lon - 60 * tz) % 1440;
  if (tst < 0) tst += 1440;
  const ha = tst / 4 < 0 ? tst / 4 + 180 : tst / 4 - 180;

  const latR = lat * RAD;
  const cosZen = Math.min(1, Math.max(-1, Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha * RAD)));
  const zen = Math.acos(cosZen) * DEG;
  let elev = 90 - zen;

  if (opts.refraction !== false) elev += refractionDeg(elev);

  const sinZen = Math.sin(zen * RAD);
  let az: number;
  if (sinZen < 1e-9) {
    az = 180;
  } else {
    const c = Math.min(1, Math.max(-1, (Math.sin(latR) * Math.cos(zen * RAD) - Math.sin(decl)) / (Math.cos(latR) * sinZen)));
    const a = Math.acos(c) * DEG;
    az = ha > 0 ? (a + 180) % 360 : (540 - a) % 360;
  }

  return { altitude: elev, azimuth: az, dir: sunDirection(elev, az) };
}

/** NOAA 대기 굴절 보정 (도) */
function refractionDeg(elev: number): number {
  if (elev > 85) return 0;
  const te = Math.tan(elev * RAD);
  let arcsec: number;
  if (elev > 5) arcsec = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
  else if (elev > -0.575) arcsec = 1735 + elev * (-518.2 + elev * (103.4 + elev * (-12.79 + elev * 0.711)));
  else arcsec = -20.772 / te;
  return arcsec / 3600;
}

/** 고도·방위 → 해를 향하는 단위 벡터 (+x 동, +y 위, +z 남) */
export function sunDirection(altitude: number, azimuth: number): Vec3 {
  const ca = Math.cos(altitude * RAD);
  return [ca * Math.sin(azimuth * RAD), Math.sin(altitude * RAD), -ca * Math.cos(azimuth * RAD)];
}

/** 해 지는 시각 (현지 "HH:MM", 해 윗부분이 지평선에 닿는 때). 1분 단위 이분 탐색 */
export function sunsetTime(date: string, opts: SunOptions = {}): string {
  const SEMI_DIAMETER = 0.27;
  let lo = parseTime("12:00");
  let hi = parseTime("23:59");
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (sunPosition(date, formatTime(mid), opts).altitude > -SEMI_DIAMETER) lo = mid;
    else hi = mid;
  }
  return formatTime(hi);
}
