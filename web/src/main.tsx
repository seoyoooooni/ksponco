import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './styles/tokens.css'
import './styles/base.css'
import './styles/ui.css'
import './styles/screens.css'

window.addEventListener(
  'wheel',
  (e) => {
    if (e.ctrlKey && e.deltaY < 0) e.preventDefault()
  },
  { passive: false },
)
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
