import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export function PinIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 30) / 26} viewBox="0 0 26 30" aria-hidden="true">
      <path
        d="M13 29s-10-9.2-10-16.5a10 10 0 0 1 20 0C23 19.8 13 29 13 29z"
        fill="var(--color-ink)"
      />
      <circle cx="13" cy="12.5" r="3.8" fill="#ffffff" />
    </svg>
  )
}

export const RainIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 15a4.5 4.5 0 0 1-.5-9 5.5 5.5 0 0 1 10.6 1.5A3.75 3.75 0 0 1 17 15H7Z" />
    <path d="m8.5 18-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5" />
  </Svg>
)

export const CloudIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 18a4.5 4.5 0 0 1-.5-9 5.5 5.5 0 0 1 10.6 1.5A3.75 3.75 0 0 1 17 18H7Z" />
  </Svg>
)

export const DropIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5c3.2 4 5.5 7.2 5.5 10.2a5.5 5.5 0 0 1-11 0c0-3 2.3-6.2 5.5-10.2Z" />
  </Svg>
)

export const SunsetIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 17a5 5 0 0 1 10 0" />
    <path d="M3 17h18M12 4v5M9.5 6.5 12 9l2.5-2.5M4.6 11.6l1.4 1M19.4 11.6l-1.4 1" />
  </Svg>
)

export const ChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)

export const ChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
)

export const ChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
)

export const EyeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)

export const GridIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Svg>
)

export const PlayIcon = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="M8 5v14l11-7z" />
  </Svg>
)

export const PauseIcon = (p: IconProps) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </Svg>
)

export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)

export const ClipboardIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3h6v1" />
    <path d="m9 13 2 2 4-4" />
  </Svg>
)

export const TentIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 9h18l-2-4H5z" />
    <path d="M5 9v10M19 9v10" />
  </Svg>
)

export const ZoneIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="4" width="16" height="16" rx="1.5" strokeDasharray="3 3" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </Svg>
)

export const EraseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M16 4l4 4-10 10H6l-2-2z" />
    <path d="M12 8l4 4M10 20h10" />
  </Svg>
)

export const MatIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="7" width="18" height="10" rx="1.5" />
    <path d="M7 7v10M11 7v10M15 7v10M19 7v10" />
  </Svg>
)
