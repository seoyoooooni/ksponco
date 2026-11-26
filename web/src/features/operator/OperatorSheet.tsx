import type { ReactNode } from 'react'
import { BottomSheet, type SheetSnap } from '../../ui/BottomSheet'
import { PillButton } from '../../ui/Buttons'
import { ShareIcon, TentIcon } from '../../ui/icons'
import { Toggle } from '../../ui/Toggle'
import type { OperatorResult, Variant } from '../../lib/operator'
import type { OpLayer } from '../../store/sceneStore'

export type PlanCounts = { tents: number; zones: number; palms: number }

export type OpView = Variant | 'compare'

type Props = {
  onVisibleHeight: (h: number) => void
  footer?: ReactNode
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
  canClear: boolean
  onClear: () => void
  layers: OpLayer[]
  onLayers: (v: OpLayer[]) => void
  onSuggest: () => void
  onShare: () => void
  snap: SheetSnap
  onSnap: (v: SheetSnap) => void
}

export const LAYER_COLOR: Record<OpLayer, string> = { shade: '#3f9a6e', blocked: '#e2574c', wet: '#7fa6c6' }
export const BOTH_COLOR = '#e8a13a'

const LAYER_LABEL: Record<OpLayer, string> = { shade: '그늘 생김', blocked: '무대 가림', wet: '젖은 바닥' }

function LayerPicker({ layers, onLayers, wet }: { layers: OpLayer[]; onLayers: (v: OpLayer[]) => void; wet: boolean }) {
  const all: OpLayer[] = wet ? ['shade', 'blocked', 'wet'] : ['shade', 'blocked']
  const flip = (l: OpLayer) => onLayers(layers.includes(l) ? layers.filter((x) => x !== l) : [...layers, l])
  return (
    <div className="op-layers">
      <span className="op-layers__label">지도에 표시</span>
      <div className="op-layers__chips" role="group" aria-label="지도에 표시">
        {all.map((l) => (
          <button key={l} type="button" className="op-chip" aria-pressed={layers.includes(l)} onClick={() => flip(l)}>
            <i style={{ background: LAYER_COLOR[l] }} />
            {LAYER_LABEL[l]}
          </button>
        ))}
      </div>
      {layers.includes('shade') && layers.includes('blocked') && (
        <span className="op-layers__both">
          <i style={{ background: BOTH_COLOR }} />
          그늘은 생기지만 무대가 가려지는 자리
        </span>
      )}
    </div>
  )
}

const HELP: [string, string][] = [
  ['상한', '피크닉·스탠딩 구역 넓이에 밀도를 곱한 최대 인원이에요. 출입 금지 구역은 빼고 계산해요.'],
  ['그늘 더 얻는 관객', '머무는 시간 중 그늘에 있는 비율이 그늘막 덕분에 25%p 이상 늘어나는 자리의 인원이에요.'],
  ['무대 가림', '그늘막 때문에 공연자가 보이는 비율이 20%p 이상 줄어드는 자리의 인원이에요.'],
  ['젖은 바닥 관객', '전날 비가 아침 햇볕으로 덜 마를 것 같은 자리의 인원이에요. 야자매트를 깐 곳은 빼요.'],
  ['추천 위치', '그늘을 얻는 사람은 늘리고, 무대가 가려지는 사람은 두 배로 감점해서 고른 자리예요.'],
]

const num = (n: number) => n.toLocaleString('ko-KR')

function room(r: OperatorResult | null, sold: number | null): string {
  if (!r || sold === null) return '—'
  const d = sold - r.capacity
  return d > 0 ? `${num(d)}명 초과` : `${num(-d)}명 여유`
}

type Row = { label: string; a: number | null; b: number | null; better: 'high' | 'low' | null; text?: [string, string]; unit?: string }

function diffText(row: Row): string {
  if (row.a === null || row.b === null) return '—'
  const d = row.b - row.a
  if (d === 0) return '같음'
  return `${d > 0 ? '+' : '−'}${num(Math.abs(d))}${row.unit ?? '명'}`
}

