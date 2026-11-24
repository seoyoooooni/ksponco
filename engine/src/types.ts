/**
 * /engine 입출력 타입
 *
 * 좌표 약속 (기획 문서 6장)
 * - 장소마다 따로 좌표계. 원점 = 장소 고정 기준점 (venue.json originNote)
 * - 축은 진북 기준: +x 동쪽, +z 남쪽, +y 위 (three.js 기본과 같음)
 * - 단위 m, 각도는 도(deg). 방위각은 진북 기준 시계방향 (0 북, 90 동, 180 남, 270 서)
 * - 점군 → 장소 좌표 변환(진북 회전 포함)은 /ai 파이프라인에서 끝내고, 엔진은 이미 진북에 맞춘 값만 받는다
 *
 * 엔진은 화면·네트워크 코드에 의존하지 않는다 (프론트 Worker와 백엔드 Node가 같이 import)
 */

/** 평면 좌표 [x, z] */
export type Vec2 = [number, number];
/** 공간 좌표 [x, y, z] */
export type Vec3 = [number, number, number];

export type VenueId = "lawn88" | "lake";

/** 출처 값 (문서 6장 "데이터 출처 값") */
export type ObjectSource = "scan" | "model" | "satellite" | "gis";
export type LayoutSource = "official_map" | "default" | "operator";
export type TerrainSrc = 0 | 1 | 2; // 0 점군, 1 DEM, 2 임시 구조물 아래 보간

// ───────────────────────── 장소 데이터 (고정) ─────────────────────────

/** 사각형 고정 무대 (기획 문서 원래 형식) */
export interface FixedStageRect {
  shape?: "rect";
  x: number;
  z: number;
  w: number;
  d: number;
  /** 무대 바닥 높이 (주변 바닥 기준, m) */
  deckH: number;
  /** 지붕 아래면 높이 (주변 바닥 기준). 지붕 없으면 null */
  roofH: number | null;
  /** 무대가 바라보는 방향 (진북 기준 시계방향). 모르면 null */
  azimuth: number | null;
}

/** 원형 고정 무대 (수변무대 실측: 반지름 약 9.4m, 높이 0.2m, 지붕 없음) */
export interface FixedStageCircle {
  shape: "circle";
  x: number;
  z: number;
  r: number;
  deckH: number;
  roofH: number | null;
  azimuth: number | null;
}

export type FixedStage = FixedStageRect | FixedStageCircle;

/** venue.json */
export interface Venue {
  id: VenueId;
  name: string;
  /** 원점의 EPSG:5186 좌표 [E, N] */
  origin5186: [number, number];
  originNote: string;
  /** 해 위치 계산용 위경도. 없으면 올림픽공원 기본값 */
  lat?: number;
  lon?: number;
  stage: "temporary" | "fixed";
  fixedStage: FixedStage | null;
  /** "lawn" 잔디 / "steps" 계단 객석 (프론트 타입과 맞추려고 string 허용) */
  seating: string;
  defaultLayout: string;
}

/** terrain.json: 1m 칸별 바닥 높이 */
export interface TerrainGrid {
  /** 첫 칸 중심의 x, z */
  x0: number;
  z0: number;
  nx: number;
  nz: number;
  cell: number;
  /** 칸별 높이 (m). 인덱스 = iz * nx + ix */
  h: ArrayLike<number>;
  /** 칸별 출처. 인덱스는 h와 같음 */
  src?: ArrayLike<number>;
}

/** trees.json 한 그루. 높이는 모두 나무 밑동 바닥 기준 */
export interface Tree {
  x: number;
  z: number;
  /** 나무 꼭대기 높이 */
  h: number;
  /** 수관 아래 높이 */
  base: number;
  /** 수관 반지름 */
  r: number;
  source: ObjectSource;
}

