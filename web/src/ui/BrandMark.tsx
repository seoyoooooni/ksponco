export function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 84) / 120} viewBox="0 0 120 84" aria-hidden="true">
      <circle cx="22" cy="30" r="9" fill="#ffc23d" />
      <ellipse cx="60" cy="88" rx="62" ry="22" fill="#b5d78e" />
      <ellipse cx="74" cy="67" rx="20" ry="3.6" fill="#2f6690" opacity="0.32" />
      <rect x="57" y="42" width="6" height="24" rx="2" fill="#7a5a40" />
      <circle cx="60" cy="35" r="17" fill="#6fa35a" />
    </svg>
  )
}
