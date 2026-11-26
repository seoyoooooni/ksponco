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

### 젖은 바닥
| 함수 | 설명 |
|---|---|
| `morningSun(date)` | 09~12시 15분 칸 가운데의 해 방향 (고도 0.5° 넘는 것만) |
| `pondAt(terrain, x, z, opts?)` | 물이 빠질 곳 없는 곳인가 (4m 거리 8방향 중 7방향 이상이 2cm 넘게 높음) |
| `wetAt(scene, terrain, x, z, rainMm, morning, opts?)` | 전날 강수량 기준 젖은 바닥 판정. 1mm 미만 `null`, 10mm 이상 `"heavy"`(전체), 그 사이는 물이 빠질 곳 없는 곳 `"low"`(4m 거리 8방향 중 7방향 이상이 2cm 넘게 높음) 또는 오전 해의 70% 이상 가림 `"shade"`, 아니면 `null` |

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
- 프론트 연결 (2026-11-26)
  - 프론트는 `web/src/lib/engine.ts`에서 이 폴더의 `src/index.ts`를 바로 다시 내보내 씁니다(빌드 단계 없음). 개발 서버는 `web/vite.config.ts`의 `server.fs.allow: ['..']`로 이 폴더를 읽습니다.
  - 해 위치·해 지는 시각: 프론트 `lib/sun.ts`가 엔진 `sunPosition()`, `sunsetTime()`을 씁니다. 화면 해 조명도 같은 값입니다.
  - 가림 판정: 프론트 `lib/analysis.ts`의 `prepareBlockers()`가 `buildFixedScene()` + `buildEventScene()`으로 장면(지형·나무·건물·고정 무대 지붕·행사 무대 바닥과 지붕·스크린)을 만들고, 그늘·시야·운영자 계산은 모두 `occluded()`로 판정합니다. 그늘막은 엔진 `Canopy`(5×5m, 지붕 2.8m)입니다.
  - 지형 높이: `buildFixedScene(data, { ground })`, `buildEventScene(data, layout, canopies, ground)`에 프론트가 `Terrain`을 상속해 `heightAt()`을 바꾼 지형을 넘깁니다. 그래서 수변무대 계단 높이가 엔진 계산에도 들어갑니다.
  - 관객 가림은 프론트 `lib/crowd.ts` 배치(화면에 그리는 사람)와 머리 판정을 그대로 씁니다. 엔진 `placeAudience()`, `viewFrom()`은 프론트에서 쓰지 않습니다.
  - 햇볕 판정 높이는 프론트 기준 바닥 위 0.5m, 시각은 15분 칸 가운데입니다.
  - 사전계산(`sunGridFixed()`, `sun_YYYYMMDD.json`)은 아직 안 씁니다. 브라우저에서 즉석 계산합니다.
  - 젖은 바닥: 운영자 모드(4m 칸)와 관객 화면(내 돗자리, 2m 칸 추천 자리 거르기) 모두 `wetAt()`을 씁니다. 물 빠짐 판정에는 계단을 넣지 않은 점군 지형(`Terrain` 그대로)을 넘깁니다.

## 아직 없는 것

- 젖은 바닥 실측 검증 (지금은 지형·그늘로 추정)
- 배치안 A/B 비교 요약 함수
- 시연판 `core.js`와 결과 맞춰 보기 (원본 파일 받으면 비교)
- 나무 수관 투과율 (지금은 수관이 빛을 완전히 막는 것으로 계산)
