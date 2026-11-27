# 백엔드(pipeline) 작업 기록

브랜치: `fix/kopis-error-body` · 마지막 정리: 2026-11-27

## 목표

프론트가 읽는 `web/public/data/`의 `events.json`, `closures.json`, `forecast.json`을 공공데이터와 수동 입력으로 만들고 매일 자동 갱신한다. 품질 검사를 통과한 파일만 반영한다. 스키마 기준은 `web/src/data/types.ts`.

## 현재 상태

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 기반(`env.ts`, `http.ts`, `.gitignore`) | 완료 |
| 2 | 예보(`collect/kma.ts`, `clean/forecast.ts`). 시간별 강수 `rainHourly` 포함 | 완료(PR #8 머지) |
| 3 | 연계 데이터 2025 스냅샷(`snapshot/linked_2025.json`) | 완료 |
| 4 | 공연 목록(`manual/events_manual.json` + KOPIS 자동 수집 → `events.json`, 40건) | 완료. KOPIS 400 재시도·호출 간격 1초는 이 브랜치(PR 전) |
| 5 | 휴장(`manual/closures_manual.json` → `closures.json`) | 항목 없음(`[]`). 공사 휴장 근거 불확실(아래) |
| 6 | 품질 검사(`check/check.ts`)와 실행(`run.ts`) | 완료 |
| 7 | 자동 갱신(`.github/workflows/update.yml`) | 완료. 매일 13:30 KST, Secrets 등록과 Actions 실행 확인 |

테스트 92개 통과(`npm test`, 이 브랜치 기준. `main`은 91개).

## 남은 일

1. 88잔디마당 공사 휴장 근거: 2026-07-01~2027-06-30 "보수 공사"(근거 https://news.tf.co.kr/read/ogmeta/2250357.htm, 월 단위, "대관 중단"까지만 확인)를 넣어 뒀었으나, 2026-09~10월 88잔디마당 공연(성시경, KB 조이올팍, 그랜드 민트)과 모순이라 2026-11-24에 `closures_manual.json`을 `[]`로 비웠다. 프론트는 휴장 기간 공연 없는 날에 "출입이 제한돼요"라고 표시하므로, 올림픽공원 공지로 공사 시점·출입 제한 여부를 확인한 뒤 다시 넣는다. 크롤링은 하지 않는다.
2. 12월 이후 데모용 모의 공연: 시작·종료는 9~22시 안. `manual/events_manual.json`에 넣을 예정.
3. 프론트 `rainHourly` 타입: `types.ts`의 `Forecast`에 아직 없음. 프론트 담당과 상의. 파이프라인 안에서는 `ForecastOut` 타입.
4. 엔진 팀원 전달 사항(아직 안 됨): `engine/src/shadow.ts`의 `shadeRatio`가 범위 밖 시작 시각을 하루 전체로 처리하는 문제, `findShadeSpots`가 건물 안 칸을 추천하는 문제, `package.json`에 typescript 의존성이 없는 문제. `rainHourly`를 물고임 계산(`origin/feat/wet`의 `engine/src/wet.ts`, 지금은 전날 강수량 하나만 입력)과 연결할지는 팀이 정한다.

## 실행 방법

```bash
cd pipeline
npm test                  # 테스트
node run.ts               # 전체 생성(예보, KOPIS API 호출 포함)
node run.ts events        # 일부만: events, closures, forecast
node collect/linked.ts    # 연계 스냅샷 다시 받기(약 10분, 평소엔 불필요)
```

- `run.ts`는 생성 → 검사 → 통과한 것만 저장. 실패하면 이전 파일을 유지하고 종료 코드 1.
- `clean/*.ts`는 단독 실행해도 파일을 쓰지 않는다. 저장은 `run.ts`만 한다.
- 키는 `pipeline/.env`(커밋 안 됨)에 `KEY=값` 형식(`공백 + #` 뒤는 주석):
  ```
  KMA_AUTH_KEY=...       # 기상청 API허브 단기예보
  ASOS_DAILY_KEY=...     # 공공데이터포털 ASOS 일자료·시간자료
  KOPIS_KEY=...          # KOPIS 공연 목록·상세
  KCISA_LINKED_KEY=...   # 연계 데이터(스냅샷 다시 받을 때만)
  ```
- Node 24 이상 필요(TS 타입 제거로 바로 실행). 외부 패키지 없음.

## 주요 결정

- 언어: Node(TS) 하나, 외부 패키지 없음. 타입 검사(`tsc`)는 안 함(`@types/node` 미설치).
- 소스
  - 단기예보(API허브, nx=62, ny=126, 05시 발표분): `forecast`의 하늘·비·최고기온, `rainHourly`의 예보 칸
  - ASOS 일자료(서울 108): 오늘의 `rainPrevDay`. 전일 자료가 11:30에도 없는 날이 있어 갱신 13:30 KST
  - ASOS 시간자료(서울 108, `ASOS_DAILY_KEY` 재사용): `rainHourly`의 어제 칸
  - 연계 데이터(API_CPM_009): 2025년만 있음, 장소 정보 없음 → 한 번 받아 스냅샷으로 고정. **시각은 쓰지 않음**(시간별 행이 실제 공연 시간과 맞지 않음). 관객 수와 날짜별 최고기온만 씀
  - KOPIS 오픈 API(`https://kopis.or.kr/openApi/restful`, `www.` 없이): 올림픽공원 `FC001247`의 `-07` 88잔디마당, `-08` 수변무대, `-12` 일대(페스티벌만, 두 무대 모두). `collect/kopis.ts`가 2026-01부터 오늘+12개월을 달마다 공연장별로 받고 공연마다 상세를 받는다(1초 간격, HTTP 400은 5초 뒤 최대 2번 재시도). 한 번이라도 실패하면 전체 실패 → 이전 `events.json` 유지
  - 대관정보: 쓰지 않음. 휴장은 수동 입력만
  - 사전계산(`sun_*`, `view_*`, `wet.json`): 범위 제외
- events 규칙
  - KOPIS 자동 수집분: 기간은 하루씩, 무대마다 펼친다. 31일을 넘는 기간이나 날짜 형식 오류는 건너뛰고 경고. 잘못 잡힌 공연은 `manual/kopis_exclude.json`(`{id, reason}`)으로 뺀다. id `YYYYMMDD-<KOPIS 공연 ID>`(수변무대 `-lake`)
  - 시각: 상세의 공연시간(`dtguidance`)에서 요일별 첫·마지막 회차를 읽는다. 런타임이 있으면 마지막 회차+런타임까지 `api`, 없으면 종료를 추정해 `default`. 공연시간을 읽었는데 그 요일이 없으면 그날은 공연 없음. 아예 못 읽으면 기본 시각(12:00~21:00)
  - 합치기: 같은 장소·날짜는 manual이 우선, 수집분끼리는 기간이 짧은 쪽(같으면 공연 ID 순)이 우선하고 밀린 항목은 경고. 2025년은 manual이 정확해서 수집은 2026-01부터이고, 그 이전 날짜는 버린다
  - 공연 하나는 하루·장소 1건. 수동 항목 id `YYYYMMDD-슬러그`, 수변무대는 `-lake` 접미사
  - manual 시각: 시작과 종료가 모두 있으면 `manual`, 아니면 `default`(12:00~21:00)
  - 관객 수: manual → 연계(`linkedName`과 공연명이 정확히 같은 행의 최댓값, 다른 공연과 겹친 행 제외) → `null`. 연계 값은 페스티벌 전체 인원이라 88잔디마당 항목에만 `linkedName`을 넣음
  - `tempMax`: 연계 스냅샷의 그날 최고기온(2025년만)
  - `layout`: `web/public/data/<venue>/layout_<id>.json`이 있으면 연결, 없으면 `null`
- forecast 규칙
  - 날짜: TMX가 있는 날 중 오늘(KST) 이후
  - `sky`: 09~18시 SKY 최빈값(동점이면 더 흐린 쪽). 1 맑음 / 3 구름많음 / 4 흐림
  - `rain`: 09~21시 PTY≠0이 있으면 true
  - `rainPrevDay`: 오늘은 ASOS 어제 관측값, 내일 이후는 전날 예보 PCP 합(1mm 미만=0.5, 구간값은 하한, 단위 없는 숫자 허용). 05시 발표분은 06시부터라 내일 값에 오늘 00~05시 강수는 빠진다
  - ASOS 일자료가 실패하면 이전 `forecast.json`의 오늘 `rainPrevDay`(어제 예보 PCP 합)로 대신해 저장하되 종료 코드 1로 작업을 실패 표시. 이전 값이 없거나 키가 없으면 실패
  - `rainHourly`: 첫날 전날 00시부터 마지막 날 23시까지 1시간 단위 mm, 모르면 `null`. 이전 파일 → 예보 PCP → ASOS 시간자료 순으로 덮어쓴다. 마지막 날은 예보가 3시간 간격이라 사이 칸이 `null`. ASOS 시간자료가 실패하면 어제 칸은 이전 파일 값을 쓰고 종료 코드 1
  - 단기예보는 1000건씩 받고 `totalCount`를 채울 때까지 다음 페이지를 받는다
- 검사: 같은 장소·날짜 중복 금지, 시각 `24:00` 허용, `sourceUrl` 필수, 300KB 이하, events 빈 배열 금지(closures는 허용), events가 이전 파일보다 10% 넘게 줄면 실패(지난 공연도 계속 받으므로 정상이면 줄지 않음. 취소 등으로 실제로 줄었으면 `events.json`을 직접 고쳐 커밋). forecast는 날짜 연속, 3일 이상, 첫날이 발표일 또는 다음 날. `rainHourly`는 시작 시각, 길이, 값 범위(0~300mm).
- 실행 순서: forecast → closures → events(가장 느림). Actions에서 생성 단계는 10분 제한이고, 넘어도 그때까지 저장한 파일은 커밋한다.
- 저장: `.tmp`에 쓴 뒤 rename. 실패하면 임시 파일을 지운다.
- HTTP: 리다이렉트는 따라가지 않는다(키가 다른 곳으로 넘어가지 않게). 오류 메시지에 URL을 넣지 않고, KOPIS 오류 메시지의 응답 본문에서는 키를 가린다.
- 워크플로: 액션은 SHA로 고정, 쓰기 권한은 `update` 작업에만. 체크아웃은 토큰을 남기지 않고(`persist-credentials: false`) 커밋 단계에서만 토큰으로 pull·push.

## events_manual.json 메모

- 2025년 6개 페스티벌: 서울재즈, 뷰티풀 민트 라이프, 서울파크뮤직, Someday week 1, KB 조이올팍, 그랜드 민트.
- 서울재즈, 뷰민라, 파크뮤직, 그랜드 민트 시각은 공식 타임테이블 이미지로 확인함.
- 조이올팍은 기사의 운영시간, Someday와 그랜드 민트는 종료 시각을 몰라 `default`. 근거는 각 항목의 `note`.
- 2026년 이후 공연은 manual에 없고 KOPIS 자동 수집으로 들어온다(18건).

## 알려진 한계

- KOPIS 조회 범위가 2026-01부터 매달 3회씩 늘어난다. 지금은 1~2분이면 끝난다.
- 평일이 공휴일인 날 공연은 빠질 수 있다.
- KOPIS가 취소 공연을 목록에서 지우는지, 상태만 바꾸는지 모른다.
- KOPIS 400 재시도와 호출 간격 1초 중 무엇이 효과였는지는 모른다.

## 참고

- `lawn88/layout_20260620-parkmusic.json`은 예시 이벤트용이라 지금은 참조하는 공연이 없다.
- Actions 기본 토큰으로 한 push는 다른 워크플로를 실행시키지 않는다. 배포를 Actions로 한다면 데이터 갱신 후 배포가 자동으로 안 돈다.
