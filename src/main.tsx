import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './styles.css'
import App from './App'
import { marksStore } from './lib/marks'
import { setupUpdates } from './lib/pwa'

const theme = (() => { try { return localStorage.getItem('theme') } catch { return null } })()
if (theme) document.documentElement.dataset.theme = theme

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
marksStore.init()
setupUpdates()
