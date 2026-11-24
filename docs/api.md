# API 명세

이 프로젝트에는 서버가 없습니다. `pipeline/`이 외부 API를 호출해 정적 JSON을 만들고, 프론트(`web/`)가 그 파일을 `fetch`로 읽습니다. 이 문서는 두 경계를 정리합니다.

1. 프론트가 읽는 데이터 파일(`web/public/data/`)
2. 파이프라인이 호출하는 외부 API

타입 기준은 `web/src/data/types.ts`, 검사 규칙 기준은 `pipeline/check/check.ts`입니다. 둘이 다르면 코드가 맞습니다.

## 1. 데이터 파일 (프론트 ← 정적 JSON)

### 공통

| 항목 | 내용 |
|---|---|
| 주소 | `${BASE_URL}data/<경로>` (`web/src/data/load.ts`의 `dataUrl`) |
| 캐시 무효화 | `VITE_DATA_VERSION`이 있으면 `?v=<값>`을 붙임 |
| 메서드 | `GET` (정적 파일) |
| 실패 | HTTP 오류면 `DataError(path, status)`를 던짐. 실패한 요청은 메모리 캐시에서 지움 |
| 날짜·시각 | 날짜 `YYYY-MM-DD`, 시각 `HH:MM`(KST, `24:00` 허용) |
| 장소 ID | `lawn88`(88잔디마당), `lake`(수변무대) |
| 크기 제한 | 파이프라인 생성 파일은 300KB 이하 |

### 1.1 `events.json`: 공연 목록

- 생성: `pipeline/run.ts` (`events`), 매일 11:30 KST 자동 갱신(워크플로가 `main`에 병합된 뒤부터)
- 로더: `loadEvents(): Promise<EventItem[]>`
- 형태: `EventItem[]`, 날짜 → 장소 순 정렬, 빈 배열 불가, 이전 파일보다 10% 넘게 줄면 저장 안 함

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | string | 수동 `YYYYMMDD-슬러그`, 자동 수집 `YYYYMMDD-<evtSeq>`. 수변무대는 `-lake`가 붙음. 고유값 |
| `name` | string | 공연명 |
| `venue` | `'lawn88' \| 'lake'` | 장소 |
| `date` | string | `YYYY-MM-DD`. 같은 `venue`+`date`는 한 건만 |
| `start` / `end` | string | `HH:MM`, `start < end` |
| `timeSource` | `'manual' \| 'default'` | 시각 출처. `default`면 12:00~21:00 |
| `people` | number \| null | 관객 수(0 이상 정수). 모르면 `null` |
| `peopleSource` | `'manual' \| 'linked' \| 'default'` | 관객 수 출처. `null`이면 `default` |
| `layout` | string \| null | `layout_<id>.json`. `web/public/data/<venue>/`에 그 파일이 있을 때만 값이 있음 |
| `sourceUrl` | string | 근거 URL(`http(s)://`) |
| `tempMax` | number \| null | 그날 최고기온(°C, -30~45). 연계 스냅샷(2025년)에만 있음 |

`ValueSource` 타입에는 `'api'`도 있지만 현재 파이프라인은 쓰지 않습니다.

```json
{
  "id": "20250530-sjf",
  "name": "제17회 서울재즈페스티벌 2025",
  "venue": "lawn88",
  "date": "2025-05-30",
  "start": "12:20",
  "end": "21:30",
  "timeSource": "manual",
  "people": 15000,
  "peopleSource": "linked",
  "layout": null,
  "sourceUrl": "https://www.seouljazz.co.kr/bbs/board.php?bo_table=notice&wr_id=206",
  "tempMax": 27.9
}
```

### 1.2 `closures.json`: 휴장 기간

- 생성: `pipeline/run.ts` (`closures`), 입력은 `pipeline/manual/closures_manual.json`
- 로더: `loadClosures(): Promise<Closure[]>`
- 형태: `Closure[]`, 장소 → 시작일 순 정렬, 빈 배열 허용(현재 `[]`)

| 필드 | 타입 | 설명 |
|---|---|---|
| `venue` | `'lawn88' \| 'lake'` | 장소 |
| `from` / `to` | string | `YYYY-MM-DD`, 양 끝 포함, `from ≤ to` |
| `reason` | string | 사유 |
| `source` | string | 현재 항상 `"manual"` |

### 1.3 `forecast.json`: 날씨 예보

