import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import { TRPCProvider } from "@/providers/trpc"
import App from './App.tsx'

// ═══════════════════════════════════════════════════════════════
// APP VERSION CHECK — Forces browser to reload when app updates
// ═══════════════════════════════════════════════════════════════
const APP_VERSION = "2026-08-13-v2"; // Change this on every deploy
const storedVersion = localStorage.getItem("sgf_app_version");
if (storedVersion && storedVersion !== APP_VERSION) {
  // New version detected — clear cached JS and reload
  console.log(`[AppVersion] New version ${APP_VERSION} detected (was ${storedVersion}). Reloading...`);
  localStorage.setItem("sgf_app_version", APP_VERSION);
  // Force hard reload bypassing cache
  window.location.reload();
} else {
  localStorage.setItem("sgf_app_version", APP_VERSION);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <TRPCProvider>
        <App />
      </TRPCProvider>
    </HashRouter>
  </StrictMode>,
)
