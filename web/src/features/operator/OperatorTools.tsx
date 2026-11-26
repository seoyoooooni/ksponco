import type { ReactNode } from 'react'
import { EraseIcon, MatIcon, TentIcon, UndoIcon, ZoneIcon } from '../../ui/icons'
import type { OpTool } from '../../store/sceneStore'

const TOOLS: { id: OpTool; label: string; icon: ReactNode }[] = [
  { id: 'tent', label: '그늘막', icon: <TentIcon size={18} /> },
  { id: 'zone', label: '구역', icon: <ZoneIcon size={18} /> },
  { id: 'palm', label: '야자매트', icon: <MatIcon size={18} /> },
  { id: 'erase', label: '지우기', icon: <EraseIcon size={18} /> },
]

type Props = {
  tool: OpTool | null
  onTool: (t: OpTool | null) => void
  wet: boolean
  canUndo: boolean
  onUndo: () => void
}

export function OperatorTools({ tool, onTool, wet, canUndo, onUndo }: Props) {
  return (
    <div className="op-tools" role="toolbar" aria-label="운영 도구">
      {TOOLS.filter((t) => wet || t.id !== 'palm').map((t) => (
        <button key={t.id} type="button" className="op-tool" aria-pressed={tool === t.id} onClick={() => onTool(tool === t.id ? null : t.id)}>
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
      <button type="button" className="op-tool op-tool--undo" disabled={!canUndo} onClick={onUndo} aria-label="되돌리기" title="되돌리기 (⌘Z)">
        <UndoIcon size={18} />
        <span className="op-tool__text">되돌리기</span>
      </button>
    </div>
  )
}