- 생성: `pipeline/run.ts` (`forecast`)
- 로더: `loadForecast(): Promise<Forecast>` (작업 기록 기준 프론트에서 아직 호출하지 않음)

| 필드 | 타입 | 설명 |
|---|---|---|
| `updated` | string | 사용한 단기예보 발표 시각, ISO 8601(`2026-11-24T05:00+09:00`) |
| `days` | `ForecastDay[]` | 오늘(KST)부터, 최고기온(TMX)이 있는 날만. 날짜는 하루씩 이어지고 3일 이상, 첫날은 발표일 또는 그다음 날 |

`ForecastDay`

| 필드 | 타입 | 설명 |
|---|---|---|
| `date` | string | `YYYY-MM-DD` |
| `sky` | `'맑음' \| '구름많음' \| '흐림'` | 09~18시 하늘 상태 최빈값(동점이면 더 흐린 쪽). 타입은 `string`으로 선언돼 있음 |
| `rain` | boolean | 09~21시에 강수형태(PTY)가 0이 아닌 시간이 있으면 `true` |
| `rainPrevDay` | number | 전날 강수량(mm, 0 이상). 오늘은 ASOS 관측값(ASOS가 실패하면 이전 파일의 오늘 값), 이후는 전날 예보 PCP 합. 05시 발표분은 06시부터라 내일 값에는 오늘 00~05시 강수가 빠짐 |
| `tempMax` | number | 최고기온(°C, -30~45) |

### 1.4 장소 데이터 (`<venue>/…`)

파이프라인이 만들지 않는 고정 파일입니다. 필드는 `types.ts`의 같은 이름 타입을 보세요.

| 경로 | 타입 | 로더 |
|---|---|---|
| `<venue>/venue.json` | `Venue` | `loadVenueBundle(id)` |
| `<venue>/terrain.json` | `Terrain` | `loadVenueBundle(id)` |
| `<venue>/trees.json` | `Tree[]` | `loadVenueBundle(id)` |
| `<venue>/buildings.json` | `Building[]` | `loadVenueBundle(id)` |
| `<venue>/layout_*.json` | `Layout` | `loadLayout(venue, file)`: `file`이 없거나 404면 `venue.defaultLayout`을 읽음 |

현재 `lawn88/`에만 파일이 있고 `lake/`는 비어 있습니다.

## 2. 외부 API (파이프라인 → 공공 API)

공통: `pipeline/collect/http.ts`의 `fetchText`를 씁니다. 기본은 타임아웃 30초, 429·5xx·네트워크 오류는 30초 간격으로 최대 2번 다시 시도합니다(올림픽공원 일정만 타임아웃 15초, 간격 5초). 리다이렉트는 따라가지 않고 오류로 봅니다. 오류 메시지에는 URL을 넣지 않습니다(쿼리에 키가 있음). 키는 환경변수가 우선이고, 없으면 `pipeline/.env`에서 읽습니다.

### 2.1 기상청 단기예보 (API허브)

| 항목 | 내용 |
|---|---|
| 코드 | `collect/kma.ts` `fetchVilage` |
| 요청 | `GET https://apihub.kma.go.kr/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst` |
| 파라미터 | `pageNo=1`, `numOfRows=1000`, `dataType=JSON`, `base_date=YYYYMMDD`, `base_time=0500`, `nx=62`, `ny=126`, `authKey` |
| 키 | `KMA_AUTH_KEY` |
| 발표분 | 05시 발표분. KST 05:30 전이면 전날 05시 발표분 |
| 사용 항목 | `SKY`, `PTY`, `PCP`, `TMX` |
| 페이지 | 1000건씩. 받은 건수가 `totalCount`보다 적으면 다음 페이지(최대 5페이지) |
| 실패 조건 | HTTP ≠ 200, JSON 아님, `resultCode ≠ "00"`, 받은 건수 ≠ `totalCount` |

### 2.2 ASOS 일자료 (공공데이터포털)

