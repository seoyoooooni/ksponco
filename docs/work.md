# 백엔드(pipeline) 작업 기록

브랜치: `feat/pipeline` · 마지막 정리: 2026-11-24

## 목표

프론트가 읽는 `web/public/data/`의 `events.json`, `closures.json`, `forecast.json`을 공공데이터와 수동 입력으로 만들고 매일 자동 갱신한다. 품질 검사를 통과한 파일만 반영한다. 스키마 기준은 `web/src/data/types.ts`.

## 현재 상태

| 단계 | 내용 | 상태 |
|---|---|---|
| 1 | 기반(`env.ts`, `http.ts`, `.gitignore`) | 완료 |
| 3 | 연계 데이터 2025 스냅샷(`snapshot/linked_2025.json`) | 완료 |
| 4 | 공연 목록(`manual/events_manual.json` + 올림픽공원 공식 일정 자동 수집 → `events.json`, 40건) | 완료 |
| 5 | 휴장(`manual/closures_manual.json` → `closures.json`) | 항목 없음(`[]`). 공사 휴장 근거 불확실(아래) |
| 6 | 품질 검사(`check/check.ts`)와 실행(`run.ts`) | 완료 |
| 2 | 예보(`collect/kma.ts`, `clean/forecast.ts`) | 완료. 2026-11-24 로컬 실행 성공 확인 |
| 7 | 자동 갱신(`.github/workflows/update.yml`) | 파일 완료. 실제 실행 미확인 |

테스트 54개 통과(`npm test`).

## 남은 일

1. **Actions에서 예보·공식 일정 확인**: 로컬에서는 성공했다(2026-11-24 11:14). GitHub Actions 서버에서 기상청, ASOS, `ksponco.or.kr` API가 열리는지는 미확인. 변경된 `forecast.json`, `events.json`, `closures.json` 커밋 필요. ASOS `NO_DATA`가 나면 워크플로 시각(11:30) 조정 검토.
2. **PR과 Actions**: `feat/pipeline` → `main` PR. 머지 후 팀장 repo에서
   - Secrets 등록: `KMA_AUTH_KEY`, `ASOS_DAILY_KEY`
   - Settings → Actions → Workflow permissions 쓰기 허용 확인, `main` 브랜치 보호 규칙이 봇 push를 막는지 확인
   - Actions 탭에서 "Run workflow"로 수동 실행해 확인(`schedule`은 `main`의 워크플로만 실행)
