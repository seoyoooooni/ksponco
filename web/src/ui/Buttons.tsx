import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'accent' | 'light' | 'soft'

type PillProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  icon?: ReactNode
}

export function PillButton({ variant = 'light', icon, className, children, ...rest }: PillProps) {
  return (
    <button type="button" className={`pill-btn pill-btn--${variant} ${className ?? ''}`} {...rest}>
      {icon}
      {children}
    </button>
  )
}
