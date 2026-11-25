import type { ReactNode } from 'react'
import { EraseIcon, MatIcon, TentIcon, ZoneIcon } from '../../ui/icons'
import type { OpTool } from '../../store/sceneStore'

const TOOLS: { id: OpTool; label: string; icon: ReactNode }[] = [
  { id: 'tent', label: '그늘막', icon: <TentIcon size={18} /> },
  { id: 'zone', label: '구역', icon: <ZoneIcon size={18} /> },
  { id: 'palm', label: '야자매트', icon: <MatIcon size={18} /> },
  { id: 'erase', label: '지우기', icon: <EraseIcon size={18} /> },
]

export function OperatorTools({ tool, onTool, wet }: { tool: OpTool | null; onTool: (t: OpTool | null) => void; wet: boolean }) {
  return (
    <div className="op-tools" role="toolbar" aria-label="운영 도구">
      {TOOLS.filter((t) => wet || t.id !== 'palm').map((t) => (
        <button key={t.id} type="button" className="op-tool" aria-pressed={tool === t.id} onClick={() => onTool(tool === t.id ? null : t.id)}>
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </div>
  )
}
