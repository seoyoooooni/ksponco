import { BottomSheet } from '../../ui/BottomSheet'
import { PillButton } from '../../ui/Buttons'
import { TentIcon } from '../../ui/icons'
import { Toggle } from '../../ui/Toggle'
import type { OperatorResult, Variant } from '../../lib/operator'

export type PlanCounts = { tents: number; zones: number; palms: number }

export type OpView = Variant | 'compare'

type Props = {
  onVisibleHeight: (h: number) => void
  view: OpView
  onView: (v: OpView) => void
  result: OperatorResult | null
  resultA: OperatorResult | null
  resultB: OperatorResult | null
  counts: PlanCounts
  countsA: PlanCounts
  countsB: PlanCounts
  sold: number | null
  onSold: (v: number | null) => void
  rangeText: string
  wetText: string | null
  busy: boolean
  canCopy: boolean
  onCopy: () => void
  onSuggest: () => void
}

const num = (n: number) => n.toLocaleString('ko-KR')

function room(r: OperatorResult | null, sold: number | null): string {
  if (!r || sold === null) return '—'
  const d = sold - r.capacity
  return d > 0 ? `${num(d)}명 초과` : `${num(-d)}명 여유`
}

type Row = { label: string; a: number | null; b: number | null; better: 'high' | 'low' | null; text?: [string, string] }

function CompareTable(p: Props) {
  const { resultA: a, resultB: b } = p
  const rows: Row[] = [
    { label: '상한', a: a?.capacity ?? null, b: b?.capacity ?? null, better: 'high' },
    { label: '판매 예정 대비', a: a && p.sold !== null ? a.capacity - p.sold : null, b: b && p.sold !== null ? b.capacity - p.sold : null, better: 'high', text: [room(a, p.sold), room(b, p.sold)] },
    { label: '그늘 더 얻는 관객', a: a?.shadeGain ?? null, b: b?.shadeGain ?? null, better: 'high' },
    { label: '무대 가림', a: a?.blocked ?? null, b: b?.blocked ?? null, better: 'low' },
  ]
  if (p.wetText) rows.push({ label: '젖은 바닥 관객', a: a?.wetPeople ?? null, b: b?.wetPeople ?? null, better: 'low' })
  rows.push({ label: '그늘막', a: p.countsA.tents, b: p.countsB.tents, better: null, text: [`${p.countsA.tents}개`, `${p.countsB.tents}개`] })
  rows.push({ label: '출입 금지 구역', a: p.countsA.zones, b: p.countsB.zones, better: null, text: [`${p.countsA.zones}개`, `${p.countsB.zones}개`] })
  if (p.wetText) rows.push({ label: '야자매트', a: p.countsA.palms, b: p.countsB.palms, better: null, text: [`${p.countsA.palms}곳`, `${p.countsB.palms}곳`] })

  const cell = (row: Row, side: 'a' | 'b') => {
    const v = row[side]
    const other = row[side === 'a' ? 'b' : 'a']
    const text = row.text ? row.text[side === 'a' ? 0 : 1] : v === null ? '—' : `${num(v)}명`
    const win = row.better && v !== null && other !== null && v !== other && (row.better === 'high' ? v > other : v < other)
    return <td className={win ? 'is-better' : undefined}>{text}</td>
  }

  return (
    <table className="op-compare">
      <thead>
        <tr>
          <th scope="col">
            <span className="sr-only">항목</span>
          </th>
          <th scope="col">A안</th>
          <th scope="col">B안</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            {cell(row, 'a')}
            {cell(row, 'b')}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function OperatorSheet(p: Props) {
  const r = p.result
  const over = r && p.sold !== null ? p.sold - r.capacity : 0
  return (
    <BottomSheet label="운영 계획" snap={1} onVisibleHeight={p.onVisibleHeight}>
      <Toggle
        label="계획 안"
        value={p.view}
        options={[
          { value: 'A', label: 'A안' },
          { value: 'B', label: 'B안' },
          { value: 'compare', label: '비교' },
        ]}
        onChange={p.onView}
      />
      {p.view === 'compare' ? (
        <>
          <CompareTable {...p} />
          <label className="op-sold-row">
            <span>판매 예정</span>
            <input
              className="op-input"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="입력"
              value={p.sold ?? ''}
              onChange={(e) => p.onSold(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
            />
          </label>
        </>
      ) : (
        <>
          <div className="op-stats" aria-busy={p.busy}>
            <div className="stat">
              <span className="stat__label">상한</span>
              <span className="stat__value">{r ? `${num(r.capacity)}명` : '—'}</span>
            </div>
            <label className="stat">
              <span className="stat__label">판매 예정</span>
              <input
                className="op-input"
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="입력"
                value={p.sold ?? ''}
                onChange={(e) => p.onSold(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
              />
              {over > 0 && <span className="stat__warn">{num(over)}명 초과</span>}
            </label>
            <div className="stat">
              <span className="stat__label">그늘 더 얻는 관객</span>
              <span className="stat__value">{r ? `${num(r.shadeGain)}명` : '—'}</span>
            </div>
            <div className="stat">
              <span className="stat__label">무대 가림</span>
              <span className="stat__value">{r ? `${num(r.blocked)}명` : '—'}</span>
            </div>
            {p.wetText && (
              <div className="stat">
                <span className="stat__label">젖은 바닥 관객</span>
                <span className="stat__value">{r?.wetPeople != null ? `${num(r.wetPeople)}명` : '—'}</span>
              </div>
            )}
          </div>
          <p className="plain-line">
            그늘막 {p.counts.tents}개 · 출입 금지 구역 {p.counts.zones}개{p.wetText ? ` · 야자매트 ${p.counts.palms}곳` : ''} · {p.rangeText} 기준
          </p>
          {p.wetText && <p className="plain-line">{p.wetText}</p>}
          {p.canCopy && (
            <PillButton variant="soft" style={{ height: 48 }} onClick={p.onCopy}>
              A안 그대로 복사해서 시작
            </PillButton>
          )}
          <PillButton variant="primary" style={{ height: 52, fontSize: 16, fontWeight: 700 }} icon={<TentIcon />} disabled={!r?.suggestion} onClick={p.onSuggest}>
            {r?.suggestion ? '추천 위치에 그늘막 놓기' : p.busy ? '계산하는 중…' : '더 놓을 추천 위치가 없어요'}
          </PillButton>
        </>
      )}
      <p className="op-note">참고 추정치 · 안전 기준은 따로 확인하세요</p>
    </BottomSheet>
  )
}
