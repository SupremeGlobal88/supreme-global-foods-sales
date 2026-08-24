import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import { TRPCProvider } from "@/providers/trpc"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import App from './App.tsx'

// ═══════════════════════════════════════════════════════════════
// APP VERSION — Pulled from index.html inline script
// ═══════════════════════════════════════════════════════════════
const APP_VERSION = (window as any).SGF_APP_VERSION || "2026-08-25-stable-v25";

// Background polling: check every 30s for new version while tab is visible
let updateBannerShown = false;
async function checkForUpdate() {
  if (document.hidden || updateBannerShown) return;
  try {
    const res = await fetch("/?_cb=" + Date.now(), { cache: "no-store", credentials: "same-origin" });
    const html = await res.text();
    const m = html.match(/window\.SGF_APP_VERSION\s*=\s*"([^"]+)"/);
    const liveVersion = m ? m[1] : null;
    if (liveVersion && liveVersion !== APP_VERSION) {
      console.log(`[AppVersion] Live version ${liveVersion} differs from running ${APP_VERSION}. Reloading...`);
      updateBannerShown = true;
      localStorage.setItem("sgf_app_version", liveVersion);
      const banner = document.createElement("div");
      banner.innerHTML = `
        <div style="position:fixed;top:0;left:0;right:0;z-index:99999;background:#D4A843;color:#0C0D0E;padding:10px 16px;text-align:center;font-family:sans-serif;font-size:14px;font-weight:600;">
          🔄 Update available — reloading in 3 seconds...
        </div>
      `;
      document.body.appendChild(banner);
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("_r", Date.now().toString());
        window.location.href = url.toString();
      }, 3000);
    }
  } catch (e) {
    // offline or error — ignore
  }
}
window.addEventListener("focus", checkForUpdate);
setInterval(checkForUpdate, 30000);

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
