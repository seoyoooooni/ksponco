import { CloudIcon, DropIcon, RainIcon } from './icons'

export type Note = {
  kind: 'rain' | 'cloud' | 'wet'
  text: string
}

const ICONS = { rain: RainIcon, cloud: CloudIcon, wet: DropIcon }

export function Notes({ notes }: { notes: Note[] }) {
  if (notes.length === 0) return null
  return (
    <ul className="notes">
      {notes.map((n) => {
        const Icon = ICONS[n.kind]
        return (
          <li key={n.kind} className={`note note--${n.kind}`}>
            <Icon size={18} />
            <span>{n.text}</span>
          </li>
        )
      })}
    </ul>
  )
}
