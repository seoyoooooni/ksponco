# /engine — 시야·햇볕 계산 엔진

프론트(Web Worker)와 백엔드(Node 사전계산)가 **같은 코드**를 import합니다. 화면·네트워크 코드에 의존하지 않습니다.

```
npm run build   # dist/ 생성
npm test        # 단위 테스트 7개 (node:test)
```

테스트용 임시 데이터: `test/fixtures/` (README 참고)

## 좌표 약속

- 장소마다 따로 좌표계, 원점 = `venue.json`의 기준점
- **+x 동쪽, +z 남쪽, +y 위** (three.js 기본과 같음), 단위 m
- 방위각: 진북 기준 시계방향 (0 북, 90 동, 180 남, 270 서)
- 점군 → 장소 좌표 변환(진북 회전 포함)은 `/ai`에서 끝내고, 엔진은 진북에 맞춘 값만 받음

## 입력 파일 → 타입 (`src/types.ts`)

| 파일 | 타입 | 바뀐 점 |
|---|---|---|
| `venue.json` | `Venue` | `fixedStage`에 원형 추가 (`shape: "circle"`, `r`), 선택 `lat`/`lon` |
| `terrain.json` | `TerrainGrid` | `x0`, `z0` = **첫 칸 중심**, 인덱스 `iz * nx + ix` |
| `trees.json` | `Tree[]` | `h`, `base`는 나무 밑동 바닥 기준 높이 |
| `buildings.json` | `Building[]` | `base`는 절대 높이(y), `height`는 base부터 |
| `layout_*.json` | `Layout` | 그대로 |
| 그늘막 | `Canopy` | 운영자 모드용 (`x, z, w, d, h, azimuth`) |

## 주요 함수

### 해 위치
| 함수 | 설명 |
|---|---|
| `sunPosition(date, time, opts?)` | `"2027-08-14"`, `"15:00"`(KST) → `{ altitude, azimuth, dir }` |
| `sunsetTime(date)` | 해 지는 시각 `"19:26"` |
| `timeSeries(t0, step, nt)` | `"09:00"`, 15, 52 → 시각 목록 |

### 햇볕 (두 단계)
| 함수 | 쓰는 곳 | 설명 |
|---|---|---|
| `sunGridFixed(data, date, opts?)` | 백엔드 사전계산, 프론트 즉석 계산 | **고정 물체 그림자만** → `sun_YYYYMMDD.json` 객체 |
| `decodeSunGrid(sg)` | 프론트 | 시각별 0/1 배열로 풀기 |
| `buildEventScene(data, layout, canopies)` | 프론트 | 무대 지붕·스크린·그늘막 장면 |
| `applyEventShadows(sg, bits, eventScene, terrain)` | 프론트 | 고정 결과에 행사 그림자 합치기 |
| `shadeRatio(sg, bits, from, to)` | 평소 모드 | 칸별 그늘 비율 (해 진 시각 제외) |
| `findShadeSpots(sg, bits, from, to, x, z, 3)` | 평소 모드 | "지금부터 계속 그늘" 칸 중 가까운 3곳 |
| `spotSun(scene, terrain, x, z, date, from, to)` | 관객 모드 돗자리 | 15분 단위 `sun`/`shade`/`night`, 햇볕 분, "○시부터 그늘" |

### 시야
| 함수 | 설명 |
|---|---|
| `placeAudience(layout, terrain)` | 구역 밀도대로 관객 배치 (같은 입력이면 항상 같은 배치) |
| `viewFrom(data, layout, scene, terrain, audience, x, z, eyeH?)` | 무대 %, 스크린별 %, 가장 잘 보이는 스크린 |

`scene` = `mergeScenes(buildFixedScene(data), buildEventScene(data, layout, canopies))`

## 사용 예

```ts
import { sunGridFixed, decodeSunGrid, buildFixedScene, buildEventScene, mergeScenes,
         applyEventShadows, viewFrom, placeAudience, spotSun } from "@kspo/engine";

// 백엔드: 사전계산
const sg = sunGridFixed(data, "2027-08-14");          // 2m 칸, 09:00~21:45, 15분
fs.writeFileSync("sun_20270814.json", JSON.stringify(sg));

// 프론트 Worker: 행사 그림자 합치기
const fixed = buildFixedScene(data);
const ev = buildEventScene(data, layout, canopies);
const bits = applyEventShadows(sg, decodeSunGrid(sg), ev, fixed.terrain!);

// 돗자리 한 자리
const scene = mergeScenes(fixed, ev);
const sun = spotSun(scene, fixed.terrain!, x, z, "2027-08-14", "13:00", "21:00");
const view = viewFrom(data, layout, scene, fixed.terrain!, placeAudience(layout, fixed.terrain!), x, z);
```

## 계산 방식 요약

- **해 위치**: NOAA 식(대기 굴절 보정 포함). 독립 알고리즘(PSA)과 비교해 오차 0.01° 이내
- **햇볕 판정**: 바닥 위 0.3m에서 해 방향으로 광선 → 나무 수관(회전타원체), 건물·행사 물체(윤곽 기둥), 지형(0.5칸 간격 검사)에 막히면 그늘
- **시야**: 눈높이(앉음 0.8m / 섬 1.6m)에서 대상 15점으로 광선. 앞 관객은 원기둥(앉음 0.95m, 섬 1.75m)
- **sun 비트 순서**: 칸 `i = iz * nx + ix` → 바이트 `i >> 3`의 비트 `i & 7`, 낮은 비트부터, 1 = 햇볕

## 성능 (88잔디마당 임시 데이터)

2,162칸 × 52개 시각 = 하루치 **약 0.06초**, 파일 **약 19KB** (기준 300KB)

## 프론트 `web/src/lib`와의 관계

- 프론트 `data/types.ts`의 `Venue`, `Layout`, `Terrain`, `Tree`, `Building`은 **고치지 않고 그대로** 엔진에 넘길 수 있습니다 (타입 호환 확인함).
- `terrain.json`의 `x0`, `z0`는 프론트 `heightAt()`과 같이 **첫 칸 중심**으로 봅니다.
- 해 방향 벡터 규칙(`[cos·sin(az), sin(alt), −cos·cos(az)]`)과 나무 수관 회전타원체는 프론트와 같습니다.
- 차이점
  - 해 위치: 프론트 `lib/sun.ts` 근사식은 엔진(NOAA)과 고도·방위가 **최대 약 1.2°** 차이 → 엔진 `sunPosition()`으로 바꾸는 것을 권장
  - 그림자: 프론트 `shadeGrid()`는 나무만, 엔진은 **나무 + 건물 + 지형 + 행사 물체(무대 지붕·스크린·그늘막)**
  - `SunGrid`의 `x0`, `z0`: 엔진은 **첫 칸 중심**. 프론트 `shadeGrid()`는 모서리 + 0.5칸이라 읽을 때 주의

## 아직 없는 것

- 물고임 (`wet.json`)
- 배치안 A/B 비교 요약 함수
- 시연판 `core.js`와 결과 맞춰 보기 (원본 파일 받으면 비교)
- 나무 수관 투과율 (지금은 수관이 빛을 완전히 막는 것으로 계산)
