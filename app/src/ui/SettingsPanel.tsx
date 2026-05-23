import { useState } from "react";

type HookStatus = "unavailable" | "disconnected" | "connected";

interface Props {
  hookStatus: HookStatus;
  onConnectHook: () => void;
  onClose: () => void;
  onResetZoom: () => void;
  onRecenter: () => void;
  onNewRun: () => void;
  onSaveNow: () => void;
  /** Wall-clock timestamp of the last successful save, or null if
   * no save has happened yet this session. */
  lastSavedAt: number | null;
}

export function SettingsPanel({
  hookStatus,
  onConnectHook,
  onClose,
  onResetZoom,
  onRecenter,
  onNewRun,
  onSaveNow,
  lastSavedAt
}: Props) {
  // Inline confirm flow because the VS Code webview disables
  // window.confirm/alert/prompt outright (returns undefined, no
  // dialog ever shown), so the previous native-confirm-then-reset
  // chain was a silent no-op.
  const [confirmingNewRun, setConfirmingNewRun] = useState(false);

  return (
    <div className="settings-panel">
      <div className="sp-header">
        <span className="sp-title">SETTINGS</span>
        <button className="sp-close" onClick={onClose} aria-label="close">
          ×
        </button>
      </div>
      <div className="sp-section">
        <div className="sp-row">
          <button className="sp-btn" onClick={onRecenter}>
            recenter on main
          </button>
          <span className="sp-hint">jump to your main building</span>
        </div>
        <div className="sp-row">
          <button className="sp-btn" onClick={onResetZoom}>
            reset zoom
          </button>
          <span className="sp-hint">restore 1.0x</span>
        </div>
        <div className="sp-row">
          <button className="sp-btn" onClick={onSaveNow}>
            save now
          </button>
          <span className="sp-hint">{formatLastSaved(lastSavedAt)}</span>
        </div>
        <div className="sp-row">
          {hookStatus === "connected" && (
            <>
              <span className="sp-btn sp-status ok">hook on</span>
              <span className="sp-hint">claude code hook is feeding tokens</span>
            </>
          )}
          {hookStatus === "disconnected" && (
            <>
              <button className="sp-btn" onClick={onConnectHook}>
                connect hook
              </button>
              <span className="sp-hint">link claude code for ai materials</span>
            </>
          )}
          {hookStatus === "unavailable" && (
            <>
              <span className="sp-btn sp-status off">hook off</span>
              <span className="sp-hint">not running under claude code</span>
            </>
          )}
        </div>
        {!confirmingNewRun ? (
          <div className="sp-row danger">
            <button
              className="sp-btn danger"
              onClick={() => setConfirmingNewRun(true)}
            >
              new run
            </button>
            <span className="sp-hint">wipe map + resources</span>
          </div>
        ) : (
          <div className="sp-confirm">
            <div className="sp-confirm-msg">
              start a new run? this wipes the current map and resources.
            </div>
            <div className="sp-confirm-actions">
              <button
                className="sp-btn danger"
                onClick={() => {
                  setConfirmingNewRun(false);
                  onNewRun();
                }}
              >
                yes
              </button>
              <button
                className="sp-btn"
                onClick={() => setConfirmingNewRun(false)}
              >
                no
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatLastSaved(ts: number | null): string {
  if (!ts) return "auto-saves every 5s";
  const ageSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (ageSec < 5) return "just saved";
  if (ageSec < 60) return `saved ${ageSec}s ago`;
  const min = Math.floor(ageSec / 60);
  return `saved ${min}m ago`;
}
