import type { LayoutSource } from '../data/types'
import { ModalSheet } from '../ui/ModalSheet'

type Props = {
  open: boolean
  onClose: () => void
  layoutSource: LayoutSource | null
  satelliteTrees: boolean
}

const LAYOUT_SOURCE: Record<LayoutSource, string> = {
  official_map: '주최사 공식 맵 기준',
  default: '기본 배치(추정)',
  operator: '운영자 입력',
}

const SOURCES = [
  '한국체육산업개발 · 올림픽공원 공연장 실감형 콘텐츠(3D 점군), 공연정보, 대관정보, 차량입출차·공연·날씨 연계 데이터',
  '기상청 · 단기예보, 지상관측',
  '국토지리정보원 · 국토위성 정사영상, 수치표고모델, 항공사진',
  '국토교통부 · GIS건물통합정보',
]

export function SourcesSheet({ open, onClose, layoutSource, satelliteTrees }: Props) {
  return (
    <ModalSheet label="데이터 출처" open={open} onClose={onClose}>
      <h2 className="picker-title">데이터 출처</h2>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 8, fontSize: 14, lineHeight: 1.5 }}>
        {SOURCES.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      {layoutSource && <p style={{ fontSize: 13, color: 'var(--color-mute)' }}>행사 배치: {LAYOUT_SOURCE[layoutSource]}</p>}
      {satelliteTrees && (
        <p style={{ fontSize: 13, color: 'var(--color-mute)' }}>
          3D 점군에 없는 일부 나무는 국토위성 영상으로 위치와 크기를 추정했어요. 지도에서 반투명하게 보이는 나무예요.
        </p>
      )}
      <p style={{ fontSize: 12, color: 'var(--color-mute)' }}>공공누리 출처표시 조건에 따라 표시합니다.</p>
    </ModalSheet>
  )
}
