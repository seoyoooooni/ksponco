type Props = {
  place: string
  error?: string | null
  leaving?: boolean
  onRetry?: () => void
  onLeft?: () => void
}

export function LoadingScreen({ place, error, leaving, onRetry, onLeft }: Props) {
  return (
    <div
      className={`loading${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      onTransitionEnd={(e) => {
        if (leaving && e.target === e.currentTarget) onLeft?.()
      }}
    >
      {error ? (
        <>
          <svg className="loading__art" viewBox="0 0 120 84" aria-hidden="true">
            <ellipse cx="60" cy="88" rx="62" ry="22" fill="#e5e8eb" />
            <rect x="57.5" y="44" width="5" height="22" rx="2" fill="#b0b8c1" />
            <circle cx="60" cy="38" r="15" fill="#d1d6db" />
          </svg>
          <p className="loading__title">불러오지 못했어요</p>
          <p className="loading__sub">{error}</p>
          <button type="button" className="pill-btn pill-btn--primary loading__retry" onClick={onRetry}>
            다시 시도
          </button>
        </>
      ) : (
        <>
          <svg className="loading__art" viewBox="0 0 120 84" aria-hidden="true">
            <g className="loading__sun">
              <circle cx="60" cy="14" r="7" fill="#ffc23d" />
            </g>
            <ellipse cx="60" cy="88" rx="62" ry="22" fill="#b5d78e" />
            <ellipse className="loading__shadow" cx="60" cy="67" rx="15" ry="3.2" fill="#2f6690" opacity="0.32" />
            <rect x="57.5" y="44" width="5" height="22" rx="2" fill="#7a5a40" />
            <circle cx="60" cy="38" r="15" fill="#6fa35a" />
          </svg>
          <p className="loading__title">{place}</p>
          <p className="loading__sub">3D 지도를 불러오고 있어요</p>
        </>
      )}
    </div>
  )
}