| 항목 | 내용 |
|---|---|
| 코드 | `collect/kma.ts` `fetchAsosDailyRain` |
| 요청 | `GET https://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList` |
| 파라미터 | `serviceKey`, `numOfRows=10`, `pageNo=1`, `dataType=JSON`, `dataCd=ASOS`, `dateCd=DAY`, `startDt=endDt=어제(YYYYMMDD)`, `stnIds=108`(서울) |
| 키 | `ASOS_DAILY_KEY` (이미 인코딩된 키면 그대로 씀) |
| 사용 항목 | `sumRn` (빈 문자열이면 0mm) |
| 실패 조건 | HTTP ≠ 200, JSON 아님, `resultCode ≠ "00"`, 해당 날짜 행 없음, `sumRn` 필드 없음, `sumRn`이 숫자가 아니거나 음수. 실패하면 이전 `forecast.json`의 오늘 `rainPrevDay`로 대신해 저장하고 종료 코드 1(작업은 실패로 표시). 이전 값이 없거나 키가 없으면 forecast 실패 |
| 참고 | 전날 자료는 11시 이후 조회 가능해서 갱신 시각을 11:30 KST로 잡음 |

### 2.3 올림픽공원 공식 일정 (ksponco.or.kr)

| 항목 | 내용 |
|---|---|
| 코드 | `collect/olympicpark.ts` `fetchSchedule` |
| 요청 | `POST https://www.ksponco.or.kr/olympicpark/eventInfo/eventInfoListAjax.es` |
| 헤더 | `Content-Type: application/json;charset=UTF-8`, `User-Agent: ksponco-data-pipeline` |
| 본문 | `{"nowYM":"YYYYMM","plcCd":""}` |
| 키 | 없음 |
| 호출 범위 | 2026-01부터 오늘(KST)+12개월까지 월마다, 0.3초 간격 |
| 응답 | `[예정 공연[], 지난 공연[]]`. 사용 필드: `evtSeq`, `title`, `plc`, `beginDt`, `endDt` |
| 장소 판별 | `plc`에 "88잔디마당"이면 `lawn88`, "수변무대"면 `lake`(둘 다면 둘 다). 나머지 행은 무시 |
| 실패 조건 | 한 달이라도 HTTP ≠ 200, JSON 아님, 구조 다름(두 목록 중 하나라도 배열이 아님), 잔디·수변 행의 필드 누락 → 전체 실패. 전체 결과가 0건이어도 실패 |
| 상세 링크 | `https://www.ksponco.or.kr/olympicpark/eventInfo/eventInfoView.es?mid=a20301010100&evtSeq=<evtSeq>` (`sourceUrl`로 씀) |
| 참고 | 공개 문서가 없는 API라 형식이 바뀔 수 있음. 이용약관은 확인하지 않음 |

### 2.4 KCISA 연계 데이터 (API_CPM_009, 1회성)

| 항목 | 내용 |
|---|---|
| 코드 | `collect/linked.ts` (`node collect/linked.ts`로 직접 실행, 매일 갱신에는 쓰지 않음) |
| 요청 | `GET https://api.kcisa.kr/openapi/API_CPM_009/request?serviceKey=…&numOfRows=500&pageNo=N` |
| 키 | `KCISA_LINKED_KEY` |
| 응답 | XML. `ISSUED_DATE`, `TITLE`(공연명·관람객 수), `DESCRIPTION`(기온) |
| 호출 간격 | 5초, 실패 시 30초 후 최대 2번 재시도 |
| 출력 | `pipeline/snapshot/linked_2025.json` (`LinkedSnapshot`: `tempMax` 날짜별 최고기온, `shows` 시간별 공연·관객 수) |
| 실패 조건 | HTTP ≠ 200, `resultCode ≠ "0000"`, `totalCount` 오류, 빈 페이지, 받은 건수 ≠ `totalCount` |

## 3. 생성·갱신 흐름

```
node run.ts [forecast|closures|events]
  대상마다(이 순서로): build() → check() + 크기 검사 → 통과하면 저장
  실패한 대상은 이전 파일 유지, 종료 코드 1 (알 수 없는 대상 이름은 2)
```

GitHub Actions(`.github/workflows/update.yml`): 매일 02:30 UTC(11:30 KST)와 수동 실행. 예약 실행은 기본 브랜치의 워크플로만 돌므로 `main`에 병합된 뒤부터 동작합니다. 테스트를 돌리고 `node run.ts`를 실행한 뒤(최대 10분), 바뀐 데이터 파일 3개를 봇이 커밋하고 push합니다. 생성이 일부 실패하거나 10분을 넘어도 그때까지 저장한 파일은 커밋하고, 작업은 마지막에 실패로 표시합니다. Secrets는 `KMA_AUTH_KEY`, `ASOS_DAILY_KEY`입니다.
