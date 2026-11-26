type Props = {
  kind: 'shade' | 'seats' | 'ponds'
  ponds?: boolean
  inline?: boolean
}

export const SHADE_COLORS = ['#ffc23d', '#f3e3a8', '#f4f7ee', '#7fa6c6', '#2f6690'] as const
export const SEAT_COLORS = ['#e07b39', '#a9c4da', '#2f6690'] as const
export const POND_COLOR = '#3fa7b8'

const SWATCH = { width: 10, height: 10, borderRadius: 3 }

export function Legend({ kind, ponds, inline }: Props) {
  if (kind === 'ponds') {
    return (
      <div className="legend-chip" aria-label="청록색은 물이 고여 있을 수 있는 곳">
        <i style={{ ...SWATCH, background: POND_COLOR }} />
        물이 고였을 수 있는 곳
      </div>
    )
  }
  if (kind === 'shade') {
    return (
      <div className="legend-chip" aria-label="그늘 비율 범례: 노랑은 볕, 파랑은 그늘">
        볕
        <span className="legend-chip__bar" aria-hidden="true">
          {SHADE_COLORS.map((c) => (
            <i key={c} style={{ background: c }} />
          ))}
        </span>
        그늘
      </div>
    )
  }
  return (
    <div className={inline ? 'legend-inline' : 'legend-chip'} aria-label="좋은 자리 범례: 진한 파랑 좋음, 연한 파랑 보통, 주황 가려지거나 땡볕">
      <i style={{ width: 10, height: 10, borderRadius: 3, background: SEAT_COLORS[2] }} />
      좋음
      <i style={{ width: 10, height: 10, borderRadius: 3, background: SEAT_COLORS[1] }} />
      보통
      <i style={{ width: 10, height: 10, borderRadius: 3, background: SEAT_COLORS[0] }} />
      아쉬움
      {ponds && (
        <>
          <i style={{ ...SWATCH, background: POND_COLOR }} />
          물 고임
        </>
      )}
    </div>
  )
}