function CompareTable(p: Props) {
  const { resultA: a, resultB: b } = p
  const rows: Row[] = [
    { label: '상한', a: a?.capacity ?? null, b: b?.capacity ?? null, better: 'high' },
    { label: '판매 예정 대비', a: a && p.sold !== null ? a.capacity - p.sold : null, b: b && p.sold !== null ? b.capacity - p.sold : null, better: 'high', text: [room(a, p.sold), room(b, p.sold)] },
    { label: '그늘 더 얻는 관객', a: a?.shadeGain ?? null, b: b?.shadeGain ?? null, better: 'high' },
    { label: '무대 가림', a: a?.blocked ?? null, b: b?.blocked ?? null, better: 'low' },
  ]
  if (p.wetText) rows.push({ label: '젖은 바닥 관객', a: a?.wetPeople ?? null, b: b?.wetPeople ?? null, better: 'low' })
  rows.push({ label: '그늘막', a: p.countsA.tents, b: p.countsB.tents, better: null, text: [`${p.countsA.tents}개`, `${p.countsB.tents}개`], unit: '개' })
  rows.push({ label: '출입 금지 구역', a: p.countsA.zones, b: p.countsB.zones, better: null, text: [`${p.countsA.zones}개`, `${p.countsB.zones}개`], unit: '개' })
  if (p.wetText) rows.push({ label: '야자매트', a: p.countsA.palms, b: p.countsB.palms, better: null, text: [`${p.countsA.palms}곳`, `${p.countsB.palms}곳`], unit: '곳' })

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
          <th scope="col">B−A</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            {cell(row, 'a')}
            {cell(row, 'b')}
            <td className="op-compare__diff">{diffText(row)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SoldInput({ sold, onSold }: { sold: number | null; onSold: (v: number | null) => void }) {
  return (
    <input
      className="op-input"
      type="number"
      inputMode="numeric"
      min={0}
      placeholder="입력"
      value={sold ?? ''}
      onChange={(e) => onSold(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
    />
  )
}

export function OperatorSheet(p: Props) {
  const r = p.result
  const over = r && p.sold !== null ? p.sold - r.capacity : 0
  const compare = p.view === 'compare'

  const help = (
    <>
      <PillButton variant="soft" style={{ height: 48 }} icon={<ShareIcon size={18} />} onClick={p.onShare}>
        계획 보내기 · 저장
      </PillButton>
      <details className="op-help">
        <summary>숫자는 이렇게 계산해요</summary>
        <dl>
          {HELP.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </details>
      <p className="op-note">참고 추정치 · 안전 기준은 따로 확인하세요</p>
    </>
  )

  const more = compare ? (
    <>
      <label className="op-sold-row">
        <span>판매 예정</span>
        <SoldInput sold={p.sold} onSold={p.onSold} />
      </label>
      {help}
    </>
  ) : (
    <>
      {p.wetText && <p className="plain-line">{p.wetText}</p>}
      <LayerPicker layers={p.layers} onLayers={p.onLayers} wet={Boolean(p.wetText)} />
      {p.canCopy && (
        <PillButton variant="soft" style={{ height: 48 }} onClick={p.onCopy}>
          A안 그대로 복사해서 시작
        </PillButton>
      )}
      {r?.suggestion && !p.busy && (
        <p className="plain-line op-suggest-note">
          놓으면 그늘 +{num(r.suggestion.shade)}명 · 무대 가림 +{num(r.suggestion.blocked)}명
        </p>
      )}
      <PillButton variant="primary" style={{ height: 52, fontSize: 16, fontWeight: 700 }} icon={<TentIcon />} disabled={!r?.suggestion || p.busy} onClick={p.onSuggest}>
        {p.busy ? '계산하는 중…' : r?.suggestion ? '추천 위치에 그늘막 놓기' : '더 놓을 추천 위치가 없어요'}
      </PillButton>
      {p.canClear && (
        <button type="button" className="op-clear" onClick={p.onClear}>
          {p.view}안 비우기
        </button>
      )}
      {help}
    </>
  )

  return (
    <BottomSheet label="운영 계획" snap={p.snap} onSnap={p.onSnap} onVisibleHeight={p.onVisibleHeight} footer={p.footer} more={more}>
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
      {compare ? (
        <CompareTable {...p} />
      ) : (
        <>
          <div className="op-stats" aria-busy={p.busy}>
            <div className="stat">
              <span className="stat__label">상한</span>
              <span className="stat__value">{r ? `${num(r.capacity)}명` : '—'}</span>
            </div>
            <label className="stat">
              <span className="stat__label">판매 예정</span>
              <SoldInput sold={p.sold} onSold={p.onSold} />
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
        </>
      )}
    </BottomSheet>
  )
}