3. **88잔디마당 공사 휴장 확인**: 2026-07-01~2027-06-30 "보수 공사"(근거 https://news.tf.co.kr/read/ogmeta/2250357.htm, 월 단위, "대관 중단"까지만 확인)를 넣어 뒀었으나, 공식 일정에 2026-09~10월 88잔디마당 공연(성시경, KB 조이올팍, 그랜드 민트)이 있어 모순이라 2026-11-24에 `closures_manual.json`을 `[]`로 비웠다. 프론트는 휴장 기간 공연 없는 날에 "출입이 제한돼요"라고 표시하므로, 올림픽공원 공지로 공사 시점·출입 제한 여부를 확인한 뒤 다시 넣는다. 2026-12 이후 잔디·수변 공연은 공식 일정에 아직 없다.
4. **노션 변경 목록 작성**: Python→Node, 대관정보 미수집, 공연정보는 자동 소스 아님, 연계 데이터는 2025 스냅샷으로 관객 수·기온만 사용, 갱신 11:30 KST, 사전계산 보류.

## 실행 방법

```bash
cd pipeline
npm test                  # 테스트
node run.ts               # 전체 생성(예보, 공식 일정 API 호출 포함)
node run.ts events        # 일부만: events, closures, forecast
node collect/linked.ts    # 연계 스냅샷 다시 받기(약 10분, 평소엔 불필요)
```

- `run.ts`는 생성 → 검사 → 통과한 것만 저장. 실패하면 이전 파일을 유지하고 종료 코드 1.
- `clean/*.ts`는 단독 실행해도 파일을 쓰지 않는다. 저장은 `run.ts`만 한다.
- 키는 `pipeline/.env`(커밋 안 됨)에 `KEY=값` 형식:
  ```
  KMA_AUTH_KEY=...       # 기상청 API허브 단기예보
  ASOS_DAILY_KEY=...     # 공공데이터포털 ASOS 일자료
  KCISA_LINKED_KEY=...   # 연계 데이터(스냅샷 다시 받을 때만)
  ```
- Node 24 이상 필요(TS 타입 제거로 바로 실행). 외부 패키지 없음.

## 주요 결정

- **언어**: Node(TS) 하나, 외부 패키지 없음. 타입 검사(`tsc`)는 안 함(`@types/node` 미설치).
- **소스**
  - 단기예보(API허브, nx=62, ny=126, 05시 발표분): `forecast`의 하늘·비·최고기온
  - ASOS 일자료(서울 108): 오늘의 `rainPrevDay`. 전일 자료는 11시 이후 조회 가능 → 갱신 11:30 KST
  - 연계 데이터(API_CPM_009): 2025년만 있음, 장소 정보 없음 → 한 번 받아 스냅샷으로 고정. **시각은 쓰지 않음**(시간별 행이 실제 공연 시간과 맞지 않음). 관객 수와 날짜별 최고기온만 씀
  - 올림픽공원 공식 일정(`https://www.ksponco.or.kr/olympicpark/eventInfo/eventInfoListAjax.es`, POST `{"nowYM":"YYYYMM","plcCd":""}`): 일정 페이지가 쓰는 월별 JSON. 키 불필요, `robots.txt` 없음(404), 이용약관은 미확인. `collect/olympicpark.ts`가 2026-01부터 오늘+12개월을 월마다 받는다(0.3초 간격). 한 달이라도 실패하면 전체 실패 → 이전 `events.json` 유지
  - 대관정보: 쓰지 않음. 휴장은 수동 입력만
  - ASOS 시간자료, 사전계산(`sun_*`, `view_*`, `wet.json`): 보류
- **events 규칙**
  - 공식 일정 자동 수집분: `plc` 문자열에 "88잔디마당"이면 `lawn88`, "수변무대"면 `lake`(둘 다 적혀 있으면 날짜마다 두 무대 모두). 기간은 하루씩 펼친다. 31일을 넘는 기간이나 날짜 형식 오류는 건너뛰고 경고. 시각·관객 수는 알 수 없어 `default`/`null`. id `YYYYMMDD-<evtSeq>`(수변무대 `-lake`)
  - 합치기: 같은 장소·날짜는 manual이 우선, 수집분끼리는 evtSeq가 작은 쪽. 2025년은 manual이 정확해서 수집은 2026-01부터
  - 한계: 공식 일정은 장소·시각이 자유 입력이라 날짜별로 어느 무대를 쓰는지 알 수 없다. 그랜드 민트 2025는 공식 일정에 잔디·수변으로 안 잡힘(manual에만 있음)
  - 공연 하나는 하루·장소 1건. 수동 항목 id `YYYYMMDD-슬러그`, 수변무대는 `-lake` 접미사
  - 시각: manual에 시작과 종료가 모두 있으면 `manual`, 아니면 `default`(12:00~21:00)
  - 관객 수: manual → 연계(`linkedName`과 공연명이 정확히 같은 행의 최댓값, 다른 공연과 겹친 행 제외) → `null`. 연계 값은 페스티벌 전체 인원이라 88잔디마당 항목에만 `linkedName`을 넣음
  - `tempMax`: 연계 스냅샷의 그날 최고기온(2025년만)
  - `layout`: `web/public/data/<venue>/layout_<id>.json`이 있으면 연결, 없으면 `null`
- **forecast 규칙**
  - 날짜: TMX가 있는 날 중 오늘(KST) 이후
  - `sky`: 09~18시 SKY 최빈값(동점이면 더 흐린 쪽). 1 맑음 / 3 구름많음 / 4 흐림
  - `rain`: 09~21시 PTY≠0이 있으면 true
  - `rainPrevDay`: 오늘은 ASOS 어제 관측값, 내일 이후는 전날 예보 PCP 합(1mm 미만=0.5, 구간값은 하한)
- **검사**: 같은 장소·날짜 중복 금지, 시각 `24:00` 허용, `sourceUrl` 필수, 300KB 이하, events 빈 배열 금지(closures는 허용).

## events_manual.json 메모

- 2025년 6개 페스티벌: 서울재즈, 뷰티풀 민트 라이프, 서울파크뮤직, Someday week 1, KB 조이올팍, 그랜드 민트.
- 서울재즈, 뷰민라, 파크뮤직, 그랜드 민트 시각은 공식 타임테이블 이미지로 확인함.
- 조이올팍은 기사의 운영시간, Someday와 그랜드 민트는 종료 시각을 몰라 `default`. 근거는 각 항목의 `note`.
- 2026년 이후 공연은 manual에 없고 공식 일정 자동 수집으로 들어온다(18건).

## 참고

- 프론트는 아직 `forecast.json`을 읽지 않는다(`loadForecast` 호출 없음). `people`, `tempMax`도 아직 안 쓴다.
- `web/public/data/lake/`가 비어 있어 수변무대 공연은 아직 화면에 안 나온다.
- `lawn88/layout_20260620-parkmusic.json`은 예시 이벤트용이라 지금은 참조하는 공연이 없다.
- Actions 기본 토큰으로 한 push는 다른 워크플로를 실행시키지 않는다. 배포를 Actions로 한다면 데이터 갱신 후 배포가 자동으로 안 돈다.
