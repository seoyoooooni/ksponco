import { useEffect } from 'react'

type Props = {
  message: string | null
  onDone: () => void
  ms?: number
}

export function Toast({ message, onDone, ms = 2200 }: Props) {
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(onDone, ms)
    return () => window.clearTimeout(t)
  }, [message, onDone, ms])

  return (
    <div className="toast" role="status" aria-live="polite" hidden={!message}>
      {message}
    </div>
  )
}
