import type { ReactNode } from 'react'

type Option<T extends string | number> = {
  value: T
  label: string
  icon?: ReactNode
  disabled?: boolean
}

type Props<T extends string | number> = {
  label: string
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function Toggle<T extends string | number>({ label, options, value, onChange, className }: Props<T>) {
  return (
    <div role="group" aria-label={label} className={`toggle ${className ?? ''}`}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          data-value={String(o.value)}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  )
}
