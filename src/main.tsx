import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import { applyTheme, readTheme } from './theme'

registerSW({ immediate: true })

// Voor de eerste render, anders zie je één frame van het verkeerde thema.
applyTheme(readTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* laatste vangnet: crasht App zelf, dan is er nog steeds een melding en een uitweg */}
    <ErrorBoundary scherm="Trainingsapp">
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
