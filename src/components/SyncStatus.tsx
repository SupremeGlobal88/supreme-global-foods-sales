import { useState } from "react";
import { Cloud, CloudOff, CheckCircle, AlertTriangle, Copy, Save } from "lucide-react";
// NOTE: SyncStatus is a pure UI component. Firebase subscriptions are managed
// by initAutoSync() in App.tsx — this component does NOT set up its own subscriptions.
import { getFirebaseConfig, saveFirebaseConfig, isFirebaseReady } from "@/lib/firebaseSync";

export default function SyncStatus() {
  const [showConfig, setShowConfig] = useState(false);
  const [configText, setConfigText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const status = getFirebaseConfig();
  const ready = isFirebaseReady();

  if (!showConfig) {
    return (
      <div
        onClick={() => setShowConfig(true)}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "8px 16px",
          background: ready ? "rgba(74,222,128,0.1)" : "rgba(245,158,11,0.1)",
          borderTop: `1px solid ${ready ? "rgba(74,222,128,0.3)" : "rgba(245,158,11,0.3)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          cursor: "pointer",
          fontSize: 12,
          color: ready ? "#4ADE80" : "#F59E0B",
        }}
      >
        {ready ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
        <span>Sync: {ready ? "Connected" : "Not Connected"} — Tap to configure</span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "#141415",
        borderTop: "1px solid #222324",
        padding: "12px 16px",
        maxHeight: "50vh",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>Cloud Sync Setup</span>
        <button onClick={() => setShowConfig(false)} style={{ background: "none", border: "none", color: "#8A8B8C", cursor: "pointer", fontSize: 11 }}>Close</button>
      </div>

      {ready ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#4ADE80" }}>
          <CheckCircle className="w-4 h-4" /> Connected to {status.projectId}
        </div>
      ) : (
        <>
          <p style={{ fontSize: 11, color: "#8A8B8C", marginBottom: 8 }}>
            Ask your admin to send you the Firebase config from Settings → Cloud Sync. Paste it below and tap Save.
          </p>
          <textarea
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            placeholder={'Paste the config JSON here...\n{\n  "apiKey": "...",\n  "databaseURL": "...",\n  ...\n}'}
            style={{
              width: "100%",
              background: "#0A0A0B",
              border: "1px solid #222324",
              borderRadius: 8,
              padding: 8,
              color: "#fff",
              fontSize: 11,
              fontFamily: "monospace",
              height: 80,
              resize: "none",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => {
                setError(""); setMessage("");
                try {
                  let raw = configText.trim();
                  if (!raw) { setError("Paste the config first."); return; }
                  // Handle JS format: const firebaseConfig = {...}
                  const match = raw.match(/\{[\s\S]*\}/);
                  if (match) raw = match[0];
                  const parsed = new Function("return " + raw)();
                  if (!parsed.apiKey || parsed.apiKey.length < 10) { setError("Invalid apiKey."); return; }
                  if (!parsed.databaseURL) { setError("Missing databaseURL."); return; }
                  const success = saveFirebaseConfig(parsed);
                  if (success) {
                    setMessage("Connected! Sync is now active.");
                    setConfigText("");
                    setTimeout(() => setShowConfig(false), 2000);
                  } else {
                    setError("Failed to connect. Check your config.");
                  }
                } catch { setError("Invalid format. Paste the complete JSON block."); }
              }}
              style={{
                background: "#D4A843",
                border: "none",
                borderRadius: 8,
                padding: "6px 12px",
                color: "#000",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Save className="w-3 h-3 inline mr-1" /> Save Config
            </button>
            <button
              onClick={async () => {
                try {
                  const text = await navigator.clipboard.readText();
                  setConfigText(text);
                  setMessage("Pasted from clipboard.");
                } catch { setError("Could not read clipboard. Paste manually."); }
              }}
              style={{
                background: "#222324",
                border: "none",
                borderRadius: 8,
                padding: "6px 12px",
                color: "#fff",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              <Copy className="w-3 h-3 inline mr-1" /> Paste
            </button>
          </div>
        </>
      )}

      {message && <div style={{ fontSize: 11, color: "#4ADE80", marginTop: 6 }}><CheckCircle className="w-3 h-3 inline mr-1" />{message}</div>}
      {error && <div style={{ fontSize: 11, color: "#EF4444", marginTop: 6 }}><AlertTriangle className="w-3 h-3 inline mr-1" />{error}</div>}
    </div>
  );
}