/** buildings.json 한 동. 윤곽을 base부터 base+height까지 세운 기둥으로 본다 */
export interface Building {
  name: string;
  /** 바닥 절대 높이 (장소 좌표 y) */
  base: number;
  /** base부터의 높이 */
  height: number;
  footprint: Vec2[];
  source: ObjectSource;
}

/** 장소 데이터 묶음 */
export interface VenueData {
  venue: Venue;
  terrain: TerrainGrid;
  trees: Tree[];
  buildings: Building[];
}

// ───────────────────────── 행사 배치 데이터 ─────────────────────────

export interface Stage {
  x: number;
  z: number;
  w: number;
  d: number;
  deckH: number;
  /** 지붕 아래면 높이. 지붕 없으면 null */
  roofH: number | null;
  azimuth: number;
}

export interface Screen {
  x: number;
  z: number;
  w: number;
  h: number;
  /** 스크린 아래 끝 높이 (바닥 기준) */
  bottom: number;
  /** 스크린 앞면이 바라보는 방향 */
  azimuth: number;
}

export type ZoneType = "standing" | "picnic" | "aisle" | "booth" | "closed";

export interface Zone {
  type: ZoneType;
  poly: Vec2[];
  /** 1㎡당 사람 수 */
  density?: number;
}

export interface MatSpec {
  w: number;
  d: number;
  people: number;
}

/** layout_공연id.json / layout_default.json */
export interface Layout {
  id: string;
  venue: VenueId;
  source: LayoutSource;
  sourceNote?: string;
  /** 88잔디마당 같은 임시 무대. 고정 무대 장소는 비움 (venue.fixedStage 사용) */
  stage?: Stage | null;
  /** 공연자 위치. 없으면 무대 중심, 높이 1.7m */
  performer?: { x: number; z: number; h: number };
  screens: Screen[];
  zones: Zone[];
  mat: MatSpec;
}

/** 운영자가 놓는 그늘막 (위에서 본 사각형 + 지붕 높이) */
export interface Canopy {
  x: number;
  z: number;
  w: number;
  d: number;
  /** 지붕 높이 (바닥 기준) */
  h: number;
  /** 회전 (도, 진북 기준 시계방향) */
  azimuth?: number;
}

// ───────────────────────── 결과 ─────────────────────────

export interface SunPosition {
  /** 대기 굴절 보정한 고도 (도). 0 이하면 해 진 뒤 */
  altitude: number;
  /** 진북 기준 시계방향 방위 (도) */
  azimuth: number;
  /** 해를 향하는 단위 벡터 (장소 좌표) */
  dir: Vec3;
}

export type SunState = "sun" | "shade" | "night";

/** 한 자리의 시간대별 햇볕 */
export interface SpotSun {
  times: string[];
  state: SunState[];
  /** 햇볕 받는 시간 (분) */
  sunMinutes: number;
  /** 이 시각부터 끝까지 계속 그늘(또는 해 진 뒤). 없으면 null */
  shadeFrom: string | null;
}

/** sun_YYYYMMDD.json (고정 물체 그림자만) */
export interface SunGrid {
  date: string;
  /** 첫 칸 중심의 x, z */
  x0: number;
  z0: number;
  cell: number;
  nx: number;
  nz: number;
  t0: string;
  step: number;
  nt: number;
  /**
   * 시각별 칸 0/1 묶음 (base64).
   * 비트 순서: 칸 인덱스 i = iz * nx + ix, 바이트 i >> 3 의 비트 (i & 7), 낮은 비트부터. 1 = 햇볕
   */
  sun: string[];
}

export interface ViewTargetResult {
  /** 보이는 비율 0~100 */
  pct: number;
  /** 대상까지 수평 거리 (m) */
  dist: number;
}

export interface ViewResult {
  stage: ViewTargetResult;
  screens: ViewTargetResult[];
  /** 가장 잘 보이는 스크린 인덱스. 스크린 없으면 null */
  bestScreen: number | null;
}
