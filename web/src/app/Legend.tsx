type Props = {
  kind: 'shade' | 'seats'
}

export const SHADE_COLORS = ['#ffc23d', '#f3e3a8', '#f4f7ee', '#7fa6c6', '#2f6690'] as const
export const SEAT_COLORS = ['#e2574c', '#ffc23d', '#3f8a5a'] as const

export function Legend({ kind }: Props) {
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
    <div className="legend-chip" aria-label="좋은 자리 범례: 초록 좋음, 노랑 보통, 빨강 가려지거나 땡볕">
      <i style={{ width: 10, height: 10, borderRadius: 3, background: SEAT_COLORS[2] }} />
      좋음
      <i style={{ width: 10, height: 10, borderRadius: 3, background: SEAT_COLORS[1] }} />
      보통
      <i style={{ width: 10, height: 10, borderRadius: 3, background: SEAT_COLORS[0] }} />
      아쉬움
    </div>
  )
}
