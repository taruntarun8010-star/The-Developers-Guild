import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ThemeProvider } from './components/ThemeContext.jsx'
import { LanguageProvider } from './components/LanguageContext.jsx'
import './index.css'
import App from './App.jsx'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://the-developers-guild-backend.onrender.com').replace(/\/$/, '')
const LOCAL_API_BASE = 'https://the-developers-guild-backend.onrender.com'

window.__DG_API_BASE_URL__ = API_BASE_URL

const rewriteApiUrl = (url) => {
  if (typeof url !== 'string') return url
  if (!url.startsWith(LOCAL_API_BASE)) return url
  return `${API_BASE_URL}${url.slice(LOCAL_API_BASE.length)}`
}

const originalFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  if (typeof input === 'string') {
    return originalFetch(rewriteApiUrl(input), init)
  }

  if (input instanceof Request) {
    const rewritten = rewriteApiUrl(input.url)
    if (rewritten !== input.url) {
      const request = new Request(rewritten, input)
      return originalFetch(request, init)
    }
  }

  return originalFetch(input, init)
}

const originalOpen = window.open.bind(window)
window.open = (url, target, features) => originalOpen(rewriteApiUrl(url), target, features)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <ThemeProvider>
        <LanguageProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </LanguageProvider>
      </ThemeProvider>
    </HelmetProvider>
  </StrictMode>,
)
