import { useState } from "react";
import { Cloud, CloudOff, CheckCircle, AlertTriangle, Copy, Save, X, Trash2 } from "lucide-react";
import { getFirebaseConfig, saveFirebaseConfig, isFirebaseReady, disconnectFirebase } from "@/lib/firebaseSync";

interface SyncStatusProps {
  isMobile?: boolean;
}

export default function SyncStatus({ isMobile = false }: SyncStatusProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [configText, setConfigText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const status = getFirebaseConfig();
  const ready = isFirebaseReady();

  function clearLocalData() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith("sgf_"));
    keys.forEach(k => localStorage.removeItem(k));
  }

  function handleDisconnect() {
    disconnectFirebase();
    clearLocalData();
    setMessage("Disconnected and cleared. Reloading...");
    setTimeout(() => window.location.reload(), 1000);
  }

  function handleClearDevice() {
    if (!window.confirm("Clear all data from this device? This cannot be undone.")) return;
    disconnectFirebase();
    clearLocalData();
    setMessage("Device cleared. Reloading...");
    setTimeout(() => window.location.reload(), 1000);
  }

  // Floating trigger button - positioned top-right to avoid Kimi Agent
  if (!showPanel) {
    return (
      <button
        onClick={() => setShowPanel(true)}
        className="fixed z-40 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5"
        style={{
          top: isMobile ? 8 : 8,
          right: isMobile ? 8 : 80,
          background: ready ? "rgba(74,222,128,0.15)" : "rgba(245,158,11,0.15)",
          border: `1px solid ${ready ? "rgba(74,222,128,0.3)" : "rgba(245,158,11,0.3)"}`,
          backdropFilter: "blur(4px)",
          fontSize: 11,
          color: ready ? "#4ADE80" : "#F59E0B",
        }}
      >
        {ready ? <Cloud className="w-3.5 h-3.5" /> : <CloudOff className="w-3.5 h-3.5" />}
        {!isMobile && <span>Sync</span>}
      </button>
    );
  }

  // Panel overlay
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={() => setShowPanel(false)}
    >
      <div
        className="w-full max-w-sm mx-4 mb-4 sm:mb-0 rounded-xl p-4 space-y-3"
        style={{ backgroundColor: "#141415", border: "1px solid #222324" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">Cloud Sync</span>
          <button onClick={() => setShowPanel(false)} className="p-1 rounded hover:bg-[#222324]">
            <X className="w-4 h-4 text-[#8A8B8C]" />
          </button>
        </div>

        {/* Connected state */}
        {ready ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs" style={{ color: "#4ADE80" }}>
              <CheckCircle className="w-4 h-4" />
              <span>Connected to {status.projectId}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleDisconnect}
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium"
                style={{ background: "#222324", border: "1px solid #EF4444", color: "#EF4444" }}
              >
                <CloudOff className="w-3.5 h-3.5" /> Disconnect
              </button>
              <button
                onClick={handleClearDevice}
                className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium"
                style={{ background: "#222324", border: "1px solid #F59E0B", color: "#F59E0B" }}
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Device
              </button>
            </div>
            <p className="text-[10px] text-[#8A8B8C]">
              Disconnect stops sync. Clear Device removes all data from this phone.
            </p>
          </div>
        ) : (
          /* Not connected state */
          <div className="space-y-3">
            <p className="text-xs text-[#8A8B8C]">
              Ask your admin for the Firebase config. Paste it below and tap Save.
            </p>
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              placeholder={'Paste config JSON here...'}
              className="w-full rounded-lg p-2 text-xs font-mono resize-none"
              style={{ background: "#0A0A0B", border: "1px solid #222324", color: "#fff", height: 60 }}
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setError(""); setMessage("");
                  try {
                    let raw = configText.trim();
                    if (!raw) { setError("Paste the config first."); return; }
                    const match = raw.match(/\{[\s\S]*\}/);
                    if (match) raw = match[0];
                    const parsed = new Function("return " + raw)();
                    if (!parsed.apiKey || parsed.apiKey.length < 10) { setError("Invalid apiKey."); return; }
                    if (!parsed.databaseURL) { setError("Missing databaseURL."); return; }
                    const success = saveFirebaseConfig(parsed);
                    if (success) {
                      setMessage("Connected! Syncing...");
                      setConfigText("");
                      setTimeout(() => { setShowPanel(false); window.location.reload(); }, 1500);
                    } else { setError("Failed to connect."); }
                  } catch { setError("Invalid format."); }
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold"
                style={{ background: "#D4A843", color: "#000" }}
              >
                <Save className="w-3.5 h-3.5" /> Save & Connect
              </button>
              <button
                onClick={async () => {
                  try { const text = await navigator.clipboard.readText(); setConfigText(text); setMessage("Pasted."); }
                  catch { setError("Could not read clipboard."); }
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs"
                style={{ background: "#222324", color: "#fff" }}
              >
                <Copy className="w-3.5 h-3.5" /> Paste
              </button>
            </div>
          </div>
        )}

        {message && <div className="text-xs text-[#4ADE80] flex items-center gap-1"><CheckCircle className="w-3 h-3" />{message}</div>}
        {error && <div className="text-xs text-[#EF4444] flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</div>}
      </div>
    </div>
  );
}
