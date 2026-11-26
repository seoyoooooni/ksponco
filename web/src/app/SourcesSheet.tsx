import { ModalSheet } from '../ui/ModalSheet'

type Props = {
  open: boolean
  onClose: () => void
  satelliteTrees: boolean
  estimates: string[]
}

const SOURCES = [
  { org: '한국체육산업개발', items: '올림픽공원 공연장 실감형 콘텐츠(3D 점군), 차량입출차·공연·날씨 연계 데이터, 올림픽공원 공연 일정' },
  { org: '기상청', items: '단기예보, 지상관측(ASOS)' },
  { org: '국토교통부', items: 'GIS건물통합정보' },
  { org: 'OpenStreetMap', items: '산책로, 호수 윤곽, 광장 · © OpenStreetMap contributors' },
  { org: 'Esri', items: 'World Imagery 위성 영상 (나무 위치 추정)' },
]

export function SourcesSheet({ open, onClose, satelliteTrees, estimates }: Props) {
  const notes = [...estimates]
  if (satelliteTrees) notes.push('3D 점군에 없는 일부 나무는 위성 영상으로 위치와 크기를 추정했어요')
  return (
    <ModalSheet label="데이터 출처" open={open} onClose={onClose} placement="center" closeButton>
      <dl className="sources">
        {SOURCES.map((s) => (
          <div key={s.org} className="sources__row">
            <dt>{s.org}</dt>
            <dd>{s.items}</dd>
          </div>
        ))}
      </dl>
      {notes.length > 0 && (
        <section className="sources__notes" aria-label="이 화면의 추정값">
          <h3>이 화면의 추정값</h3>
          <ul>
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}
      <p className="sources__foot">공공누리 출처표시 조건에 따라 표시합니다.</p>
    </ModalSheet>
  )
}
