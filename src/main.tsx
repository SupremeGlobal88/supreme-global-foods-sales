import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import { TRPCProvider } from "@/providers/trpc"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import App from './App.tsx'

// ═══════════════════════════════════════════════════════════════
// APP VERSION — simple check, reloads only on mismatch
// ═══════════════════════════════════════════════════════════════
const APP_VERSION = (window as any).SGF_APP_VERSION || "2026-08-25-stable-v31a";
const storedVersion = localStorage.getItem("sgf_app_version");
if (storedVersion && storedVersion !== APP_VERSION) {
  localStorage.setItem("sgf_app_version", APP_VERSION);
  window.location.reload();
} else {
  localStorage.setItem("sgf_app_version", APP_VERSION);
}

// Catch any render errors and show something instead of blank screen
try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <HashRouter>
          <TRPCProvider>
            <App />
          </TRPCProvider>
        </HashRouter>
      </ErrorBoundary>
    </StrictMode>,
  )
} catch (e: any) {
  console.error("[main.tsx] Fatal render error:", e);
  document.body.innerHTML = `
    <div style="min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0C0D0E;color:#fff;padding:24px;font-family:sans-serif;">
      <h1 style="color:#EF4444;font-size:20px;margin-bottom:16px;">App failed to load</h1>
      <p style="color:#8A8B8C;font-size:14px;text-align:center;margin-bottom:16px;">
        The application could not start. Please clear your browser cache and reload (Ctrl+Shift+R).
      </p>
      <details style="font-size:12px;color:#8A8B8C;background:#1A1A1B;padding:12px;border-radius:8px;max-width:500px;width:100%;">
        <summary>Error details</summary>
        <pre style="margin-top:8px;white-space:pre-wrap;">${e.message || e}</pre>
      </details>
      <button onclick="window.location.reload()" style="margin-top:24px;padding:10px 16px;background:#D4A843;color:#0C0D0E;border:none;border-radius:6px;font-weight:600;cursor:pointer;">
        Reload Page
      </button>
    </div>
  `;
}
